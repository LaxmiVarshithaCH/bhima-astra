// ── AQI Service ────────────────────────────────────────────────────────────
// Primary:  OpenWeatherMap Air Pollution API  (returns index 1–5)
// Fallback: WAQI API                          (returns index 0–500)
// ──────────────────────────────────────────────────────────────────────────

const OWM_KEY   = import.meta.env.VITE_WEATHER_API_KEY as string;
const WAQI_TOKEN = import.meta.env.VITE_WAQI_TOKEN as string;

/** Shape returned by this service to all consumers */
export interface AQIResult {
  /** Numeric AQI value.  OWM: 1–5  |  WAQI: 0–500  |  null = unavailable */
  raw: number | null;
  /** Display-friendly string, e.g. "72" or "AQI unavailable" */
  display: string;
  label: string;
  color: string;
  source: 'owm' | 'waqi' | 'none';
}

// ── Label/color helpers ────────────────────────────────────────────────────

/** Maps OpenWeatherMap AQI (1–5) → label + color */
export const getAQILabelOWM = (aqi: number): { label: string; color: string } => {
  switch (aqi) {
    case 1: return { label: 'Good',      color: '#22c55e' };
    case 2: return { label: 'Fair',      color: '#84cc16' };
    case 3: return { label: 'Moderate',  color: '#FBBF24' };
    case 4: return { label: 'Poor',      color: '#f97316' };
    case 5: return { label: 'Very Poor', color: '#FF5C5C' };
    default: return { label: 'Unknown',  color: '#A1A1AA' };
  }
};

/** Maps WAQI AQI (0–500) → label + color */
export const getAQILabelWAQI = (aqi: number): { label: string; color: string } => {
  if (aqi <= 50)  return { label: 'Good',        color: '#22c55e' };
  if (aqi <= 100) return { label: 'Moderate',    color: '#eab308' };
  if (aqi <= 150) return { label: 'Unhealthy+',  color: '#f97316' };
  if (aqi <= 200) return { label: 'Unhealthy',   color: '#ef4444' };
  if (aqi <= 300) return { label: 'Very Unhealthy', color: '#b91c1c' };
  return            { label: 'Hazardous',         color: '#7f1d1d' };
};

// ── Kept for backwards compat with any remaining consumers ─────────────────
export const getAQILabel = (aqi: number) => getAQILabelOWM(aqi).label;
export const getAQIColor = (aqi: number) => getAQILabelOWM(aqi).color;

// ── Primary fetch: OpenWeatherMap ─────────────────────────────────────────
async function fetchFromOWM(lat: number, lon: number): Promise<AQIResult | null> {
  try {
    console.log(`[AQI] OWM request → lat=${lat} lon=${lon}`);
    const url = `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${OWM_KEY}`;
    const res  = await fetch(url);
    const data = await res.json();
    console.log('[AQI] OWM raw response:', data);

    const aqiIndex: number | undefined = data?.list?.[0]?.main?.aqi;
    if (aqiIndex == null) {
      console.warn('[AQI] OWM: list[0].main.aqi is missing', data);
      return null;
    }

    const { label, color } = getAQILabelOWM(aqiIndex);
    return { raw: aqiIndex, display: String(aqiIndex), label, color, source: 'owm' };
  } catch (err) {
    console.error('[AQI] OWM fetch failed:', err);
    return null;
  }
}

// ── Fallback fetch: WAQI ──────────────────────────────────────────────────
async function fetchFromWAQI(lat: number, lon: number): Promise<AQIResult | null> {
  try {
    const url = `https://api.waqi.info/feed/geo:${lat};${lon}/?token=${WAQI_TOKEN}`;
    console.log(`[AQI] WAQI request → ${url}`);
    const res  = await fetch(url);
    const data = await res.json();
    console.log('[AQI] WAQI raw response:', data);

    if (data?.status !== 'ok' || data?.data?.aqi == null) {
      console.warn('[AQI] WAQI: unexpected response', data);
      return null;
    }

    const aqiVal: number = data.data.aqi;
    const { label, color } = getAQILabelWAQI(aqiVal);
    return { raw: aqiVal, display: String(aqiVal), label, color, source: 'waqi' };
  } catch (err) {
    console.error('[AQI] WAQI fetch failed:', err);
    return null;
  }
}

// ── Public API ────────────────────────────────────────────────────────────
/** Fetches AQI with OWM primary + WAQI fallback.  Never throws. */
export const fetchAQIData = async (
  lat = 16.5062,
  lon = 80.6480,
): Promise<AQIResult> => {
  const owm = await fetchFromOWM(lat, lon);
  if (owm) return owm;

  console.warn('[AQI] Falling back to WAQI…');
  const waqi = await fetchFromWAQI(lat, lon);
  if (waqi) return waqi;

  console.error('[AQI] Both sources failed – returning unavailable.');
  return { raw: null, display: 'AQI unavailable', label: 'AQI unavailable', color: '#A1A1AA', source: 'none' };
};
