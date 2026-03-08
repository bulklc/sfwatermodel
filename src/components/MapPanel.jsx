import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  useMap,
  CircleMarker,
  Popup,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { nodes, pipes, valves, reservoirs, overflow } from "../data.js";
import NodePopup from "./popups/NodePopup.jsx";
import PipePopup from "./popups/PipePopup.jsx";
import ValvePopup from "./popups/ValvePopup.jsx";
import ReservoirPopup from "./popups/ReservoirPopup.jsx";
import OverflowPopup from "./popups/OverflowPopup.jsx";
import { fmtNum } from "../utils/fmt.js";

/* Fix default Leaflet marker icon paths (not needed for CircleMarkers, but just in case) */
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

/* ---- style helpers ---- */
const sizeToValveRadius = (size) => {
  // Map valve sizes (48–120) to radii (5–14)
  const minSize = 48,
    maxSize = 120,
    minR = 5,
    maxR = 14;
  return minR + ((size - minSize) / (maxSize - minSize)) * (maxR - minR);
};

const sizeToPipeWeight = (size) => {
  // Map pipe sizes (48–120) to stroke widths (2–8)
  const minSize = 48,
    maxSize = 120,
    minW = 2,
    maxW = 8;
  return minW + ((size - minSize) / (maxSize - minSize)) * (maxW - minW);
};

const pointToLayer = (color, pane) => (feature, latlng) =>
  L.circleMarker(latlng, {
    radius: sizeToValveRadius(feature.properties.size || 48),
    fillColor: color,
    color: "#232323",
    weight: 1,
    fillOpacity: 1,
    pane: pane || "markerPane",
  });

const polygonStyle = (fill) => () => ({
  color: "#232323",
  weight: 1,
  fillColor: fill,
  fillOpacity: 0.5,
});

/* ---- popup builder + hover highlight ---- */

// Global tracker: ensures only one layer is highlighted at a time.
// When mouseout is missed (e.g. due to bringToFront DOM reorder),
// the next mouseover will still clear the previous highlight.
let _highlightedLayer = null;
let _highlightedSavedStyle = null;

function _clearHighlight() {
  if (_highlightedLayer && _highlightedLayer.setStyle) {
    _highlightedLayer.setStyle(_highlightedSavedStyle);
  }
  _highlightedLayer = null;
  _highlightedSavedStyle = null;
}

function getPipeColor(pipeName, resultsRef) {
  const flow = resultsRef?.current?.pipes?.[pipeName]?.flow;
  return flow != null && Math.abs(flow) > 0.001 ? "#1f78b4" : "#999";
}

function getOriginalStyle(feature, layer, resultsRef) {
  const geomType = feature.geometry && feature.geometry.type;
  if (geomType === "Point" || geomType === "MultiPoint") {
    return {
      radius: layer.options.radius,
      fillColor: layer.options.fillColor,
      color: "#232323",
      weight: 1,
      fillOpacity: 1,
    };
  }
  if (geomType === "LineString" || geomType === "MultiLineString") {
    const flow = resultsRef?.current?.pipes?.[feature.properties.name]?.flow;
    const hasFlow = flow != null && Math.abs(flow) > 0.001;
    return {
      color: hasFlow ? "#1f78b4" : "#999",
      weight: sizeToPipeWeight(feature.properties.size || 48),
      opacity: 0.9,
      dashArray: hasFlow ? "10 10" : null,
    };
  }
  // Polygon / MultiPolygon
  return {
    color: "#232323",
    weight: 1,
    fillColor: "#a6cde3",
    fillOpacity: 0.5,
  };
}

