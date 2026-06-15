import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from 'react';

// ── Supported languages ───────────────────────────────────────────────────────
// To add a new language, just add an entry here. Translations are automatic.
export const SUPPORTED_LANGS = [
  { code: 'EN', name: 'English',    flag: '🇬🇧', gtCode: 'en' },
  { code: 'TE', name: 'తెలుగు',    flag: '🇮🇳', gtCode: 'te' },
  { code: 'HI', name: 'हिन्दी',    flag: '🇮🇳', gtCode: 'hi' },
  { code: 'TA', name: 'தமிழ்',     flag: '🇮🇳', gtCode: 'ta' },
  { code: 'KN', name: 'ಕನ್ನಡ',     flag: '🇮🇳', gtCode: 'kn' },
  { code: 'ML', name: 'മലയാളം',    flag: '🇮🇳', gtCode: 'ml' },
] as const;

export type LangCode = (typeof SUPPORTED_LANGS)[number]['code'];

// ── English source strings (single source of truth) ──────────────────────────
// Only edit here. All other languages are auto-translated.
export const EN_STRINGS: Record<string, string> = {
  // Nav
  dashboard: 'Dashboard',
  policy: 'Policy',
  payouts: 'Payouts',
  forecasts: 'Forecasts',
  plans: 'Plans',
  profile: 'Profile',
  sign_out: 'Sign Out',

  // Profile
  personal_info: 'Personal Information',
  full_name: 'Full Name',
  phone: 'Phone',
  email: 'Email',
  city: 'City',
  save_changes: 'Save Changes',
  saved: 'Saved',
  upi_accounts: 'UPI Accounts',
  add_upi: 'Add UPI ID',
  cancel: 'Cancel',
  set_primary: 'Set Primary',
  primary: 'Primary',
  add: 'Add',
  zone_settings: 'Zone Settings',
  update_zone: 'Update Zone',
  notifications: 'Notifications',
  payout_alerts: 'Payout Alerts',
  payout_alerts_desc: 'Get notified on every payout',
  whatsapp: 'WhatsApp',
  whatsapp_desc: 'Messages via WhatsApp',
  email_notif: 'Email',
  email_notif_desc: 'Weekly summaries and updates',
  sms: 'SMS',
  sms_desc: 'Critical event alerts only',
  language: 'Language',
  danger_zone: 'Danger Zone',
  danger_desc: 'Deleting your account is irreversible. All your policies, payout history, and data will be permanently removed.',
  delete_account: 'Delete Account',
  delete_confirm: 'Are you absolutely sure? This cannot be undone.',
  yes_delete: 'Yes, Delete',
  download_pdf: 'Download Policy PDF',
  fraud_risk: 'Fraud Risk Score',
  kyc_verified: 'KYC Verified',
  kyc_pending: 'KYC Pending',
  plan_label: 'Plan',
  active: 'Active',
  renew_in: 'days left',

  // Dashboard
  live_weather: 'Live Weather',
  weekly_forecast: '7-Day Risk Forecast',
  good_morning: 'Good Morning',
  good_afternoon: 'Good Afternoon',
  good_evening: 'Good Evening',
  good_night: 'Good Night',
  worker: 'Worker',

  // Policy
  coverage_triggers: 'Coverage Triggers',
  trigger: 'Trigger',
  threshold: 'Threshold',
  payout: 'Payout',
  level: 'Level',
  status: 'Status',
  rainfall: 'Rainfall',
  aqi: 'AQI',
  heat_index: 'Heat Index',
  cyclone: 'Cyclone',
  hailstorm: 'Hailstorm',
  event_cap: 'Event Cap',
  used: 'Used',
  max_payout: 'Max payout',
  this_month: 'this month',
  live_thresholds: 'Live Thresholds',
  live_data: 'Live Data',
  policy_exclusions: 'Policy Exclusions',
  covered: 'Covered',
  near: 'Near',
  trigger_ready: 'Trigger Ready',
  not_included: 'Not Included',
  activated_date: 'Activated Date',
  expiry_date: 'Expiry Date',
  download_policy_pdf: 'Download Policy PDF',
  cancel_policy: 'Cancel Policy',
  renew_policy: 'Renew Policy',
  scheduled_maintenance: 'Scheduled Maintenance',
  personal_illness: 'Personal Illness',
  voluntary_offline: 'Voluntary Offline',
  fraud_activity: 'Fraud Activity',
  acts_of_war: 'Acts of War',

  // Payouts
  my_payouts: 'My Payouts',
  earnings: 'Earnings',
  total_earned: 'Total Earned',
  events_covered: 'Events Covered',
  pending_payouts: 'Pending Payouts',
  last_payout: 'Last Payout',
  vault_and_payouts: 'Vault and Payouts',
  secured_earnings: 'Secured earnings and protected balances',
  simulate_trigger: 'Simulate Trigger',
  export_csv: 'Export CSV',
  withdraw: 'Withdraw',
  search_placeholder: 'Search by event or ID',
  all: 'All',
  paid: 'Paid',
  pending: 'Pending',
  failed: 'Failed',
  total_recovered: 'Total Recovered',
  pending_payout: 'Pending Payout',
  events_triggered: 'Events Triggered',
  avg_per_event: 'Avg Per Event',
  transaction_history: 'Transaction History',
  no_transactions: 'No transactions found.',

  // Forecasts
  forecast: 'Weather Forecast',
  loading: 'Loading',
  aqi_unavailable: 'AQI Unavailable',
  live_thunderstorm_map: 'Live Thunderstorm Map - Your Location',
  weekly_risk_forecast: 'Weekly Risk Forecast',
  hourly_temp: 'Hourly Temperature',
  air_quality: 'Air Quality Index',

  // Plans
  plans_title: 'Choose Your Plan',
  plans_subtitle: 'Parametric insurance - automatic payouts, no claims needed.',
  activate: 'Activate',
  most_popular: 'Most Popular',
  best_value: 'Best Value',
  weekly_premium: 'Weekly Premium',
  per_event_payout: 'Per Event Payout',
  max_events_week: 'Max Events per Week',
  max_weekly_payout: 'Max Weekly Payout',
  faq_title: 'Frequently Asked Questions',
  current_plan: 'Current Plan',
};

