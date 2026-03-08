import { useEffect, useState } from "react";
import { MapContainer, TileLayer, GeoJSON, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { nodes, pipes, valves, reservoirs, overflow } from "../data.js";

/* Fix default Leaflet marker icon paths (not needed for CircleMarkers, but just in case) */
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

/* ---- style helpers ---- */
const pointToLayer = (color, radius) => (_feature, latlng) =>
  L.circleMarker(latlng, {
    radius,
    fillColor: color,
    color: "#232323",
    weight: 1,
    fillOpacity: 1,
  });

const pipeStyle = () => ({
  color: "#1f78b4",
  weight: 3,
  opacity: 0.9,
});

const polygonStyle = (fill) => () => ({
  color: "#232323",
  weight: 1,
  fillColor: fill,
  fillOpacity: 0.5,
});

/* ---- popup builder ---- */
function onEachFeature(feature, layer) {
  if (feature.properties) {
    const rows = Object.entries(feature.properties)
      .map(
        ([k, v]) =>
          `<tr><td><strong>${k}</strong></td><td>${v ?? ""}</td></tr>`,
      )
      .join("");
    layer.bindPopup(`<table style="font-size:12px">${rows}</table>`);
  }
}

/* ---- auto-fit bounds ---- */
function FitBounds({ data }) {
  const map = useMap();
  useEffect(() => {
    const group = L.geoJSON(data);
    const bounds = group.getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [20, 20] });
    }
  }, [map, data]);
  return null;
}

export default function MapPanel() {
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
      zoom={13}
      style={{ width: "100%", height: "100%" }}
      scrollWheelZoom={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <FitBounds data={allData} />

      {/* Polygons (bottom layer) */}
      <GeoJSON
        data={reservoirs}
        style={polygonStyle("#a6cde3")}
        onEachFeature={onEachFeature}
      />
      <GeoJSON
        data={overflow}
        style={polygonStyle("#a6cde3")}
        onEachFeature={onEachFeature}
      />

      {/* Polylines */}
      <GeoJSON data={pipes} style={pipeStyle} onEachFeature={onEachFeature} />

      {/* Points */}
      <GeoJSON
        data={nodes}
        pointToLayer={pointToLayer("#000000", 4)}
        onEachFeature={onEachFeature}
      />
      <GeoJSON
        data={valves}
        pointToLayer={pointToLayer("#1f78b4", 8)}
        onEachFeature={onEachFeature}
      />
    </MapContainer>
  );
}