function addHoverHighlight(feature, layer, resultsRef) {
  layer.on({
    mouseover: () => {
      const savedStyle = getOriginalStyle(feature, layer, resultsRef);
      // Always clear any previously highlighted layer first
      if (_highlightedLayer && _highlightedLayer !== layer) {
        _clearHighlight();
      }
      if (layer.setStyle) {
        layer.setStyle({
          weight: (savedStyle.weight || 1) + 2,
          color: "#ffff00",
          fillColor: "#ffff00",
          fillOpacity: Math.min((savedStyle.fillOpacity || 0.5) + 0.3, 1),
          dashArray: null,
        });
        const geomType = feature.geometry && feature.geometry.type;
        if (
          geomType === "LineString" ||
          geomType === "MultiLineString" ||
          geomType === "Polygon" ||
          geomType === "MultiPolygon"
        ) {
          if (layer.bringToFront) layer.bringToFront();
        }
      }
      _highlightedLayer = layer;
      _highlightedSavedStyle = savedStyle;
    },
    mouseout: () => {
      if (_highlightedLayer === layer) {
        _clearHighlight();
      } else if (layer.setStyle) {
        layer.setStyle(getOriginalStyle(feature, layer, resultsRef));
      }
    },
    popupclose: () => {
      if (layer.setStyle) {
        layer.setStyle(getOriginalStyle(feature, layer, resultsRef));
      }
      if (_highlightedLayer === layer) {
        _highlightedLayer = null;
        _highlightedSavedStyle = null;
      }
    },
  });
}

function makeOnEachFeature(popupFn, resultsRef) {
  return (feature, layer) => {
    if (feature.properties) {
      // Bind an empty popup; content is set lazily on open so that
      // results can update without remounting the GeoJSON layer.
      const popup = L.popup({ className: "styled-popup", maxWidth: 300 });
      layer.bindPopup(popup);
      layer.on("popupopen", () => {
        popup.setContent(
          popupFn({
            properties: feature.properties,
            results: resultsRef.current,
          }),
        );
      });
    }
    addHoverHighlight(feature, layer, resultsRef);
  };
}

/* ---- auto-fit bounds (runs once on mount) ---- */
function FitBounds({ data }) {
  const map = useMap();
  const fitted = useRef(false);
  useEffect(() => {
    if (fitted.current) return;
    const group = L.geoJSON(data);
    const bounds = group.getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [20, 20] });
      fitted.current = true;
    }
  }, [map, data]);
  return null;
}

/* ---- create custom panes for z-index control ---- */
function CreatePanes() {
  const map = useMap();
  // Create panes synchronously so they exist before GeoJSON renders
  if (!map.getPane("polygonsPane")) {
    map.createPane("polygonsPane").style.zIndex = 401;
  }
  if (!map.getPane("pipesPane")) {
    map.createPane("pipesPane").style.zIndex = 402;
  }
  if (!map.getPane("pointsPane")) {
    map.createPane("pointsPane").style.zIndex = 403;
  }
  return null;
}

/* ---- layer visibility control ---- */
const LAYER_DEFS = [
  { id: "reservoirs", label: "Reservoirs", color: "#a6cde3" },
  { id: "overflow", label: "Overflow", color: "#a6cde3" },
  { id: "pipes", label: "Pipes", color: "#1f78b4" },
  { id: "nodes", label: "Nodes", color: "#000000" },
  { id: "valves", label: "Valves", color: "#1f78b4" },
];

function LayerControl({ visibility, onToggle }) {
  return (
    <div className="layer-control">
      {LAYER_DEFS.map(({ id, label, color }) => (
        <label key={id} className="layer-control-item">
          <input
            type="checkbox"
            checked={visibility[id]}
            onChange={() => onToggle(id)}
          />
          <span
            className="layer-control-swatch"
            style={{ background: color }}
          />
          <span className="layer-control-label">{label}</span>
        </label>
      ))}
    </div>
  );
}

