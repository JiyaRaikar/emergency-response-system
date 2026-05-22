const ZONE_COORDS = {
  north: [40.82, -74.02],
  east: [40.72, -73.92],
  central: [40.76, -73.98],
  south: [40.68, -74.02],
  west: [40.74, -74.08],
}

export function zoneToLatLng(zone, id = 0) {
  const key = (zone || 'central').toLowerCase().trim()
  const base = ZONE_COORDS[key] ?? ZONE_COORDS.central
  const jitter = ((id % 7) - 3) * 0.008
  const jitterLng = (((id * 3) % 7) - 3) * 0.008
  return [base[0] + jitter, base[1] + jitterLng]
}
