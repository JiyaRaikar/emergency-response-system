import { useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import { zoneToLatLng } from '../utils/zones'

const incidentIcon = L.divIcon({
  className: 'incident-marker',
  html: '<div style="width:14px;height:14px;background:#ef4444;border:2px solid #fff;border-radius:50%;box-shadow:0 0 8px #ef4444"></div>',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
})

const resourceIcon = L.divIcon({
  className: 'resource-marker',
  html: '<div style="width:14px;height:14px;background:#3b82f6;border:2px solid #fff;border-radius:50%;box-shadow:0 0 8px #3b82f6"></div>',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
})

export default function IncidentMap({ incidents = [], resources = [] }) {
  const center = useMemo(() => [40.76, -73.98], [])

  return (
    <div className="h-full min-h-[320px] w-full overflow-hidden rounded-xl border border-slate-700">
      <MapContainer
        center={center}
        zoom={11}
        scrollWheelZoom
        className="h-full w-full"
        style={{ minHeight: 320, background: '#0f172a' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        {incidents.map((inc) => {
          const pos = zoneToLatLng(inc.location_zone, inc.id)
          return (
            <Marker key={`inc-${inc.id}`} position={pos} icon={incidentIcon}>
              <Popup>
                <div className="text-sm text-slate-900">
                  <strong>{inc.type}</strong>
                  <br />
                  Zone: {inc.location_zone}
                  <br />
                  Severity: {inc.severity}
                </div>
              </Popup>
            </Marker>
          )
        })}
        {resources.map((res) => {
          const pos = zoneToLatLng(res.location_zone, res.id + 100)
          return (
            <Marker key={`res-${res.id}`} position={pos} icon={resourceIcon}>
              <Popup>
                <div className="text-sm text-slate-900">
                  <strong>{res.type}</strong>
                  <br />
                  Zone: {res.location_zone}
                  <br />
                  Status: {res.status}
                </div>
              </Popup>
            </Marker>
          )
        })}
      </MapContainer>
    </div>
  )
}