/* ---- Overflow warning badge ---- */
function OverflowBadge({ overflowData, hydraulicResults }) {
  if (!overflowData?.features?.length) return null;

  return overflowData.features.map((feature) => {
    const name = feature.properties.name;
    const ovf = hydraulicResults?.overflow?.[name];
    if (!ovf?.active) return null;

    // Compute centroid of the polygon for badge placement
    const coords = feature.geometry.coordinates;
    // MultiPolygon → first polygon → first ring
    const ring = coords[0]?.[0] || [];
    if (!ring.length) return null;
    let latSum = 0,
      lngSum = 0;
    for (const [lng, lat] of ring) {
      latSum += lat;
      lngSum += lng;
    }
    const center = [latSum / ring.length, lngSum / ring.length];

    return (
      <CircleMarker
        key={`ovf-badge-${name}`}
        center={center}
        radius={14}
        pathOptions={{
          fillColor: "#e74c3c",
          color: "#c0392b",
          weight: 2,
          fillOpacity: 0.85,
        }}
        pane="pointsPane"
      >
        <Popup className="styled-popup" maxWidth={260}>
          <div
            style={{
              padding: "6px 2px",
              fontFamily: "'Segoe UI', system-ui, sans-serif",
              fontSize: "13px",
            }}
          >
            <div style={{ fontWeight: 700, color: "#c0392b", marginBottom: 4 }}>
              ⚠ Overflow Active
            </div>
            <div>
              <span style={{ color: "#666" }}>Flow: </span>
              <strong>{fmtNum(ovf.flow, 4)} MGD</strong>
            </div>
          </div>
        </Popup>
      </CircleMarker>
    );
  });
}

