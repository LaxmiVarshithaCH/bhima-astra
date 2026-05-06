import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

import {
  AlertTriangle,
  MapPin,
  Camera,
  Clock,
  Upload,
  Send,
  ArrowLeft,
  CheckCircle,
  XCircle,
  Loader,
  Route,
  Users,
  Navigation,
  MapIcon,
  Zap,
  AlertCircle,
  Edit3,
  Trash2,
} from "lucide-react";
import L from "leaflet";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  Polygon,
  Popup,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import {
  fetchDeliveryPartners,
  fetchDisruptions,
} from "./src/services/disruptionApi";

delete (L.Icon.Default.prototype as any)._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
});

// Bike icon for workers - opaque SVG with proper styling
const bikeIcon = L.icon({
  iconUrl:
    "data:image/svg+xml;utf8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22%3E%3Ccircle cx=%2212%22 cy=%2212%22 r=%2212%22 fill=%22%234B5563%22 opacity=%220.85%22/%3E%3Cg stroke=%22%23FFFFFF%22 stroke-width=%221.5%22 fill=%22none%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22%3E%3Ccircle cx=%225%22 cy=%2216%22 r=%223%22/%3E%3Ccircle cx=%2219%22 cy=%2216%22 r=%223%22/%3E%3Cpath d=%22M7 5l6 6M11 11l6-6m-3 3h3v3L15 8%22/%3E%3Cpath d=%22M12 11v5l1 3M8 9h5l4 7%22/%3E%3C/g%3E%3C/svg%3E",
  iconSize: [40, 40],
  iconAnchor: [20, 40],
  popupAnchor: [0, -40],
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
  shadowSize: [41, 41],
  shadowAnchor: [12, 40],
});

