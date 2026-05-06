import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { MapPin } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useManager } from './src/context/ManagerContext';
import { getZoneWorkers } from './src/services/managerApi';

interface WorkerMarker {
  id: string;
  lat: number;
  lng: number;
  name: string;
  riskLevel: 'low' | 'medium' | 'high';
  status: 'active' | 'inactive';
}

// Known centroids for each zone (fallback for worker scatter)
const ZONE_CENTROIDS: Record<string, [number, number]> = {
  Hebbal:        [13.0356, 77.5970],
  Sanganer:      [26.8401, 75.8060],
  Mehdipatnam:   [17.3887, 78.4420],
  Dadar:         [19.0219, 72.8438],
  Koramangala:   [12.9352, 77.6245],
  Bellandur:     [12.9259, 77.6762],
  'Andheri-W':   [19.1360, 72.8296],
  'Bandra-E':    [19.0596, 72.8547],
  Goregaon:      [19.1663, 72.8526],
};

const getRiskColor = (riskLevel: string): string => {
  switch (riskLevel) {
    case 'low':    return '#7A9F8C';
    case 'medium': return '#8B7355';
    case 'high':   return '#A55F4F';
    default:       return '#999999';
  }
};

const ManagerZoneMap: React.FC = () => {
  const { profile, stats } = useManager();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  const primaryZone = profile?.assigned_zones?.[0] ?? '';
  // Use dark store coords from profile if available, else fall back to zone centroid
  const darkStoreLat = profile?.dark_store_lat ?? ZONE_CENTROIDS[primaryZone]?.[0] ?? 12.9716;
  const darkStoreLng = profile?.dark_store_lng ?? ZONE_CENTROIDS[primaryZone]?.[1] ?? 77.5946;
  const darkStoreAddress = profile?.dark_store_address ?? `${primaryZone} Dark Store`;

  useEffect(() => {
    if (!mapRef.current) return;

    // Init map once
    if (!mapInstanceRef.current) {
      const map = L.map(mapRef.current).setView([darkStoreLat, darkStoreLng], 13);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 19,
      }).addTo(map);

      mapInstanceRef.current = map;
      markersLayerRef.current = L.layerGroup().addTo(map);
    }

    const map = mapInstanceRef.current!;
    const layer = markersLayerRef.current!;

    // Re-center on dark store whenever profile loads
    map.setView([darkStoreLat, darkStoreLng], 13);
    layer.clearLayers();

    // Dark store pin
    const darkStoreIcon = L.divIcon({
      html: `<div style="
        width:32px;height:32px;border-radius:50%;
        background:#000;border:3px solid #fff;
        box-shadow:0 2px 8px rgba(0,0,0,0.4);
        display:flex;align-items:center;justify-content:center;
      ">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0116 0z"/><circle cx="12" cy="10" r="3"/></svg>
      </div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
      className: '',
    });

    L.marker([darkStoreLat, darkStoreLng], { icon: darkStoreIcon })
      .addTo(layer)
      .bindPopup(
        `<div style="font-weight:700;font-size:0.875rem;">${darkStoreAddress}</div>
         <div style="font-size:0.75rem;color:#666;margin-top:4px;">Dark Store — Zone: ${primaryZone}</div>`
      );

    // Fetch & plot real workers
    if (primaryZone) {
      getZoneWorkers(primaryZone)
        .then((workers) => {
          const LAT_PER_KM = 0.0090;
          const LNG_PER_KM = 0.0113;

          workers.forEach((w, i) => {
            const angle = (i * 137.5) % 360;
            const dist = 1.0 + (i % 5) * 0.7;
            const lat = darkStoreLat + dist * Math.cos((angle * Math.PI) / 180) * LAT_PER_KM;
            const lng = darkStoreLng + dist * Math.sin((angle * Math.PI) / 180) * LNG_PER_KM;

            const score = w.fraud_risk_score ?? 0;
            const riskLevel = score < 0.3 ? 'low' : score < 0.7 ? 'medium' : 'high';
            const color = getRiskColor(riskLevel);
            const isActive = !!w.kyc_verified;

            const marker = L.circleMarker([lat, lng], {
              radius: 6,
              fillColor: color,
              color: isActive ? color : '#ccc',
              weight: 2,
              opacity: isActive ? 1 : 0.5,
              fillOpacity: isActive ? 0.8 : 0.4,
            }).addTo(layer);

            marker.bindPopup(
              `<div style="font-weight:700;font-size:0.875rem;">${w.worker_name ?? 'Worker'}</div>
               <div style="font-size:0.75rem;color:#666;margin-top:4px;">
                 ID: ${w.worker_id}<br/>
                 Platform: ${w.platform ?? '—'}<br/>
                 Risk: <span style="color:${color}">${riskLevel.toUpperCase()}</span><br/>
                 Policy: ${w.policy_status ?? 'none'}
               </div>`
            );
          });
        })
        .catch(() => {
          // silently fall back — map still shows dark store pin
        });
    }
  }, [darkStoreLat, darkStoreLng, primaryZone, darkStoreAddress]);

  const totalWorkers = stats?.total_active_workers ?? 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white p-6 rounded-lg"
      style={{ border: '1px solid #e8e8e8', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
    >
      <div className="flex items-center justify-between mb-4">
        <h2
          className="font-display"
          style={{ fontSize: '1.6875rem', fontWeight: 700, color: '#000000' }}
        >
          Zone Map
        </h2>
        {darkStoreAddress && (
          <div className="flex items-center space-x-1" style={{ color: '#666' }}>
            <MapPin className="w-4 h-4" />
            <span style={{ fontSize: '0.8125rem' }}>{darkStoreAddress}</span>
          </div>
        )}
      </div>

      {/* Map */}
      <div
        ref={mapRef}
        className="rounded-lg mb-4"
        style={{
          height: '400px',
          backgroundColor: '#f5f5f5',
          border: '1px solid #e8e8e8',
          zIndex: 0,
        }}
      />

      {/* Legend */}
      <div className="border-t" style={{ borderColor: '#e8e8e8', paddingTop: '1rem' }}>
        <p
          className="ui-text"
          style={{ color: '#000000', fontWeight: 700, marginBottom: '0.75rem' }}
        >
          {primaryZone} • {totalWorkers > 0 ? `${totalWorkers} Active Workers` : 'Workers loading…'}
        </p>

        <div className="grid grid-cols-3 gap-4 mt-4">
          {[
            { label: 'Low Risk', color: '#7A9F8C' },
            { label: 'Med Risk', color: '#8B7355' },
            { label: 'High Risk', color: '#A55F4F' },
          ].map(({ label, color }) => (
            <div key={label} className="flex items-center space-x-3">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
              <p className="ui-label" style={{ color: '#666666' }}>{label}</p>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
};

export default ManagerZoneMap;
