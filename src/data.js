import nodesRaw from "../data/nodes.json";
import pipesRaw from "../data/pipes.json";
import valvesRaw from "../data/valves.json";
import reservoirsRaw from "../data/reservoirs.json";
import overflowRaw from "../data/overflow.json";

/**
 * Convert our custom JSON format into standard GeoJSON FeatureCollections.
 * - Points (nodes, valves): geographic is [lng, lat]
 * - MultiLineString (pipes): geographic is [[[lng,lat], ...], ...]
 * - MultiPolygon (reservoirs, overflow): geographic is [[[[lng,lat], ...]], ...]
 */
function toGeoJSON(items) {
  return {
    type: "FeatureCollection",
    features: items.map((item) => ({
      type: "Feature",
      properties: { ...item.properties },
      geometry: {
        type: item.geometry.type,
        coordinates: item.geometry.geographic,
      },
    })),
  };
}

export const nodes = toGeoJSON(nodesRaw);
export const pipes = toGeoJSON(pipesRaw);
export const valves = toGeoJSON(valvesRaw);
export const reservoirs = toGeoJSON(reservoirsRaw);
export const overflow = toGeoJSON(overflowRaw);
