import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

// Dark store location (Andheri West, Mumbai)
const DARK_STORE_LAT = 19.1199;
const DARK_STORE_LNG = 72.8465;
const ZONE_RADIUS_METERS = 3000;

// Mock worker data with delivery routes
const WORKER_LOCATIONS = [
  {
    id: 1024,
    name: "Raj Kumar",
    lat: 19.1348,
    lng: 72.8289,
    status: "online",
    route: [
      { lat: 19.1199, lng: 72.8465 }, // Dark store
      { lat: 19.125, lng: 72.84 }, // Route point 1
      { lat: 19.13, lng: 72.835 }, // Route point 2
      { lat: 19.1348, lng: 72.8289 }, // Worker location
    ],
    blocked: false,
  },
  {
    id: 1025,
    name: "Priya Sharma",
    lat: 19.095,
    lng: 72.865,
    status: "offline",
    route: [
      { lat: 19.1199, lng: 72.8465 }, // Dark store
      { lat: 19.11, lng: 72.855 }, // Route point 1 (BLOCKED)
      { lat: 19.105, lng: 72.86 }, // Route point 2
      { lat: 19.095, lng: 72.865 }, // Worker location
    ],
    blocked: true,
  },
  {
    id: 1026,
    name: "Amit Patel",
    lat: 19.15,
    lng: 72.82,
    status: "online",
    route: [
      { lat: 19.1199, lng: 72.8465 }, // Dark store
      { lat: 19.135, lng: 72.835 }, // Route point 1
      { lat: 19.142, lng: 72.827 }, // Route point 2
      { lat: 19.15, lng: 72.82 }, // Worker location
    ],
    blocked: true,
  },
  {
    id: 1027,
    name: "Sneha Reddy",
    lat: 19.105,
    lng: 72.87,
    status: "online",
    route: [
      { lat: 19.1199, lng: 72.8465 }, // Dark store
      { lat: 19.115, lng: 72.855 }, // Route point 1
      { lat: 19.11, lng: 72.862 }, // Route point 2
      { lat: 19.105, lng: 72.87 }, // Worker location
    ],
    blocked: false,
  },
  {
    id: 1028,
    name: "Vikram Singh",
    lat: 19.125,
    lng: 72.875,
    status: "offline",
    route: [
      { lat: 19.1199, lng: 72.8465 }, // Dark store
      { lat: 19.118, lng: 72.86 }, // Route point 1 (BLOCKED)
      { lat: 19.121, lng: 72.868 }, // Route point 2
      { lat: 19.125, lng: 72.875 }, // Worker location
    ],
    blocked: true,
  },
];