// ── Auto-translate via Google Translate (free unofficial API) ─────────────────
const CACHE_PREFIX = 'bhima_t_';

async function translateBatch(
  texts: string[],
  targetGtCode: string,
): Promise<string[]> {
  // Split into chunks of 50 to avoid URL length limits
  const CHUNK = 50;
  const results: string[] = [];

  for (let i = 0; i < texts.length; i += CHUNK) {
    const chunk = texts.slice(i, i + CHUNK);
    const q = chunk.map((t) => `q=${encodeURIComponent(t)}`).join('&');
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetGtCode}&dt=t&${q}`;
    try {
      const res = await fetch(url);
      const json = await res.json();
      // Google returns [[["translated","original",...],...],...]
      const translated = Array.isArray(json[0])
        ? (json[0] as any[][]).map((item) => String(item[0] ?? ''))
        : chunk; // fallback to original on parse error
      results.push(...translated);
    } catch {
      // Network error — fallback to English
      results.push(...chunk);
    }
  }

  return results;
}

async function loadTranslations(lang: LangCode): Promise<Record<string, string>> {
  if (lang === 'EN') return EN_STRINGS;

  // Check localStorage cache
  const cacheKey = `${CACHE_PREFIX}${lang}`;
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) return JSON.parse(cached) as Record<string, string>;
  } catch {
    /* ignore parse errors */
  }

  // Find the Google Translate language code
  const gtCode = SUPPORTED_LANGS.find((l) => l.code === lang)?.gtCode ?? 'en';

  const keys = Object.keys(EN_STRINGS);
  const values = Object.values(EN_STRINGS);
  const translated = await translateBatch(values, gtCode);

  const result: Record<string, string> = {};
  keys.forEach((k, i) => {
    result[k] = translated[i] ?? EN_STRINGS[k];
  });

  // Cache the result
  try {
    localStorage.setItem(cacheKey, JSON.stringify(result));
  } catch {
    /* quota exceeded — skip caching */
  }

  return result;
}

// ── Context ───────────────────────────────────────────────────────────────────
interface LanguageContextType {
  lang: LangCode;
  setLang: (l: LangCode) => void;
  t: (key: string) => string;
  translating: boolean;
}

const LanguageContext = createContext<LanguageContextType>({
  lang: 'EN',
  setLang: () => {},
  t: (k) => EN_STRINGS[k] ?? k,
  translating: false,
});

export const useLanguage = () => useContext(LanguageContext);

// ── Provider ──────────────────────────────────────────────────────────────────
export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const stored = (localStorage.getItem('bhima_lang') ?? 'EN') as LangCode;
  const [lang, setLangState] = useState<LangCode>(stored);
  const [strings, setStrings] = useState<Record<string, string>>(EN_STRINGS);
  const [translating, setTranslating] = useState(false);

  // Load translations whenever the language changes
  useEffect(() => {
    if (lang === 'EN') {
      setStrings(EN_STRINGS);
      return;
    }
    setTranslating(true);
    loadTranslations(lang)
      .then((result) => setStrings(result))
      .finally(() => setTranslating(false));
  }, [lang]);

  const setLang = useCallback((l: LangCode) => {
    setLangState(l);
    localStorage.setItem('bhima_lang', l);
  }, []);

  const t = useCallback(
    (key: string): string => strings[key] ?? EN_STRINGS[key] ?? key,
    [strings],
  );

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, translating }}>
      {children}
    </LanguageContext.Provider>
  );
};
