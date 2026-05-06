// Disruption Flag API Service with Fallback
// Fetches real delivery partners and disruptions from API, falls back to mock values on errors

import { getManagerToken } from './managerApi';

const BASE_URL =
  (import.meta as unknown as { env: Record<string, string> }).env
    .VITE_API_BASE_URL || 'http://localhost:8000';

// ── Helper: Build auth headers ────────────────────────────────────────────
const getHeaders = () => ({
  'Content-Type': 'application/json',
  ...(getManagerToken() && { Authorization: `Bearer ${getManagerToken()}` }),
});

// ── Types ─────────────────────────────────────────────────────────────────

export interface DeliveryPartner {
  id: number;
  name: string;
  worker_id: string;
  lat: number;
  lng: number;
  status: 'online' | 'offline';
  current_route: {
    id: string;
    name: string;
    coordinates: [number, number][];
    blocked: boolean;
  };
}

export interface DisruptionFlag {
  id: string;
  zone_id: string;
  disruption_type: string;
  description: string;
  evidence_url: string;
  estimated_start: string;
  estimated_end: string;
  status: string;
  affected_routes: string[];
  created_at: string;
  coordinates: [number, number][];
  workers_with_alternatives: string[];
  workers_without_alternatives: string[];
  affected_workers_count: number;
  affected_workers_details: Array<{
    worker_id: string;
    worker_name: string;
    status: string;
    route_name: string;
  }>;
  payout_flag_requests: Array<{
    worker_id: string;
    worker_name: string;
    reason: string;
    status: string;
  }>;
}

// ── Fallback Mock Data ────────────────────────────────────────────────────

const FALLBACK_DELIVERY_PARTNERS: DeliveryPartner[] = [
  {
    id: 1,
    name: 'Raj Kumar',
    worker_id: '1024',
    lat: 19.088,
    lng: 72.865,
    status: 'online',
    current_route: {
      id: 'route-1',
      name: 'Dark Store -> Andheri West -> Lokhandwala',
      coordinates: [
        [19.076, 72.8777],
        [19.088, 72.865],
        [19.095, 72.85],
      ],
      blocked: false,
    },
  },
  {
    id: 2,
    name: 'Priya Sharma',
    worker_id: '1025',
    lat: 19.082,
    lng: 72.892,
    status: 'online',
    current_route: {
      id: 'route-2',
      name: 'Dark Store -> Andheri East -> Ghatkopar',
      coordinates: [
        [19.076, 72.8777],
        [19.082, 72.892],
        [19.095, 72.91],
      ],
      blocked: true,
    },
  },
  {
    id: 3,
    name: 'Amit Patel',
    worker_id: '1026',
    lat: 19.105,
    lng: 72.855,
    status: 'offline',
    current_route: {
      id: 'route-3',
      name: 'Dark Store -> Versova -> Madh Island',
      coordinates: [
        [19.076, 72.8777],
        [19.105, 72.855],
        [19.12, 72.835],
      ],
      blocked: true,
    },
  },
  {
    id: 4,
    name: 'Sneha Reddy',
    worker_id: '1027',
    lat: 19.095,
    lng: 72.885,
    status: 'online',
    current_route: {
      id: 'route-4',
      name: 'Dark Store -> Bandra -> Khar',
      coordinates: [
        [19.076, 72.8777],
        [19.095, 72.885],
        [19.11, 72.87],
      ],
      blocked: false,
    },
  },
  {
    id: 5,
    name: 'Vikram Singh',
    worker_id: '1028',
    lat: 19.115,
    lng: 72.89,
    status: 'online',
    current_route: {
      id: 'route-5',
      name: 'Dark Store -> Santacruz -> Juhu',
      coordinates: [
        [19.076, 72.8777],
        [19.1, 72.89],
        [19.115, 72.89],
      ],
      blocked: true,
    },
  },
  {
    id: 6,
    name: 'Deepak Gupta',
    worker_id: '1029',
    lat: 19.068,
    lng: 72.89,
    status: 'online',
    current_route: {
      id: 'route-6',
      name: 'Dark Store -> Mahim -> Bandra West',
      coordinates: [
        [19.076, 72.8777],
        [19.068, 72.89],
        [19.055, 72.9],
      ],
      blocked: false,
    },
  },
  {
    id: 7,
    name: 'Manisha Desai',
    worker_id: '1030',
    lat: 19.072,
    lng: 72.855,
    status: 'online',
    current_route: {
      id: 'route-7',
      name: 'Dark Store -> Andheri South -> Oshiwara',
      coordinates: [
        [19.076, 72.8777],
        [19.072, 72.855],
        [19.065, 72.835],
      ],
      blocked: false,
    },
  },
  {
    id: 8,
    name: 'Sanjay Rao',
    worker_id: '1031',
    lat: 19.105,
    lng: 72.9,
    status: 'online',
    current_route: {
      id: 'route-8',
      name: 'Dark Store -> DN Nagar -> Linking Road',
      coordinates: [
        [19.076, 72.8777],
        [19.09, 72.905],
        [19.105, 72.9],
      ],
      blocked: true,
    },
  },
  {
    id: 9,
    name: 'Kavya Nair',
    worker_id: '1032',
    lat: 19.087,
    lng: 72.842,
    status: 'online',
    current_route: {
      id: 'route-9',
      name: 'Dark Store -> Four Bungalows -> Juhu Beach',
      coordinates: [
        [19.076, 72.8777],
        [19.087, 72.842],
        [19.1, 72.82],
      ],
      blocked: false,
    },
  },
  {
    id: 10,
    name: 'Rohan Pandya',
    worker_id: '1033',
    lat: 19.12,
    lng: 72.865,
    status: 'online',
    current_route: {
      id: 'route-10',
      name: 'Dark Store -> Vile Parle -> Chakala',
      coordinates: [
        [19.076, 72.8777],
        [19.105, 72.86],
        [19.12, 72.865],
      ],
      blocked: true,
    },
  },
];

