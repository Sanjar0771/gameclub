'use client';

import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import Link from 'next/link';
import { useEffect } from 'react';

// Default ikonkani moslab olish
const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

interface Branch {
  id: string;
  name: string;
  address?: string;
  latitude?: number | null;
  longitude?: number | null;
  minPrice: number | null;
}

export default function MapView({ center, branches }: { center: [number, number]; branches: Branch[] }) {
  return (
    <MapContainer center={center} zoom={13} style={{ width: '100%', height: '100%' }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <UserMarker position={center} />
      {branches
        .filter((b) => b.latitude && b.longitude)
        .map((b) => (
          <Marker key={b.id} position={[b.latitude!, b.longitude!]}>
            <Popup>
              <div className="min-w-[160px]">
                <div className="font-semibold">{b.name}</div>
                {b.address && <div className="text-xs text-gray-600">{b.address}</div>}
                {b.minPrice && (
                  <div className="text-xs mt-1">dan {b.minPrice.toLocaleString('ru-RU')} so'm</div>
                )}
                <Link
                  href={`/customer/branch/${b.id}`}
                  className="block mt-2 text-center bg-blue-500 text-white py-1.5 rounded-lg text-sm"
                >
                  Ko'rish
                </Link>
              </div>
            </Popup>
          </Marker>
        ))}
    </MapContainer>
  );
}

function UserMarker({ position }: { position: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(position);
  }, [map, position]);

  const icon = L.divIcon({
    className: '',
    html: '<div style="width: 16px; height: 16px; background: #3390ec; border: 3px solid white; border-radius: 50%; box-shadow: 0 0 0 2px #3390ec;"></div>',
    iconSize: [16, 16],
  });
  return <Marker position={position} icon={icon} />;
}
