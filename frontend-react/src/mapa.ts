import type { StyleSpecification } from "maplibre-gl";

export const ESTILO_MAPA: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tileSize: 256,
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      attribution: "© OpenStreetMap",
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
};