const FALLBACK_DISRUPTIONS: DisruptionFlag[] = [
  {
    id: 'disruption-1',
    zone_id: 'MUM-WEST-01',
    disruption_type: 'road_blockage',
    description: 'NH8 Blockage near Andheri flyover - traffic congestion',
    evidence_url: 'https://example.com/evidence1.jpg',
    estimated_start: '2026-04-15T13:30:00Z',
    estimated_end: '2026-04-15T18:30:00Z',
    status: 'approved',
    affected_routes: ['route-2', 'route-3', 'route-5'],
    created_at: '2026-04-15T13:30:00Z',
    coordinates: [
      [19.089, 72.865],
      [19.11, 72.88],
    ],
    workers_with_alternatives: ['Priya Sharma', 'Sneha Reddy'],
    workers_without_alternatives: ['Amit Patel'],
    affected_workers_count: 1,
    affected_workers_details: [
      {
        worker_id: '1026',
        worker_name: 'Amit Patel',
        status: 'offline',
        route_name: 'Dark Store -> Versova -> Madh Island',
      },
    ],
    payout_flag_requests: [
      {
        worker_id: '1026',
        worker_name: 'Amit Patel',
        reason:
          'No viable alternative route available. Compensation approved: ₹600',
        status: 'approved',
      },
    ],
  },
];

// ── Public API Functions ──────────────────────────────────────────────────

/**
 * Fetch delivery partners from API with fallback to FALLBACK_DELIVERY_PARTNERS
 */
export const fetchDeliveryPartners = async (
  zoneId?: string,
): Promise<DeliveryPartner[]> => {
  try {
    const url = zoneId
      ? `${BASE_URL}/manager/delivery-partners?zone_id=${encodeURIComponent(zoneId)}`
      : `${BASE_URL}/manager/delivery-partners`;

    const response = await fetch(url, {
      method: 'GET',
      headers: getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    return Array.isArray(data) ? data : FALLBACK_DELIVERY_PARTNERS;
  } catch (err) {
    console.warn(
      'Failed to fetch delivery partners, using fallback:',
      err instanceof Error ? err.message : 'Unknown error',
    );
    return FALLBACK_DELIVERY_PARTNERS;
  }
};

/**
 * Fetch active disruptions from API with fallback to FALLBACK_DISRUPTIONS
 */
export const fetchDisruptions = async (
  zoneId?: string,
): Promise<DisruptionFlag[]> => {
  try {
    const url = zoneId
      ? `${BASE_URL}/manager/disruptions?zone_id=${encodeURIComponent(zoneId)}`
      : `${BASE_URL}/manager/disruptions`;

    const response = await fetch(url, {
      method: 'GET',
      headers: getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    return Array.isArray(data) ? data : FALLBACK_DISRUPTIONS;
  } catch (err) {
    console.warn(
      'Failed to fetch disruptions, using fallback:',
      err instanceof Error ? err.message : 'Unknown error',
    );
    return FALLBACK_DISRUPTIONS;
  }
};

/**
 * Create a new disruption flag via API
 */
export const createDisruptionFlag = async (payload: {
  manager_id: number;
  zone_id: string;
  disruption_type: string;
  description: string;
  evidence_url?: string;
  estimated_start?: string;
  estimated_end?: string;
}): Promise<DisruptionFlag | null> => {
  try {
    const response = await fetch(`${BASE_URL}/manager/flag-disruption`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    return data as DisruptionFlag;
  } catch (err) {
    console.warn(
      'Failed to create disruption flag:',
      err instanceof Error ? err.message : 'Unknown error',
    );
    return null;
  }
};

/**
 * Fetch all disruption and delivery partner data in parallel with fallbacks
 */
export const fetchDisruptionPageData = async (zoneId?: string) => {
  const [deliveryPartners, disruptions] = await Promise.all([
    fetchDeliveryPartners(zoneId),
    fetchDisruptions(zoneId),
  ]);

  return {
    deliveryPartners,
    disruptions,
  };
};