// Map pointer icons for start/end points
const startPointIcon = L.icon({
  iconUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const endPointIcon = L.icon({
  iconUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});
// Interfaces for our data structures
interface DeliveryPartner {
  id: number;
  name: string;
  worker_id: string;
  lat: number;
  lng: number;
  status: "online" | "offline";
  current_route: {
    id: string;
    name: string;
    coordinates: [number, number][];
    blocked: boolean;
  };
  alternative_route?: {
    id: string;
    name: string;
    coordinates: [number, number][];
    estimated_time: number;
    is_feasible: boolean; // Track if alternative route is feasible
  };
  has_alternative_route?: boolean; // Flag to track if worker has viable alternative
  needs_payout_flag?: boolean; // Flag to track if flag request needed for this worker
}

interface DisruptionFlag {
  id: string;
  zone_id: string;
  disruption_type: "curfew" | "strike" | "road_blockage" | "protests";
  description: string;
  evidence_url: string;
  estimated_start: string;
  estimated_end: string;
  status: "pending" | "approved" | "rejected";
  affected_routes: string[];
  created_at: string;
  coordinates?: [number, number][];
  workers_with_alternatives: string[]; // Workers with alternative routes (no payout)
  workers_without_alternatives: string[]; // Workers needing payout flag request
  affected_workers_count: number; // Total affected workers without alternatives
  affected_workers_details?: Array<{
    worker_id: string;
    worker_name: string;
    status: string;
    route_name: string;
  }>;
  payout_flag_requests?: Array<{
    worker_id: string;
    worker_name: string;
    reason: string;
    status: "pending" | "approved" | "rejected";
  }>;
}

interface DisruptionZone {
  id: string;
  type: "rectangle" | "circle" | "polygon";
  coordinates: [number, number][];
  disruption_type: string;
}

// Mock data - easily changeable
// Dark Store: 19.0760, 72.8777 (Andheri West, Mumbai)
// 5-6 km radius radius: ~0.045° lat, ~0.059° lng
const MOCK_DELIVERY_PARTNERS: DeliveryPartner[] = [
  {
    id: 1,
    name: "Raj Kumar",
    worker_id: "1024",
    lat: 19.088,
    lng: 72.865,
    status: "online",
    current_route: {
      id: "route-1",
      name: "Dark Store -> Andheri West -> Lokhandwala",
      coordinates: [
        [19.076, 72.8777], // Dark Store
        [19.088, 72.865], // Checkpoint 1
        [19.095, 72.85], // End
      ],
      blocked: false,
    },
  },
  {
    id: 2,
    name: "Priya Sharma",
    worker_id: "1025",
    lat: 19.082,
    lng: 72.892,
    status: "online",
    current_route: {
      id: "route-2",
      name: "Dark Store -> Andheri East -> Ghatkopar",
      coordinates: [
        [19.076, 72.8777], // Dark Store
        [19.082, 72.892], // Checkpoint 1
        [19.095, 72.91], // End
      ],
      blocked: true,
    },
  },
  {
    id: 3,
    name: "Amit Patel",
    worker_id: "1026",
    lat: 19.105,
    lng: 72.855,
    status: "offline",
    current_route: {
      id: "route-3",
      name: "Dark Store -> Versova -> Madh Island",
      coordinates: [
        [19.076, 72.8777], // Dark Store
        [19.105, 72.855], // Checkpoint 1
        [19.12, 72.835], // End
      ],
      blocked: true,
    },
  },
  {
    id: 4,
    name: "Sneha Reddy",
    worker_id: "1027",
    lat: 19.095,
    lng: 72.885,
    status: "online",
    current_route: {
      id: "route-4",
      name: "Dark Store -> Bandra -> Khar",
      coordinates: [
        [19.076, 72.8777], // Dark Store
        [19.095, 72.885], // Checkpoint 1
        [19.11, 72.87], // End
      ],
      blocked: false,
    },
  },
  {
    id: 5,
    name: "Vikram Singh",
    worker_id: "1028",
    lat: 19.115,
    lng: 72.89,
    status: "online",
    current_route: {
      id: "route-5",
      name: "Dark Store -> Santacruz -> Juhu",
      coordinates: [
        [19.076, 72.8777], // Dark Store
        [19.1, 72.89], // Checkpoint 1
        [19.115, 72.89], // End
      ],
      blocked: true,
    },
  },
  {
    id: 6,
    name: "Deepak Gupta",
    worker_id: "1029",
    lat: 19.068,
    lng: 72.89,
    status: "online",
    current_route: {
      id: "route-6",
      name: "Dark Store -> Mahim -> Bandra West",
      coordinates: [
        [19.076, 72.8777], // Dark Store
        [19.068, 72.89], // Checkpoint 1
        [19.055, 72.9], // End
      ],
      blocked: false,
    },
  },
  {
    id: 7,
    name: "Manisha Desai",
    worker_id: "1030",
    lat: 19.072,
    lng: 72.855,
    status: "online",
    current_route: {
      id: "route-7",
      name: "Dark Store -> Andheri South -> Oshiwara",
      coordinates: [
        [19.076, 72.8777], // Dark Store
        [19.072, 72.855], // Checkpoint 1
        [19.065, 72.835], // End
      ],
      blocked: false,
    },
  },
  {
    id: 8,
    name: "Sanjay Rao",
    worker_id: "1031",
    lat: 19.105,
    lng: 72.9,
    status: "online",
    current_route: {
      id: "route-8",
      name: "Dark Store -> DN Nagar -> Linking Road",
      coordinates: [
        [19.076, 72.8777], // Dark Store
        [19.09, 72.905], // Checkpoint 1
        [19.105, 72.9], // End
      ],
      blocked: true,
    },
  },
  {
    id: 9,
    name: "Kavya Nair",
    worker_id: "1032",
    lat: 19.087,
    lng: 72.842,
    status: "online",
    current_route: {
      id: "route-9",
      name: "Dark Store -> Four Bungalows -> Juhu Beach",
      coordinates: [
        [19.076, 72.8777], // Dark Store
        [19.087, 72.842], // Checkpoint 1
        [19.1, 72.82], // End
      ],
      blocked: false,
    },
  },
  {
    id: 10,
    name: "Rohan Pandya",
    worker_id: "1033",
    lat: 19.12,
    lng: 72.865,
    status: "online",
    current_route: {
      id: "route-10",
      name: "Dark Store -> Vile Parle -> Chakala",
      coordinates: [
        [19.076, 72.8777], // Dark Store
        [19.105, 72.86], // Checkpoint 1
        [19.12, 72.865], // End
      ],
      blocked: true,
    },
  },
];

const MOCK_DISRUPTIONS: DisruptionFlag[] = [
  {
    id: "disruption-1",
    zone_id: "MUM-WEST-01",
    disruption_type: "road_blockage",
    description: "NH8 Blockage near Andheri flyover - traffic congestion",
    evidence_url: "https://example.com/evidence1.jpg",
    estimated_start: "2026-04-15T13:30:00Z",
    estimated_end: "2026-04-15T18:30:00Z",
    status: "approved",
    affected_routes: ["route-2", "route-3", "route-5"],
    created_at: "2026-04-15T13:30:00Z",
    coordinates: [
      [19.089, 72.865],
      [19.11, 72.88],
    ],
    workers_with_alternatives: ["Priya Sharma", "Sneha Reddy"],
    workers_without_alternatives: ["Amit Patel"],
    affected_workers_count: 1,
    affected_workers_details: [
      {
        worker_id: "1026",
        worker_name: "Amit Patel",
        status: "offline",
        route_name: "Dark Store -> Versova -> Madh Island",
      },
    ],
    payout_flag_requests: [
      {
        worker_id: "1026",
        worker_name: "Amit Patel",
        reason:
          "No viable alternative route available. Compensation approved: ₹600",
        status: "approved",
      },
    ],
  },
];

const FlagDisruption: React.FC = () => {
  const [movingIndex, setMovingIndex] = useState(0);
  const navigate = useNavigate();

  // Get manager info from localStorage (set during login)
  const managerId = parseInt(
    localStorage.getItem("bhima_manager_id") || "1",
    10,
  );
  const managerZones: string[] = (() => {
    try {
      return JSON.parse(
        localStorage.getItem("bhima_manager_zones") || '["Vasant Kunj"]',
      );
    } catch {
      return ["Vasant Kunj"];
    }
  })();
  const primaryZone = managerZones[0] ?? "Vasant Kunj";

  // Seed dark store center from localStorage profile (written at login)
  const _seedDarkStore = (() => {
    try {
      const lat = parseFloat(localStorage.getItem("bhima_manager_dark_store_lat") || "0");
      const lng = parseFloat(localStorage.getItem("bhima_manager_dark_store_lng") || "0");
      if (lat && lng) return [lat, lng] as [number, number];
    } catch { /* ignore */ }
    return [13.0356, 77.5970] as [number, number]; // Bangalore fallback
  })();

  // Track dark store center dynamically (updated when API data loads)
  const darkStoreCenterRef = useRef<[number, number]>(_seedDarkStore);

  // Start with empty list — API will populate with correctly-spread workers
  const [deliveryPartners, setDeliveryPartners] = useState<DeliveryPartner[]>([]);
  const [disruptions, setDisruptions] =
    useState<DisruptionFlag[]>(MOCK_DISRUPTIONS);
  const [selectedDisruption, setSelectedDisruption] = useState<string | null>(
    null,
  );
  const [isSelectingRoute, setIsSelectingRoute] = useState(false);
  const [selectedRoutes, setSelectedRoutes] = useState<string[]>([]);
  const [hoveredRoute, setHoveredRoute] = useState<string | null>(null);
  // Open the map centered on the manager's actual dark store immediately
  const [mapCenter, setMapCenter] = useState<[number, number]>(_seedDarkStore);
  const [mapZoom, setMapZoom] = useState(12);

  const [selectionMode, setSelectionMode] = useState<"none" | "start" | "end">(
    "none",
  );
  const [startPoint, setStartPoint] = useState<[number, number] | null>(null);
  const [endPoint, setEndPoint] = useState<[number, number] | null>(null);
  const [disruptionRoutes, setDisruptionRoutes] = useState<
    RouteResponse["routes"]
  >([]);
  const [isFetchingRoutes, setIsFetchingRoutes] = useState(false);
  const [selectedDisruptionRoute, setSelectedDisruptionRoute] =
    useState<number>(0);
  // Form state
  const [formData, setFormData] = useState({
    zone_id: primaryZone,
    disruption_type: "road_blockage" as const,
    description: "",
    evidence_url: "",
    estimated_start: "",
    estimated_end: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingPartners, setIsLoadingPartners] = useState(true);
  const [routeCheckResult, setRouteCheckResult] = useState<{
    feasible: boolean;
    result: string;
    workers_in_zone: number;
    estimated_payout: number;
    affected_partners: string[];
    affected_count: number;
  } | null>(null);

  // Fetch delivery partners and disruptions from API on component mount
  useEffect(() => {
    const loadData = async () => {
      const [partners, flags] = await Promise.all([
        fetchDeliveryPartners(primaryZone),
        fetchDisruptions(primaryZone),
      ]);

      // ── Spread partners properly from the zone's dark store ──────────────
      // The API already returns lat/lng but they may cluster. Re-spread them
      // 0.5–5 km from their centroid in all directions.
      if (partners.length > 0) {
        const LAT_PER_KM = 0.0090;
        const LNG_PER_KM = 0.0113;

        // Use mean of API positions as the dark store center
        const centerLat = partners.reduce((s, p) => s + p.lat, 0) / partners.length;
        const centerLng = partners.reduce((s, p) => s + p.lng, 0) / partners.length;
        darkStoreCenterRef.current = [centerLat, centerLng];
        setMapCenter([centerLat, centerLng]);

        const spread = partners.map((p, i) => {
          // Use prime-step angle so no two workers overlap direction
          const angleDeg = (i * 97.3) % 360;
          const angleRad = (angleDeg * Math.PI) / 180;
          // Spread evenly from 0.8 km to 4.8 km
          const distKm = 0.8 + (i / Math.max(partners.length - 1, 1)) * 4.0
            + ((p.id % 7) * 0.08); // small stable jitter per worker id
          const clampedDist = Math.min(5.0, distKm);

          const lat = centerLat + clampedDist * Math.cos(angleRad) * LAT_PER_KM;
          const lng = centerLng + clampedDist * Math.sin(angleRad) * LNG_PER_KM;

          // Build a route: dark store → worker position → delivery endpoint
          const endLat = centerLat + (clampedDist + 0.5) * Math.cos(angleRad) * LAT_PER_KM;
          const endLng = centerLng + (clampedDist + 0.5) * Math.sin(angleRad) * LNG_PER_KM;

          return {
            ...p,
            lat: parseFloat(lat.toFixed(6)),
            lng: parseFloat(lng.toFixed(6)),
            current_route: {
              ...p.current_route,
              coordinates: [
                [centerLat, centerLng] as [number, number],
                [lat, lng] as [number, number],
                [endLat, endLng] as [number, number],
              ],
              blocked: p.current_route?.blocked ?? false,
            },
          };
        });

        setDeliveryPartners(spread);
      } else {
        setDeliveryPartners(partners);
      }

      setDisruptions(flags);
      setIsLoadingPartners(false);
    };

    loadData();
  }, [primaryZone]);

  useEffect(() => {
    const interval = setInterval(() => {
      document.querySelectorAll(".animated-route").forEach((path: any) => {
        const current = path.style.strokeDashoffset || 0;
        path.style.strokeDashoffset = parseFloat(current) - 2;
      });
    }, 50);

    return () => clearInterval(interval);
  }, []);
  // ── Smooth directional delivery movement ─────────────────────────────────
  // Each worker moves toward their delivery endpoint and reverses — simulates
  // actual delivery round-trips at ~0.3 km/tick.
  const moveDirRef = useRef<Record<string, 1 | -1>>({});

  useEffect(() => {
    const interval = setInterval(() => {
      const [storeLat, storeLng] = darkStoreCenterRef.current;
      const LAT_PER_KM = 0.0090;
      const LNG_PER_KM = 0.0113;
      const MAX_DIST_KM = 5.0;
      const STEP_KM = 0.10; // ~100 m per tick — slow, realistic delivery speed

      setDeliveryPartners((prev) =>
        prev.map((partner) => {
          if (partner.status === "offline") return partner;

          // Direction: +1 = moving away from store, -1 = returning
          const dir: 1 | -1 = moveDirRef.current[partner.worker_id] ?? 1;

          // Current distance from dark store
          const dLat = partner.lat - storeLat;
          const dLng = partner.lng - storeLng;
          const distKm = Math.sqrt(
            (dLat / LAT_PER_KM) ** 2 + (dLng / LNG_PER_KM) ** 2,
          );

          // Reverse direction at boundaries
          if (distKm >= MAX_DIST_KM && dir === 1) {
            moveDirRef.current[partner.worker_id] = -1;
          } else if (distKm <= 0.4 && dir === -1) {
            moveDirRef.current[partner.worker_id] = 1;
          }

          const currentDir = moveDirRef.current[partner.worker_id] ?? dir;

          // Move along the radial direction from dark store
          const angle = Math.atan2(dLng / LNG_PER_KM, dLat / LAT_PER_KM);
          const stepLat = STEP_KM * Math.cos(angle) * LAT_PER_KM * currentDir;
          const stepLng = STEP_KM * Math.sin(angle) * LNG_PER_KM * currentDir;

          const newLat = partner.lat + stepLat;
          const newLng = partner.lng + stepLng;

          return {
            ...partner,
            lat: parseFloat(newLat.toFixed(6)),
            lng: parseFloat(newLng.toFixed(6)),
          };
        }),
      );
    }, 2000); // tick every 2 seconds — smooth but not frantic

    return () => clearInterval(interval);
  }, []);

  // Calculate alternative routes for blocked routes - WITH FEASIBILITY CHECK
  const calculateAlternativeRoute = useCallback(
    (
      originalRoute: [number, number][],
    ): { route: [number, number][]; is_feasible: boolean } => {
      // Check if alternative route is feasible (mock: 70% success rate)
      const is_feasible = Math.random() > 0.3;

      if (!is_feasible) {
        // If not feasible, return empty but mark as infeasible
        return {
          route: [],
          is_feasible: false,
        };
      }

      // Simple mock alternative route calculation
      const alternatives: [number, number][] = [];
      const midPoint = originalRoute[Math.floor(originalRoute.length / 2)];

      // Add some variation to create alternative path
      alternatives.push(originalRoute[0]);
      alternatives.push([midPoint[0] + 0.01, midPoint[1] - 0.01]);
      alternatives.push([midPoint[0] - 0.01, midPoint[1] + 0.01]);
      alternatives.push(originalRoute[originalRoute.length - 1]);

      return {
        route: alternatives,
        is_feasible: true,
      };
    },
    [],
  );
  // Real routing helper functions
  interface RouteResponse {
    routes: Array<{
      geometry: {
        coordinates: [number, number][];
      };
      legs: Array<{
        distance: number;
        duration: number;
      }>;
    }>;
  }

  // Get real route between points using OSRM API
  const getRouteBetweenPoints = async (
    start: [number, number],
    end: [number, number],
  ): Promise<RouteResponse> => {
    try {
      const response = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${start[1]},${start[0]};${end[1]},${end[0]}?overview=full&geometries=geojson&alternatives=true`,
      );
      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Error fetching route:", error);
      // Fallback to straight line if API fails
      return {
        routes: [
          {
            geometry: {
              coordinates: [start, end],
            },
            legs: [
              {
                distance: 0,
                duration: 0,
              },
            ],
          },
        ],
      };
    }
  };

  // Check if two routes overlap using spatial analysis
  const isRouteOverlapping = (
    routeA: [number, number][],
    routeB: [number, number][],
    threshold: number = 0.002,
  ): boolean => {
    return routeA.some(([lat1, lng1]) =>
      routeB.some(([lat2, lng2]) => {
        const dLat = lat1 - lat2;
        const dLng = lng1 - lng2;
        return dLat * dLat + dLng * dLng < threshold * threshold;
      }),
    );
  };

  // Calculate route impact analysis
  const calculateRouteImpact = (
    disruptionRoute: [number, number][],
    deliveryPartners: DeliveryPartner[],
  ) => {
    const affectedPartners = deliveryPartners.filter((partner) =>
      isRouteOverlapping(disruptionRoute, partner.current_route.coordinates),
    );

    const totalPayout = affectedPartners.length * 600; // ₹600 per affected delivery
    const estimatedDelay = Math.floor(Math.random() * 30) + 15; // 15-45 minutes delay

    return {
      affectedPartners: affectedPartners.map((p) => p.name),
      workersInZone: affectedPartners.length,
      estimatedPayout: totalPayout,
      estimatedDelay,
      feasible: affectedPartners.length === 0,
    };
  };

  // Fetch real routes when start and end points are selected
  useEffect(() => {
    if (!startPoint || !endPoint) return;

    const fetchRoutes = async () => {
      setIsFetchingRoutes(true);
      try {
        const routeData = await getRouteBetweenPoints(startPoint, endPoint);
        setDisruptionRoutes(routeData.routes);

        // Analyze impact on delivery routes
        if (routeData.routes.length > 0) {
          const primaryRoute = routeData.routes[0].geometry.coordinates.map(
            ([lng, lat]) => [lat, lng] as [number, number],
          );
          const impact = calculateRouteImpact(primaryRoute, deliveryPartners);

          // Update selected routes with affected delivery routes
          const affectedRouteIds = deliveryPartners
            .filter((partner) =>
              isRouteOverlapping(
                primaryRoute,
                partner.current_route.coordinates,
              ),
            )
            .map((partner) => partner.current_route.id);

          setSelectedRoutes(affectedRouteIds);

          // Update route check result
          setRouteCheckResult({
            feasible: impact.feasible,
            result: impact.feasible
              ? "No delivery partners affected by disruption."
              : `${impact.workersInZone} delivery partners affected. Estimated delay: ${impact.estimatedDelay} minutes.`,
            workers_in_zone: impact.workersInZone,
            estimated_payout: impact.estimatedPayout,
            affected_partners: impact.affectedPartners,
            affected_count: impact.workersInZone,
          });
        }
      } catch (error) {
        console.error("Error fetching routes:", error);
      } finally {
        setIsFetchingRoutes(false);
      }
    };

    fetchRoutes();
  }, [startPoint, endPoint, deliveryPartners]);
  useEffect(() => {
    if (disruptionRoutes.length === 0) return;

    const coords =
      disruptionRoutes[selectedDisruptionRoute]?.geometry.coordinates;
    if (!coords) return;

    const interval = setInterval(() => {
      setMovingIndex((prev) => (prev + 1) % coords.length);
    }, 100);

    return () => clearInterval(interval);
  }, [disruptionRoutes, selectedDisruptionRoute]);

  const startRouteSelection = useCallback(() => {
    console.log("Starting route selection");
    setIsSelectingRoute(true);
    setSelectedRoutes([]);
  }, []);

  const finishRouteSelection = useCallback(() => {
    console.log("Finishing route selection, selected routes:", selectedRoutes);
    setIsSelectingRoute(false);
  }, [selectedRoutes]);

  // Check route impact when routes are selected
  const checkRouteImpact = useCallback(() => {
    const affectedPartners: string[] = [];
    const partnerDetails: Array<{
      worker_id: string;
      worker_name: string;
      status: string;
      route_name: string;
    }> = [];
    let affectedWithoutAltCount = 0;
    let totalPayout = 0;

    deliveryPartners.forEach((partner) => {
      const isAffected = selectedRoutes.includes(partner.current_route.id);

      if (isAffected && partner.current_route.blocked) {
        // Calculate alternative route
        const altResult = calculateAlternativeRoute(
          partner.current_route.coordinates,
        );

        if (altResult.is_feasible && altResult.route.length > 0) {
          // Has alternative route - no payout needed
          partner.alternative_route = {
            id: `alt-${partner.id}`,
            name: `Alternative to ${partner.current_route.name}`,
            coordinates: altResult.route,
            estimated_time: Math.floor(Math.random() * 20) + 10,
            is_feasible: true,
          };
          partner.has_alternative_route = true;
        } else {
          // No alternative route - payout needed
          affectedPartners.push(partner.name);
          affectedWithoutAltCount++;
          totalPayout += 600;
          partner.has_alternative_route = false;
          partner.needs_payout_flag = true;
          partnerDetails.push({
            worker_id: partner.worker_id,
            worker_name: partner.name,
            status: partner.status,
            route_name: partner.current_route.name,
          });
        }
      }
    });

    setRouteCheckResult({
      feasible: affectedWithoutAltCount === 0,
      result:
        affectedWithoutAltCount > 0
          ? `${affectedWithoutAltCount} delivery partners need payout (no alternatives available). ${selectedRoutes.length - affectedWithoutAltCount} have alternative routes.`
          : "No delivery partners need payout. Alternative routes available for all affected workers.",
      workers_in_zone: selectedRoutes.length,
      estimated_payout: totalPayout,
      affected_partners: affectedPartners,
      affected_count: affectedWithoutAltCount,
    });
  }, [deliveryPartners, selectedRoutes, calculateAlternativeRoute]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Validate that we have disruption routes
    if (disruptionRoutes.length === 0) {
      setIsSubmitting(false);
      return;
    }

    // Get the selected disruption route
    const selectedRoute = disruptionRoutes[selectedDisruptionRoute];

    // Separate workers into two categories:
    // 1. Workers with alternative routes (NO payout flag needed)
    // 2. Workers without alternative routes (PAYOUT FLAG NEEDED)
    const workersWithAlternatives: string[] = [];
    const workersWithoutAlternatives: string[] = [];
    const affectedWorkersList: Array<{
      worker_id: string;
      worker_name: string;
      status: string;
      route_name: string;
    }> = [];
    const payoutFlagRequests: Array<{
      worker_id: string;
      worker_name: string;
      reason: string;
      status: "pending" | "approved" | "rejected";
    }> = [];

    const updatedPartners = deliveryPartners.map((partner) => {
      if (selectedRoutes.includes(partner.current_route.id)) {
        // Calculate alternative route with feasibility check
        const altResult = calculateAlternativeRoute(
          partner.current_route.coordinates,
        );

        const updatedPartner: DeliveryPartner = { ...partner };

        if (altResult.is_feasible && altResult.route.length > 0) {
          // Worker HAS viable alternative route - NO payout flag
          updatedPartner.alternative_route = {
            id: `alt-${partner.id}`,
            name: `Alternative to ${partner.current_route.name}`,
            coordinates: altResult.route,
            estimated_time: Math.floor(Math.random() * 20) + 10,
            is_feasible: true,
          };
          updatedPartner.has_alternative_route = true;
          workersWithAlternatives.push(partner.name);
        } else {
          // Worker DOES NOT have viable alternative - PAYOUT FLAG NEEDED
          updatedPartner.has_alternative_route = false;
          updatedPartner.needs_payout_flag = true;
          workersWithoutAlternatives.push(partner.name);
          affectedWorkersList.push({
            worker_id: partner.worker_id,
            worker_name: partner.name,
            status: partner.status,
            route_name: partner.current_route.name,
          });

          // Create payout flag request for this worker
          payoutFlagRequests.push({
            worker_id: partner.worker_id,
            worker_name: partner.name,
            reason: `No viable alternative route available during disruption on ${partner.current_route.name}. Compensation approved: ₹600`,
            status: "pending",
          });
        }

        return updatedPartner;
      }
      return partner;
    });

    setDeliveryPartners(updatedPartners);

    // Create disruption flag with worker separation
    const newDisruption: DisruptionFlag = {
      id: `disruption-${Date.now()}`,
      zone_id: formData.zone_id,
      disruption_type: formData.disruption_type,
      description: formData.description,
      evidence_url: formData.evidence_url,
      estimated_start: formData.estimated_start,
      estimated_end: formData.estimated_end,
      status: "pending",
      affected_routes: selectedRoutes,
      created_at: new Date().toISOString(),
      coordinates: selectedRoute.geometry.coordinates.map(([lng, lat]) => [
        lat,
        lng,
      ]),
      workers_with_alternatives: workersWithAlternatives,
      workers_without_alternatives: workersWithoutAlternatives,
      affected_workers_count: workersWithoutAlternatives.length,
      affected_workers_details: affectedWorkersList,
      payout_flag_requests: payoutFlagRequests,
    };

    // Add disruption to local list for immediate UI feedback
    setDisruptions((prev) => [...prev, newDisruption]);
    setSelectedDisruption(newDisruption.id);

    // Save to localStorage for FlagHistory page (as local cache)
    try {
      const stored = localStorage.getItem("disruptionFlags");
      let allDisruptions = stored ? JSON.parse(stored) : [];
      allDisruptions = [newDisruption, ...allDisruptions];
      localStorage.setItem("disruptionFlags", JSON.stringify(allDisruptions));
    } catch (e) {
      console.error("Error saving to localStorage:", e);
    }

    // POST to real backend API
    try {
      const BASE_URL =
        (import.meta as unknown as { env: Record<string, string> }).env
          .VITE_API_BASE_URL || "http://localhost:8000";
      const token = localStorage.getItem("bhima_manager_token") || "";
      await fetch(`${BASE_URL}/manager/flag-disruption`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          manager_id: managerId,
          zone_id: formData.zone_id,
          disruption_type: formData.disruption_type,
          description: formData.description,
          evidence_url: formData.evidence_url || null,
          estimated_start: formData.estimated_start || null,
          estimated_end: formData.estimated_end || null,
          // Impact data computed by route-check — stored per flag so FlagHistory can use them
          workers_in_zone: routeCheckResult?.workers_in_zone ?? workersWithoutAlternatives.length,
          estimated_payout: routeCheckResult?.estimated_payout ?? null,
          // affected_worker_ids: cross-reference routeCheckResult.affected_partners (names)
          // with deliveryPartners to get the actual DB worker IDs of only the affected workers
          affected_worker_ids: (() => {
            const affectedNames = routeCheckResult?.affected_partners ?? [];
            if (affectedNames.length > 0) {
              // Look up real worker IDs by matching on partner name
              return deliveryPartners
                .filter((p) => affectedNames.includes((p as any).name))
                .map((p) => parseInt((p as any).worker_id ?? (p as any).id, 10))
                .filter((id) => !isNaN(id) && id > 0);
            }
            // Fallback: affectedWorkersList from geometric route check
            return affectedWorkersList
              .map((w) => parseInt(w.worker_id, 10))
              .filter((id) => !isNaN(id) && id > 0);
          })(),
        }),
      });
      console.log("[FlagDisruption] Flag submitted to backend successfully");
    } catch (err) {
      console.warn(
        "[FlagDisruption] Backend submit failed (saved locally):",
        err,
      );
    }

    // Reset form
    setFormData({
      zone_id: primaryZone,
      disruption_type: "road_blockage",
      description: "",
      evidence_url: "",
      estimated_start: "",
      estimated_end: "",
    });

    // Reset selection
    setSelectedRoutes([]);
    setStartPoint(null);
    setEndPoint(null);
    setSelectionMode("none");
    setDisruptionRoutes([]);
    setSelectedDisruptionRoute(0);

    setIsSubmitting(false);
  };

  const disruptionTypes = [
    {
      value: "curfew",
      label: "Curfew",
      color: "bg-red-50 border-red-200 text-red-700",
    },
    {
      value: "strike",
      label: "Strike",
      color: "bg-yellow-50 border-yellow-200 text-yellow-700",
    },
    {
      value: "road_blockage",
      label: "Road Blockage",
      color: "bg-orange-50 border-orange-200 text-orange-700",
    },
    {
      value: "protests",
      label: "Protests",
      color: "bg-purple-50 border-purple-200 text-purple-700",
    },
  ];
  const MapClickHandler = ({
    selectionMode,
    setStartPoint,
    setEndPoint,
    setSelectionMode,
  }: any) => {
    const map = useMap();

    useEffect(() => {
      const handleClick = (e: any) => {
        const coords: [number, number] = [e.latlng.lat, e.latlng.lng];

        if (selectionMode === "start") {
          setStartPoint(coords);
          setSelectionMode("end");
        } else if (selectionMode === "end") {
          setEndPoint(coords);
          setSelectionMode("none");
        }
      };

      map.on("click", handleClick);
      return () => {
        map.off("click", handleClick);
      };
    }, [map, selectionMode]);

    return null;
  };
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <motion.button
                onClick={() => navigate("/manager/dashboard")}
                className="text-gray-600 hover:text-gray-900 transition-colors"
                whileHover={{ x: -5 }}
              >
                <ArrowLeft className="w-5 h-5 mr-2" />
                Back to Dashboard
              </motion.button>
              <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  Flag Disruption
                </h1>
                <p className="text-xs text-gray-600">
                  Real-time Route Management
                </p>
              </div>
            </div>
            <div className="text-sm text-gray-600">
              {new Date().toLocaleString("en-IN")}
            </div>
          </div>
        </div>
      </header>

      <div className="px-6 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Interactive Map */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="lg:col-span-2"
            >
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
                <div className="p-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-gray-900">
                      Live Route Map
                    </h2>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => {
                          setSelectionMode("start");
                          setStartPoint(null);
                          setEndPoint(null);
                          setSelectedRoutes([]);
                          setDisruptionRoutes([]);
                        }}
                        className={`px-3 py-1 rounded-lg text-sm ${
                          selectionMode === "start"
                            ? "bg-blue-600 text-white"
                            : "bg-blue-100 text-blue-700 hover:bg-blue-200"
                        }`}
                      >
                        {selectionMode === "start"
                          ? "Selecting Start..."
                          : "Select Start Point"}
                      </button>

                      <button
                        onClick={() => setSelectionMode("end")}
                        disabled={!startPoint}
                        className={`px-3 py-1 rounded-lg text-sm ${
                          selectionMode === "end"
                            ? "bg-green-600 text-white"
                            : startPoint
                              ? "bg-green-100 text-green-700 hover:bg-green-200"
                              : "bg-gray-100 text-gray-400 cursor-not-allowed"
                        }`}
                      >
                        {selectionMode === "end"
                          ? "Selecting End..."
                          : "Select End Point"}
                      </button>

                      {disruptionRoutes.length > 0 && (
                        <button
                          onClick={() => {
                            setSelectionMode("none");
                            setSelectedRoutes([]);
                          }}
                          className="px-3 py-1 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200"
                        >
                          Clear Selection
                        </button>
                      )}
                      {isSelectingRoute && (
                        <button
                          onClick={finishRouteSelection}
                          className="px-3 py-1 bg-green-100 text-green-700 rounded-lg text-sm font-medium hover:bg-green-200"
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Done ({selectedRoutes.length} selected)
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Real Interactive Map */}
                <div className="relative">
                  {isLoadingPartners && (
                    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-2 bg-white/90 border border-gray-200 shadow rounded-full px-4 py-1.5 text-xs text-gray-600 font-medium">
                      <span className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      Loading delivery partners…
                    </div>
                  )}

                <MapContainer
                  center={mapCenter}
                  zoom={mapZoom}
                  className="h-96 w-full"
                >
                  <TileLayer
                    attribution="© OpenStreetMap contributors"
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  {disruptionRoutes.length > 0 &&
                    disruptionRoutes[selectedDisruptionRoute]?.geometry
                      ?.coordinates?.length > 0 && (
                      <Marker
                        position={[
                          disruptionRoutes[selectedDisruptionRoute].geometry
                            .coordinates[
                            movingIndex %
                              disruptionRoutes[selectedDisruptionRoute].geometry
                                .coordinates.length
                          ][1],
                          disruptionRoutes[selectedDisruptionRoute].geometry
                            .coordinates[
                            movingIndex %
                              disruptionRoutes[selectedDisruptionRoute].geometry
                                .coordinates.length
                          ][0],
                        ]}
                      >
                        <Popup>🚴 Moving delivery</Popup>
                      </Marker>
                    )}
                  {/* Click Handler */}
                  <MapClickHandler
                    selectionMode={selectionMode}
                    setStartPoint={setStartPoint}
                    setEndPoint={setEndPoint}
                    setSelectionMode={setSelectionMode}
                  />

                  {/* Start + End Markers with custom icons */}
                  {startPoint && (
                    <Marker position={startPoint} icon={startPointIcon}>
                      <Popup>
                        <div className="p-2">
                          <strong>📍 Disruption Start Point</strong>
                          <br />
                          <span className="text-sm text-gray-600">
                            [{startPoint[0].toFixed(4)},{" "}
                            {startPoint[1].toFixed(4)}]
                          </span>
                        </div>
                      </Popup>
                    </Marker>
                  )}
                  {endPoint && (
                    <Marker position={endPoint} icon={endPointIcon}>
                      <Popup>
                        <div className="p-2">
                          <strong>🛑 Disruption End Point</strong>
                          <br />
                          <span className="text-sm text-gray-600">
                            [{endPoint[0].toFixed(4)}, {endPoint[1].toFixed(4)}]
                          </span>
                        </div>
                      </Popup>
                    </Marker>
                  )}

                  {/* Real Disruption Routes */}
                  {disruptionRoutes.map((route, index) => (
                    <Polyline
                      key={`disruption-route-${index}`}
                      positions={route.geometry.coordinates.map(
                        ([lng, lat]) => [lat, lng],
                      )}
                      pathOptions={{
                        color:
                          index === selectedDisruptionRoute
                            ? "#DC2626"
                            : "#9CA3AF",
                        weight: index === selectedDisruptionRoute ? 6 : 3,
                        opacity: index === selectedDisruptionRoute ? 1 : 0.6,
                        dashArray:
                          index === selectedDisruptionRoute
                            ? "10,5"
                            : undefined,
                        dashOffset: "0",
                        className:
                          index === selectedDisruptionRoute
                            ? "animated-route cursor-pointer"
                            : "cursor-pointer",
                      }}
                      eventHandlers={{
                        click: () => setSelectedDisruptionRoute(index),
                        mouseover: (e) => {
                          const target = e.target;
                          if (target.setStyle) {
                            target.setStyle({
                              weight: 5,
                              opacity: 1,
                              color: "#F59E0B",
                            });
                          }
                        },
                        mouseout: (e) => {
                          const target = e.target;
                          if (target.setStyle) {
                            target.setStyle({
                              weight: index === selectedDisruptionRoute ? 6 : 3,
                              opacity:
                                index === selectedDisruptionRoute ? 1 : 0.6,
                              color:
                                index === selectedDisruptionRoute
                                  ? "#DC2626"
                                  : "#6B7280",
                            });
                          }
                        },
                      }}
                    />
                  ))}

                  {/* Loading indicator */}
                  {isFetchingRoutes && (
                    <div className="absolute top-4 left-4 bg-white p-2 rounded-lg shadow-lg z-10">
                      <div className="flex items-center space-x-2">
                        <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-sm text-gray-700">
                          Fetching routes...
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Delivery Partner Routes */}
                  {deliveryPartners.map((partner) => (
                    <React.Fragment key={`delivery-${partner.id}`}>
                      {/* Current Route */}
                      <Polyline
                        positions={partner.current_route.coordinates}
                        pathOptions={{
                          color: selectedRoutes.includes(
                            partner.current_route.id,
                          )
                            ? "#DC2626"
                            : partner.current_route.blocked
                              ? "#F97316"
                              : "#10B981",
                          weight: selectedRoutes.includes(
                            partner.current_route.id,
                          )
                            ? 5
                            : 3,
                          opacity: selectedRoutes.includes(
                            partner.current_route.id,
                          )
                            ? 1
                            : 0.8,
                          dashArray: partner.current_route.blocked
                            ? "8,4"
                            : undefined,
                          className: "transition-all duration-300",
                        }}
                      />

                      {/* Alternative Route */}
                      {partner.alternative_route && (
                        <Polyline
                          positions={partner.alternative_route.coordinates}
                          pathOptions={{
                            color: "#3B82F6",
                            weight: 2,
                            opacity: 0.6,
                            dashArray: "10,5",
                            className: "animate-pulse",
                          }}
                        />
                      )}

                      {/* Delivery Partner Marker with bike icon */}
                      <Marker
                        position={[partner.lat, partner.lng]}
                        icon={bikeIcon}
                      >
                        <Popup>
                          <div className="p-2">
                            <strong>{partner.name}</strong>
                            <br />
                            <span className="text-sm text-gray-600">
                              ID: {partner.worker_id}
                            </span>
                            <br />
                            <span className="text-sm text-gray-600">
                              Route: {partner.current_route.name}
                            </span>
                            <br />
                            <span className="text-sm text-gray-600">
                              Status: {partner.status}
                            </span>
                            <br />
                            {selectedRoutes.includes(
                              partner.current_route.id,
                            ) && (
                              <>
                                <span className="text-sm font-medium text-red-600">
                                  🚨 AFFECTED BY DISRUPTION
                                </span>
                                <br />
                                {partner.has_alternative_route ? (
                                  <span className="text-sm font-medium text-blue-600">
                                    ✅ Alternative route available (No payout)
                                  </span>
                                ) : (
                                  <span className="text-sm font-medium text-red-600">
                                    ❌ No alternative route (Payout flag sent)
                                  </span>
                                )}
                              </>
                            )}
                          </div>
                        </Popup>
                      </Marker>
                    </React.Fragment>
                  ))}

                  {/* Disruption Zones */}
                  {disruptions.map(
                    (disruption) =>
                      disruption.coordinates && (
                        <Polygon
                          key={disruption.id}
                          positions={disruption.coordinates}
                          pathOptions={{
                            color: "#DC2626",
                            fillOpacity: 0.2,
                            weight: 2,
                            className: "animate-pulse",
                          }}
                        />
                      ),
                  )}

                  {/* Route & Marker Legend */}
                  <div className="absolute bottom-4 right-4 bg-white p-4 rounded-lg shadow-lg z-10 max-w-xs">
                    <div className="text-xs font-bold text-gray-900 mb-2">
                      🗺️ Legend
                    </div>
                    <div className="space-y-2 border-b pb-2 mb-2">
                      <div className="flex items-center space-x-2">
                        <div className="w-3 h-1 bg-green-500 rounded"></div>
                        <span className="text-xs text-gray-600">
                          Clear Route
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-3 h-1 bg-orange-500 rounded"></div>
                        <span className="text-xs text-gray-600">
                          Blocked Route
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-3 h-1 bg-red-600 rounded"></div>
                        <span className="text-xs text-gray-600">
                          Affected Route
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div
                          className="w-3 h-1 bg-blue-500 rounded"
                          style={{ borderStyle: "dashed" }}
                        ></div>
                        <span className="text-xs text-gray-600">
                          Alternative Route
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-3 h-1 bg-gray-500 rounded"></div>
                        <span className="text-xs text-gray-600">
                          Disruption Route
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <div className="w-5 h-5 flex items-center justify-center">
                          <div
                            className="w-4 h-4 bg-green-500 rounded-full border border-white shadow"
                            title="Start Point"
                          ></div>
                        </div>
                        <span className="text-xs text-gray-600">
                          Disruption Start (Pointer)
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-5 h-5 flex items-center justify-center">
                          <div
                            className="w-4 h-4 bg-red-600 rounded-full border border-white shadow"
                            title="End Point"
                          ></div>
                        </div>
                        <span className="text-xs text-gray-600">
                          Disruption End (Pointer)
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div
                          className="w-5 h-5 flex items-center justify-center bg-gray-400 rounded-full opacity-85"
                          title="Worker Bike Icon"
                        >
                          <span className="text-white text-xs">🚴</span>
                        </div>
                        <span className="text-xs text-gray-600">
                          Worker Location (Bike)
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-blue-600 font-bold">
                          ✓
                        </span>
                        <span className="text-xs text-gray-600">
                          Has Alternative Route
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-red-600 font-bold">
                          ✕
                        </span>
                        <span className="text-xs text-gray-600">
                          Needs Payout Flag
                        </span>
                      </div>
                    </div>
                  </div>
                </MapContainer>
                </div>{/* end relative wrapper */}
              </div>
            </motion.div>

            {/* Control Panel */}
            <div className="space-y-6">
              {/* Flag Form */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm"
              >
                <h2 className="text-xl font-bold text-gray-900 mb-6">
                  Disruption Details
                </h2>

                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Zone Selection */}
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      Zone ID *
                    </label>
                    <select
                      value={formData.zone_id}
                      onChange={(e) =>
                        setFormData({ ...formData, zone_id: e.target.value })
                      }
                      className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:border-gray-500 font-medium"
                      required
                    >
                      {managerZones.map((zone) => (
                        <option key={zone} value={zone}>
                          {zone}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Disruption Type */}
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      Disruption Type *
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      {disruptionTypes.map((type) => (
                        <motion.button
                          key={type.value}
                          type="button"
                          onClick={() =>
                            setFormData({
                              ...formData,
                              disruption_type: type.value as any,
                            })
                          }
                          className={`p-3 rounded-lg border font-medium transition-colors ${
                            formData.disruption_type === type.value
                              ? `${type.color}`
                              : "bg-white border-gray-300 text-gray-700 hover:border-gray-400"
                          }`}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          {type.label}
                        </motion.button>
                      ))}
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      Description *
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          description: e.target.value,
                        })
                      }
                      className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:border-gray-500 font-medium resize-none"
                      rows={4}
                      placeholder="Describe disruption in detail..."
                      required
                    />
                  </div>

                  {/* Time Estimates */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">
                        Start Time *
                      </label>
                      <input
                        type="datetime-local"
                        value={formData.estimated_start}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            estimated_start: e.target.value,
                          })
                        }
                        className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:border-gray-500 font-medium"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">
                        End Time (Estimate)
                      </label>
                      <input
                        type="datetime-local"
                        value={formData.estimated_end}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            estimated_end: e.target.value,
                          })
                        }
                        className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:border-gray-500 font-medium"
                      />
                    </div>
                  </div>

                  {/* Evidence Upload */}
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      Evidence URL
                    </label>
                    <div className="relative">
                      <Upload className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="url"
                        value={formData.evidence_url}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            evidence_url: e.target.value,
                          })
                        }
                        className="w-full pl-10 pr-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:border-gray-500 font-medium"
                        placeholder="https://link-to-photo-or-news.com"
                      />
                    </div>
                  </div>

                  {/* Submit Button */}
                  <motion.button
                    type="submit"
                    disabled={
                      isSubmitting || !formData.zone_id || !formData.description
                    }
                    className="w-full py-3 bg-gray-900 text-white font-bold rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    whileHover={{ scale: isSubmitting ? 1 : 1.02 }}
                    whileTap={{ scale: isSubmitting ? 1 : 0.98 }}
                  >
                    {isSubmitting ? (
                      <div className="flex items-center justify-center">
                        <Loader className="w-5 h-5 mr-2 animate-spin" />
                        Processing...
                      </div>
                    ) : (
                      <div className="flex items-center justify-center">
                        <Send className="w-5 h-5 mr-2" />
                        Submit Flag
                      </div>
                    )}
                  </motion.button>
                </form>
              </motion.div>

              {/* Route Impact Analysis */}
              {routeCheckResult && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm"
                >
                  <h3 className="text-lg font-bold text-gray-900 mb-4">
                    Route Impact Analysis
                  </h3>

                  <div
                    className={`p-4 rounded-lg border ${
                      routeCheckResult.feasible
                        ? "bg-green-50 border-green-200"
                        : "bg-red-50 border-red-200"
                    }`}
                  >
                    <div className="flex items-center mb-2">
                      {routeCheckResult.feasible ? (
                        <CheckCircle className="w-6 h-6 text-green-600 mr-2" />
                      ) : (
                        <XCircle className="w-6 h-6 text-red-600 mr-2" />
                      )}
                      <span className="font-bold text-gray-900">
                        Route{" "}
                        {routeCheckResult.feasible ? "Available" : "Blocked"}
                      </span>
                    </div>
                    <p className="text-gray-700 text-sm">
                      {routeCheckResult.result}
                    </p>
                  </div>

                  {/* Affected Partners */}
                  {routeCheckResult.affected_partners.length > 0 && (
                    <div className="mt-4">
                      <h4 className="font-medium text-gray-900 mb-2">
                        Workers Needing Payout (
                        {routeCheckResult.affected_count}):
                      </h4>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {routeCheckResult.affected_partners.map(
                          (partner, index) => (
                            <div
                              key={index}
                              className="text-sm text-gray-600 flex items-center"
                            >
                              <AlertCircle className="w-3 h-3 mr-2 text-red-500" />
                              {partner}
                            </div>
                          ),
                        )}
                      </div>
                    </div>
                  )}

                  <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Estimated Payout:</span>
                      <span className="text-green-600 font-bold">
                        ₹{routeCheckResult.estimated_payout.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Recent Disruptions */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm"
              >
                <h3 className="text-lg font-bold text-gray-900 mb-4">
                  Recent Disruptions
                </h3>
                <div className="space-y-3">
                  {disruptions.map((disruption) => (
                    <div
                      key={disruption.id}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedDisruption === disruption.id
                          ? "bg-blue-50 border-blue-200"
                          : "bg-gray-50 border-gray-200 hover:bg-gray-100"
                      }`}
                      onClick={() => setSelectedDisruption(disruption.id)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-gray-900 font-medium">
                          {disruption.disruption_type
                            .replace("_", " ")
                            .toUpperCase()}
                        </span>
                        <span
                          className={`text-xs px-2 py-1 rounded ${
                            disruption.status === "approved"
                              ? "bg-green-100 text-green-700"
                              : disruption.status === "pending"
                                ? "bg-yellow-100 text-yellow-700"
                                : "bg-red-100 text-red-700"
                          }`}
                        >
                          {disruption.status}
                        </span>
                      </div>
                      <p className="text-gray-600 text-sm">
                        {disruption.description}
                      </p>
                      <div className="flex justify-between text-xs text-gray-500 mt-2">
                        <span>
                          {new Date(disruption.created_at).toLocaleString()}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDisruptions((prev) =>
                              prev.filter((d) => d.id !== disruption.id),
                            );
                          }}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FlagDisruption;
