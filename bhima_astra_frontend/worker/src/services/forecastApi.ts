// Worker Forecast API Service with Fallback
// Fetches real forecast data from API, falls back to mock values on errors

import { getToken } from './api';

const BASE_URL =
  ((import.meta as unknown as { env: Record<string, string> }).env
    .VITE_API_BASE_URL as string) || 'http://localhost:8000';

// ── Helper: Build auth headers ────────────────────────────────────────────
const getHeaders = () => ({
  'Content-Type': 'application/json',
  ...(getToken() && { Authorization: `Bearer ${getToken()}` }),
});

// ── Types ─────────────────────────────────────────────────────────────────

export interface ForecastItem {
  day: string;
  icon: React.ReactNode;
  condition: string;
  temp: string;
  forecast_date?: string;
  p_rain?: number;
  p_heat?: number;
  p_aqi?: number;
  composite_risk?: number;
  risk_label?: string;
}

export interface HourlyForecast {
  hour: string;
  temp: number;
  humidity: number;
  windSpeed: number;
  riskLevel: number;
  condition: string;
}

export interface DailyForecast {
  date: string;
  maxTemp: number;
  minTemp: number;
  condition: string;
  riskScore: number;
  riskLabel: string;
}

// ── Fallback Mock Data ────────────────────────────────────────────────────

export const FALLBACK_FORECAST_DAYS = [
  {
    day: 'Friday',
    condition: 'Partly Cloudy',
    temp: '26° / 18°',
  },
  {
    day: 'Saturday',
    condition: 'Sunny',
    temp: '29° / 20°',
  },
  {
    day: 'Sunday',
    condition: 'Storms',
    temp: '24° / 19°',
  },
  {
    day: 'Monday',
    condition: 'Rain',
    temp: '22° / 17°',
  },
  {
    day: 'Tuesday',
    condition: 'Overcast',
    temp: '23° / 17°',
  },
];

export const FALLBACK_HOURLY_FORECAST: HourlyForecast[] = [
  {
    hour: '00:00',
    temp: 22,
    humidity: 65,
    windSpeed: 8,
    riskLevel: 2,
    condition: 'Clear',
  },
  {
    hour: '06:00',
    temp: 20,
    humidity: 72,
    windSpeed: 6,
    riskLevel: 1,
    condition: 'Clear',
  },
  {
    hour: '12:00',
    temp: 28,
    humidity: 45,
    windSpeed: 12,
    riskLevel: 3,
    condition: 'Partly Cloudy',
  },
  {
    hour: '18:00',
    temp: 25,
    humidity: 55,
    windSpeed: 10,
    riskLevel: 2,
    condition: 'Cloudy',
  },
];

// ── Fallback Daily Forecast (relative dates) ————————————————————————————
export const FALLBACK_DAILY_FORECAST: DailyForecast[] = Array.from({ length: 4 }, (_, i) => {
  const d = new Date();
  d.setDate(d.getDate() + i);
  const conditions = ['Partly Cloudy', 'Sunny', 'Storms', 'Rain'];
  const riskScores = [0.35, 0.25, 0.68, 0.55];
  const riskLabels = ['Low', 'Low', 'High', 'Medium'];
  return {
    date: d.toISOString().split('T')[0],
    maxTemp: [28, 29, 24, 22][i],
    minTemp: [18, 20, 19, 17][i],
    condition: conditions[i],
    riskScore: riskScores[i],
    riskLabel: riskLabels[i],
  };
});

// ── Public API Functions ──────────────────────────────────────────────────

/**
 * Fetch forecast days from API with fallback to mock data
 */
