// utils/geometry.js

/**
 * Compute approximate area of a polygon in square kilometres using the shoelace formula.
 * The polygon must be a closed ring (first and last point are the same).
 * Input: array of [lng, lat] coordinates.
 * Returns: area in km² (approximate, but consistent for ordering).
 */
export function computePolygonArea(coords) {
  if (!coords || coords.length < 3) return 0;

  let area = 0;
  const n = coords.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += coords[i][0] * coords[j][1];
    area -= coords[j][0] * coords[i][1];
  }
  area = Math.abs(area) / 2;

  // Convert square degrees to km² (1° ≈ 111 km at equator).
  // This is a crude approximation but sufficient for ordering polygons by size.
  const degToKm = 111;
  return area * degToKm * degToKm;
}