export default function MapPanel({
  hydraulicResults,
  valveOverrides,
  onValveOverrideChange,
}) {
  const r = hydraulicResults;

  // Keep a ref to the latest results so lazily-opened popups always
  // show current data without forcing GeoJSON layers to remount.
  const resultsRef = useRef(r);
  resultsRef.current = r;

  // Layer visibility state
  const [layerVis, setLayerVis] = useState({
    reservoirs: true,
    overflow: true,
    pipes: true,
    nodes: true,
    valves: true,
  });
  const toggleLayer = (id) =>
    setLayerVis((prev) => ({ ...prev, [id]: !prev[id] }));

  const pipeLayerRef = useRef(null);
  const [pipeLayerReady, setPipeLayerReady] = useState(false);

  // Callback ref: when the GeoJSON pipe layer mounts, flag it ready
  // so the animation useEffect re-fires with actual sublayers present.
  const pipeLayerCallbackRef = useCallback((node) => {
    pipeLayerRef.current = node;
    if (node) {
      setPipeLayerReady(true);
    }
  }, []);

  // Memoize onEachFeature callbacks so they are stable across re-renders.
  // They read from resultsRef (always current) so they don't need to change.
  const onEachNode = useMemo(
    () => makeOnEachFeature(NodePopup, resultsRef),
    [],
  );
  const onEachPipe = useMemo(
    () => makeOnEachFeature(PipePopup, resultsRef),
    [],
  );
  const onEachReservoir = useMemo(
    () => makeOnEachFeature(ReservoirPopup, resultsRef),
    [],
  );
  const onEachOverflow = useMemo(
    () => makeOnEachFeature(OverflowPopup, resultsRef),
    [],
  );

  // Stable pipe style function that reads from resultsRef so it always
  // returns the correct colour, even when react-leaflet re-applies styles
  // due to unrelated re-renders (e.g. layer toggle).
  const pipeStyleFn = useCallback((feature) => {
    const flow = resultsRef.current?.pipes?.[feature.properties.name]?.flow;
    const hasFlow = flow != null && Math.abs(flow) > 0.001;
    return {
      color: hasFlow ? "#1f78b4" : "#999",
      weight: sizeToPipeWeight(feature.properties.size || 48),
      opacity: 0.9,
      pane: "pipesPane",
      dashArray: hasFlow ? "10 10" : null,
    };
  }, []);

  // When hydraulicResults change, imperatively re-style every pipe layer
  // so colours and ant-trail animation update immediately.
  useEffect(() => {
    const group = pipeLayerRef.current;
    if (!r || !group) return;

    // Compute max flow for animation speed scaling
    let maxFlow = 1;
    if (r.pipes) {
      for (const p of Object.values(r.pipes)) {
        const af = Math.abs(p.flow || 0);
        if (af > maxFlow) maxFlow = af;
      }
    }

    // Build per-layer flow metadata for the animation loop
    const layerFlowMap = new Map();
    group.eachLayer((layer) => {
      if (layer.feature && layer.feature.properties?.name) {
        const props = layer.feature.properties;
        const pipeData = r.pipes?.[props.name];
        const flow = pipeData?.flow || 0;
        const absFlow = Math.abs(flow);
        const hasFlow = absFlow > 0.001;
        const color = hasFlow ? "#1f78b4" : "#999";

        if (hasFlow) {
          // All flow is westward. Determine sign from geometry:
          // compare first and last coordinate longitude.
          // Path drawn east→west (first lng > last lng) means
          // forward along path = westward → use negative dashOffset.
          const coords = layer.feature.geometry?.coordinates;
          let first, last;
          if (coords) {
            // Handle MultiLineString [[ring]] and LineString [pts]
            const ring = Array.isArray(coords[0]?.[0]) ? coords[0] : coords;
            first = ring[0];
            last = ring[ring.length - 1];
          }
          // Increasing dashOffset moves dashes toward path start,
          // so to animate forward (start→end) we decrease offset (sign = -1)
          let sign = -1; // default: path draws west
          if (first && last && first[0] < last[0]) {
            // Path draws east (first lng < last lng), flip to go west
            sign = 1;
          }

          // Speed: pixels per second — higher flow → faster ants
          // Range roughly 15 px/s (low flow) to 120 px/s (max flow)
          const speed = 7.5 + (absFlow / maxFlow) * 52.5;
          layer.setStyle({ color, dashArray: "10 10" });
          layerFlowMap.set(layer, { speed, sign, color });
        } else {
          layer.setStyle({ color, dashArray: null, dashOffset: null });
          layerFlowMap.delete(layer);
        }
      }
    });

    // Animation loop: update dashOffset each frame
    let prevTime = performance.now();
    let offsets = new Map();
    for (const [layer] of layerFlowMap) {
      offsets.set(layer, 0);
    }

    let rafId;
    function animate(now) {
      const dt = (now - prevTime) / 1000; // seconds
      prevTime = now;
      for (const [layer, meta] of layerFlowMap) {
        let offset = (offsets.get(layer) || 0) + meta.speed * meta.sign * dt;
        // Wrap within dash pattern period (20 = 10+10)
        offset = ((offset % 20) + 20) % 20;
        offsets.set(layer, offset);
        // Only update dashOffset — colour and dashArray are managed
        // by hover handlers and the initial setStyle above.
        const el = layer.getElement?.();
        if (el) {
          el.setAttribute("stroke-dashoffset", offset);
        }
      }
      rafId = requestAnimationFrame(animate);
    }
    if (layerFlowMap.size > 0) {
      rafId = requestAnimationFrame(animate);
    }

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [r, pipeLayerReady]);

  // Combine all data for bounds calculation
  const allData = {
    type: "FeatureCollection",
    features: [
      ...reservoirs.features,
      ...overflow.features,
      ...pipes.features,
      ...nodes.features,
      ...valves.features,
    ],
  };

  return (
    <MapContainer
      center={[37.81, -120.29]}
      zoom={19}
      maxZoom={23}
      style={{ width: "100%", height: "100%" }}
      scrollWheelZoom={true}
      attributionControl={false}
      preferCanvas={false}
    >
      <TileLayer
        url="https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}"
        attribution=""
        maxZoom={23}
        maxNativeZoom={19}
      />

      <FitBounds data={allData} />
      <CreatePanes />

      <LayerControl visibility={layerVis} onToggle={toggleLayer} />

      {/* Polygons (bottom layer) – stable keys so layers never remount */}
      {layerVis.reservoirs && (
        <GeoJSON
          key="res"
          data={reservoirs}
          style={() => ({ ...polygonStyle("#a6cde3")(), pane: "polygonsPane" })}
          onEachFeature={onEachReservoir}
        />
      )}
      {layerVis.overflow && (
        <GeoJSON
          key="ovf"
          data={overflow}
          style={() => ({
            ...polygonStyle("#a6cde3")(),
            pane: "polygonsPane",
            ...(r?.overflow?.overflow?.active ?
              {
                fillColor: "#e74c3c",
                fillOpacity: 0.6,
                color: "#c0392b",
                weight: 2,
              }
            : {}),
          })}
          onEachFeature={onEachOverflow}
        />
      )}

      {/* Overflow warning badge */}
      <OverflowBadge overflowData={overflow} hydraulicResults={r} />

      {/* Polylines */}
      {layerVis.pipes && (
        <GeoJSON
          ref={pipeLayerCallbackRef}
          key="pip"
          data={pipes}
          style={pipeStyleFn}
          onEachFeature={onEachPipe}
        />
      )}

      {/* Points */}
      {layerVis.nodes && (
        <GeoJSON
          key="nod"
          data={nodes}
          pointToLayer={pointToLayer("#000000", "pointsPane")}
          onEachFeature={onEachNode}
        />
      )}

      {/* Valve points */}
      {layerVis.valves &&
        valves.features.map((feature) => {
          const coords = feature.geometry.coordinates;
          const vName = feature.properties.name;
          const vType = feature.properties.type;
          const vStatus = feature.properties.status;
          const radius = sizeToValveRadius(feature.properties.size || 48);

          // Compute fill color from butterfly mode / gate+sluice status
          let fillColor = "#1f78b4";
          const ov = valveOverrides?.[vName];
          if (vType === "butterfly") {
            let mode = ov?.mode;
            if (!mode) {
              const isOpen =
                ov?.status === "open" ||
                (!ov?.status && String(vStatus) === "1");
              mode =
                !isOpen ? "closed"
                : (ov?.setting ?? 0) !== 0 ? "throttled"
                : "open";
            }
            if (mode === "throttled") fillColor = "#e6a817";
            else if (mode === "closed") fillColor = "#c0392b";
          } else {
            // gate, sluice, etc. – red when closed
            const isOpen =
              ov?.status === "open" || (!ov?.status && String(vStatus) === "1");
            if (!isOpen) fillColor = "#c0392b";
          }

          const defaultStyle = {
            fillColor,
            color: "#232323",
            weight: 1,
            fillOpacity: 1,
          };
          const highlightStyle = {
            weight: 3,
            color: "#ffff00",
            fillColor: "#ffff00",
            fillOpacity: 1,
          };
          return (
            <CircleMarker
              key={vName}
              center={[coords[1], coords[0]]}
              radius={radius}
              pathOptions={defaultStyle}
              pane="pointsPane"
              eventHandlers={{
                mouseover: (e) => {
                  _clearHighlight();
                  _highlightedSavedStyle = { radius, ...defaultStyle };
                  e.target.setStyle(highlightStyle);
                  _highlightedLayer = e.target;
                },
                mouseout: (e) => {
                  if (_highlightedLayer === e.target) {
                    _clearHighlight();
                  } else {
                    e.target.setStyle(defaultStyle);
                  }
                },
                popupopen: (e) => {
                  // After the initial layout, lock the popup position so
                  // content re-renders (slider changes, model re-runs)
                  // cannot trigger Leaflet's _updateLayout and shift it.
                  const popup = e.popup;
                  if (popup && !popup._origUpdateLayout) {
                    popup._origUpdateLayout = popup._updateLayout.bind(popup);
                  }
                  requestAnimationFrame(() => {
                    if (popup) popup._updateLayout = () => {};
                  });
                },
                popupclose: (e) => {
                  // Restore _updateLayout so the next open re-positions correctly
                  const popup = e.popup;
                  if (popup && popup._origUpdateLayout) {
                    popup._updateLayout = popup._origUpdateLayout;
                  }
                  e.target.setStyle(defaultStyle);
                  if (_highlightedLayer === e.target) {
                    _highlightedLayer = null;
                    _highlightedSavedStyle = null;
                  }
                },
              }}
            >
              <Popup
                className="styled-popup"
                maxWidth={320}
                autoPan={false}
                autoPanOnFocus={false}
              >
                <ValvePopup
                  properties={feature.properties}
                  results={r}
                  overrides={valveOverrides?.[vName]}
                  onOverrideChange={(o) => onValveOverrideChange?.(vName, o)}
                />
              </Popup>
            </CircleMarker>
          );
        })}
    </MapContainer>
  );
}