export const fetchForecastDays = async (
  zoneId?: string,
): Promise<ForecastItem[]> => {
  try {
    const url = zoneId
      ? `${BASE_URL}/api/v1/forecast/days?zone_id=${encodeURIComponent(zoneId)}`
      : `${BASE_URL}/api/v1/forecast/days`;

    const response = await fetch(url, {
      method: 'GET',
      headers: getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    return Array.isArray(data)
      ? data.map((item: any) => ({
          day: item.day || item.forecast_date || 'Unknown',
          condition: item.condition || item.risk_label || 'No data',
          temp: item.temp || `${item.maxTemp}° / ${item.minTemp}°` || 'N/A',
          forecast_date: item.forecast_date,
          p_rain: item.p_rain,
          p_heat: item.p_heat,
          p_aqi: item.p_aqi,
          composite_risk: item.composite_risk,
          risk_label: item.risk_label,
        }))
      : FALLBACK_FORECAST_DAYS.map((item) => ({
          day: item.day,
          condition: item.condition,
          temp: item.temp,
        }));
  } catch (err) {
    console.warn(
      'Failed to fetch forecast days, using fallback:',
      err instanceof Error ? err.message : 'Unknown error',
    );
    return FALLBACK_FORECAST_DAYS.map((item) => ({
      day: item.day,
      condition: item.condition,
      temp: item.temp,
    }));
  }
};

/**
 * Fetch hourly forecast from API with fallback to mock data
 */
export const fetchHourlyForecast = async (
  zoneId?: string,
): Promise<HourlyForecast[]> => {
  try {
    const url = zoneId
      ? `${BASE_URL}/api/v1/forecast/hourly?zone_id=${encodeURIComponent(zoneId)}`
      : `${BASE_URL}/api/v1/forecast/hourly`;

    const response = await fetch(url, {
      method: 'GET',
      headers: getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    return Array.isArray(data) ? data : FALLBACK_HOURLY_FORECAST;
  } catch (err) {
    console.warn(
      'Failed to fetch hourly forecast, using fallback:',
      err instanceof Error ? err.message : 'Unknown error',
    );
    return FALLBACK_HOURLY_FORECAST;
  }
};

/**
 * Fetch daily forecast from API with fallback to mock data
 */
export const fetchDailyForecast = async (
  zoneId?: string,
): Promise<DailyForecast[]> => {
  try {
    const url = zoneId
      ? `${BASE_URL}/api/v1/forecast/daily?zone_id=${encodeURIComponent(zoneId)}`
      : `${BASE_URL}/api/v1/forecast/daily`;

    const response = await fetch(url, {
      method: 'GET',
      headers: getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    return Array.isArray(data) ? data : FALLBACK_DAILY_FORECAST;
  } catch (err) {
    console.warn(
      'Failed to fetch daily forecast, using fallback:',
      err instanceof Error ? err.message : 'Unknown error',
    );
    return FALLBACK_DAILY_FORECAST;
  }
};

/**
 * Fetch zone-specific forecast from API
 */
export const fetchZoneForecast = async (
  zoneId: string,
): Promise<{
  daily: DailyForecast[];
  hourly: HourlyForecast[];
} | null> => {
  try {
    const response = await fetch(
      `${BASE_URL}/api/v1/zones/${encodeURIComponent(zoneId)}/forecast`,
      {
        method: 'GET',
        headers: getHeaders(),
      },
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    return data || { daily: FALLBACK_DAILY_FORECAST, hourly: FALLBACK_HOURLY_FORECAST };
  } catch (err) {
    console.warn(
      'Failed to fetch zone forecast, using fallback:',
      err instanceof Error ? err.message : 'Unknown error',
    );
    return { daily: FALLBACK_DAILY_FORECAST, hourly: FALLBACK_HOURLY_FORECAST };
  }
};

/**
 * Fetch all forecast data in parallel with fallbacks
 */
export const fetchForecastPageData = async (zoneId?: string) => {
  const [days, hourly, daily] = await Promise.all([
    fetchForecastDays(zoneId),
    fetchHourlyForecast(zoneId),
    fetchDailyForecast(zoneId),
  ]);

  return {
    forecastDays: days,
    hourlyForecast: hourly,
    dailyForecast: daily,
  };
};