// Google Maps dark theme styles
const DARK_MAP_STYLES: any[] = [
  { elementType: "geometry", stylers: [{ color: "#f5f5f5" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "on" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#f5f5f5" }] },
  {
    featureType: "administrative",
    elementType: "geometry",
    stylers: [{ color: "#e0e0e0" }],
  },
  {
    featureType: "poi",
    elementType: "geometry",
    stylers: [{ color: "#eeeeee" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#ffffff" }],
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: "#cccccc" }],
  },
  {
    featureType: "road.arterial",
    elementType: "geometry",
    stylers: [{ color: "#ffffff" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#fafafa" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#c9e4f7" }],
  },
];

// Access Google Maps SDK
const G = (): any => (window as any).google?.maps;

const WorkerLiveMap: React.FC = () => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [workers, setWorkers] = useState(WORKER_LOCATIONS);

  useEffect(() => {
    let attempts = 0;
    const maxAttempts = 40;

    const init = () => {
      const maps = G();
      if (maps && mapRef.current) {
        try {
          // Initialize map
          const map = new maps.Map(mapRef.current, {
            center: { lat: DARK_STORE_LAT, lng: DARK_STORE_LNG },
            zoom: 13,
            styles: DARK_MAP_STYLES,
            disableDefaultUI: false,
            zoomControl: true,
            mapTypeControl: true,
            streetViewControl: false,
            fullscreenControl: false,
            gestureHandling: "cooperative",
          });

          // Add dark store marker
          new maps.Marker({
            position: { lat: DARK_STORE_LAT, lng: DARK_STORE_LNG },
            map,
            title: "Dark Store - Andheri West",
            icon: {
              path: maps.SymbolPath.CIRCLE,
              scale: 12,
              fillColor: "#1f2937",
              fillOpacity: 1,
              strokeColor: "#ffffff",
              strokeWeight: 2,
            },
          });

          // Add zone circle
          new maps.Circle({
            map,
            center: { lat: DARK_STORE_LAT, lng: DARK_STORE_LNG },
            radius: ZONE_RADIUS_METERS,
            fillColor: "#3b82f6",
            fillOpacity: 0.1,
            strokeColor: "#3b82f6",
            strokeOpacity: 0.3,
            strokeWeight: 2,
          });

          // Add worker markers and routes
          workers.forEach((worker) => {
            // Worker marker
            const markerColor =
              worker.status === "online" ? "#10b981" : "#6b7280";
            const marker = new maps.Marker({
              position: { lat: worker.lat, lng: worker.lng },
              map,
              title: `${worker.name} - ${worker.status}`,
              icon: {
                path: maps.SymbolPath.CIRCLE,
                scale: 8,
                fillColor: markerColor,
                fillOpacity: 1,
                strokeColor: "#ffffff",
                strokeWeight: 2,
              },
            });

            // Add info window
            const infoWindow = new maps.InfoWindow({
              content: `
                <div style="padding: 8px; font-family: system-ui;">
                  <h4 style="margin: 0 0 4px 0; color: #1f2937; font-weight: bold;">${worker.name}</h4>
                  <p style="margin: 0; color: #6b7280; font-size: 12px;">Status: ${worker.status}</p>
                  <p style="margin: 0; color: ${worker.blocked ? "#ef4444" : "#10b981"}; font-size: 12px;">
                    Route: ${worker.blocked ? "BLOCKED" : "CLEAR"}
                  </p>
                </div>
              `,
            });

            marker.addListener("click", () => {
              infoWindow.open(map, marker);
            });

            // Draw delivery route
            if (worker.route && worker.route.length > 1) {
              const routeColor = worker.blocked ? "#ef4444" : "#10b981";
              const routeOpacity = worker.blocked ? 0.7 : 0.5;

              new maps.Polyline({
                path: worker.route,
                map,
                geodesic: true,
                strokeColor: routeColor,
                strokeOpacity: routeOpacity,
                strokeWeight: worker.blocked ? 4 : 3,
              });

              // Add route markers for blocked sections
              if (worker.blocked && worker.route.length > 2) {
                // Mark blocked route points
                for (let i = 1; i < worker.route.length - 1; i++) {
                  new maps.Marker({
                    position: worker.route[i],
                    map,
                    icon: {
                      path: maps.SymbolPath.CIRCLE,
                      scale: 6,
                      fillColor: "#ef4444",
                      fillOpacity: 1,
                      strokeColor: "#ffffff",
                      strokeWeight: 2,
                    },
                    title: "Route Blockage",
                  });
                }
              }
            }
          });

          setMapReady(true);
        } catch (error) {
          console.error("Error initializing map:", error);
          setMapError(true);
        }
      } else if (attempts < maxAttempts) {
        attempts++;
        setTimeout(init, 250);
      } else {
        setMapError(true);
      }
    };

    init();
  }, [workers]);

  // Simulate real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      setWorkers((prev) =>
        prev.map((worker) => ({
          ...worker,
          status:
            Math.random() > 0.8
              ? worker.status === "online"
                ? "offline"
                : "online"
              : worker.status,
          blocked: Math.random() > 0.7 ? !worker.blocked : worker.blocked,
        })),
      );
    }, 15000); // Update every 15 seconds

    return () => clearInterval(interval);
  }, []);

  const blockedCount = workers.filter((w) => w.blocked).length;
  const totalCount = workers.length;
  const blockagePercentage = (blockedCount / totalCount) * 100;

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-900">Worker Delivery Routes</h3>
          <div className="flex items-center space-x-4 text-sm">
            <div className="flex items-center">
              <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
              <span className="text-gray-600">Clear</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
              <span className="text-gray-600">Blocked</span>
            </div>
          </div>
        </div>
      </div>

      <div ref={mapRef} className="h-96 relative">
        {!mapReady && !mapError && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
              <p className="text-gray-600 font-medium">Loading Map...</p>
            </div>
          </div>
        )}

        {mapError && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-gray-400 text-2xl">!</span>
              </div>
              <p className="text-gray-600 font-medium">Map unavailable</p>
              <p className="text-gray-500 text-sm">
                Please check your internet connection
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Route Statistics */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div className="text-center">
            <p className="font-bold text-gray-900">{totalCount}</p>
            <p className="text-gray-600">Total Workers</p>
          </div>
          <div className="text-center">
            <p
              className={`font-bold ${blockedCount > 0 ? "text-red-600" : "text-green-600"}`}
            >
              {blockedCount}
            </p>
            <p className="text-gray-600">Blocked Routes</p>
          </div>
          <div className="text-center">
            <p
              className={`font-bold ${blockagePercentage > 60 ? "text-red-600" : "text-green-600"}`}
            >
              {blockagePercentage.toFixed(0)}%
            </p>
            <p className="text-gray-600">Blockage Rate</p>
          </div>
        </div>

        {blockagePercentage > 60 && (
          <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded">
            <p className="text-red-800 text-sm font-medium">
              Alert: {blockagePercentage.toFixed(0)}% of routes blocked -
              Consider flagging disruption
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkerLiveMap;
