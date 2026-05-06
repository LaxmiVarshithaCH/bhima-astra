import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export type LangCode = 'EN' | 'TE' | 'HI' | 'TA';

// ── Translations ─────────────────────────────────────────────────────────────
const T: Record<LangCode, Record<string, string>> = {
  EN: {
    // Nav
    dashboard: 'Dashboard', policy: 'Policy', payouts: 'Payouts',
    forecasts: 'Forecasts', plans: 'Plans', profile: 'Profile',
    sign_out: 'Sign Out',

    // Profile page
    personal_info: 'Personal Information',
    full_name: 'Full Name', phone: 'Phone', email: 'Email', city: 'City',
    save_changes: 'Save Changes', saved: '✓ Saved',
    upi_accounts: 'UPI Accounts', add_upi: '+ Add UPI ID', cancel: '✕ Cancel',
    set_primary: 'Set Primary', primary: 'Primary', add: 'Add',
    zone_settings: 'Zone Settings', update_zone: 'Update Zone',
    notifications: 'Notifications',
    payout_alerts: 'Payout Alerts', payout_alerts_desc: 'Get notified on every payout',
    whatsapp: 'WhatsApp', whatsapp_desc: 'Messages via WhatsApp',
    email_notif: 'Email', email_notif_desc: 'Weekly summaries & updates',
    sms: 'SMS', sms_desc: 'Critical event alerts only',
    language: 'Language',
    danger_zone: '⚠ Danger Zone',
    danger_desc: 'Deleting your account is irreversible. All your policies, payout history, and data will be permanently removed.',
    delete_account: 'Delete Account',
    delete_confirm: 'Are you absolutely sure? This cannot be undone.',
    yes_delete: 'Yes, Delete',
    download_pdf: 'Download Policy PDF',
    fraud_risk: 'Fraud Risk Score',
    kyc_verified: 'KYC Verified', kyc_pending: 'KYC Pending',
    plan_label: 'Plan', active: 'Active', renew_in: 'd left',

    // Dashboard
    live_weather: 'Live Weather',
    weekly_forecast: '7-Day Risk Forecast',
    good_morning: 'Good Morning', good_afternoon: 'Good Afternoon',
    good_evening: 'Good Evening', good_night: 'Good Night',
    worker: 'Worker',

    // Policy
    coverage_triggers: 'Coverage Triggers',
    trigger: 'Trigger', threshold: 'Threshold', payout: 'Payout',
    level: 'Level', status: 'Status',
    rainfall: 'Rainfall', aqi: 'AQI', heat_index: 'Heat Index',
    cyclone: 'Cyclone', hailstorm: 'Hailstorm',
    event_cap: 'Event Cap', used: 'Used',
    max_payout: 'Max payout', this_month: 'this month',
    live_thresholds: 'Live Thresholds', live_data: 'Live Data',
    policy_exclusions: 'Policy Exclusions',
    covered: 'Covered', near: 'Near', trigger_ready: 'Trigger Ready',
    not_included: 'Not Included',

    // Payouts
    my_payouts: 'My Payouts', earnings: 'Earnings',
    total_earned: 'Total Earned', events_covered: 'Events Covered',
    pending_payouts: 'Pending Payouts', last_payout: 'Last Payout',

    // Forecasts
    forecast: 'Weather Forecast', loading: 'Loading…',
    aqi_unavailable: 'AQI Unavailable',
  },

  TE: {
    // Nav
    dashboard: 'డ్యాష్‌బోర్డ్', policy: 'పాలసీ', payouts: 'చెల్లింపులు',
    forecasts: 'వాతావరణ అంచనా', plans: 'ప్లాన్లు', profile: 'ప్రొఫైల్',
    sign_out: 'సైన్ అవుట్',

    // Profile
    personal_info: 'వ్యక్తిగత సమాచారం',
    full_name: 'పూర్తి పేరు', phone: 'ఫోన్', email: 'ఇమెయిల్', city: 'నగరం',
    save_changes: 'మార్పులు సేవ్ చేయి', saved: '✓ సేవ్ అయింది',
    upi_accounts: 'UPI ఖాతాలు', add_upi: '+ UPI ID జోడించు', cancel: '✕ రద్దు',
    set_primary: 'ప్రాథమికం చేయి', primary: 'ప్రాథమికం', add: 'జోడించు',
    zone_settings: 'జోన్ సెట్టింగ్లు', update_zone: 'జోన్ నవీకరించు',
    notifications: 'నోటిఫికేషన్లు',
    payout_alerts: 'చెల్లింపు హెచ్చరికలు', payout_alerts_desc: 'ప్రతి చెల్లింపుపై నోటిఫికేషన్ పొందండి',
    whatsapp: 'వాట్సాప్', whatsapp_desc: 'వాట్సాప్ ద్వారా సందేశాలు',
    email_notif: 'ఇమెయిల్', email_notif_desc: 'వారపు సారాంశాలు',
    sms: 'SMS', sms_desc: 'క్లిష్టమైన ఈవెంట్ హెచ్చరికలు',
    language: 'భాష',
    danger_zone: '⚠ డేంజర్ జోన్',
    danger_desc: 'మీ ఖాతాను తొలగించడం తిరిగి మార్చలేనిది. అన్ని పాలసీలు, చెల్లింపు చరిత్ర శాశ్వతంగా తొలగించబడతాయి.',
    delete_account: 'ఖాతా తొలగించు',
    delete_confirm: 'మీరు ఖచ్చితంగా అనుకుంటున్నారా? ఇది రద్దు చేయలేరు.',
    yes_delete: 'అవును, తొలగించు',
    download_pdf: 'పాలసీ PDF డౌన్‌లోడ్',
    fraud_risk: 'మోసం రిస్క్ స్కోర్',
    kyc_verified: 'KYC ధృవీకరించబడింది', kyc_pending: 'KYC పెండింగ్',
    plan_label: 'ప్లాన్', active: 'యాక్టివ్', renew_in: 'రోజులు మిగిలాయి',

    // Dashboard
    live_weather: 'లైవ్ వాతావరణం',
    weekly_forecast: '7-రోజుల రిస్క్ అంచనా',
    good_morning: 'శుభోదయం', good_afternoon: 'శుభ మధ్యాహ్నం',
    good_evening: 'శుభ సాయంత్రం', good_night: 'శుభ రాత్రి',
    worker: 'కార్మికుడు',

    // Policy
    coverage_triggers: 'కవరేజ్ ట్రిగ్గర్లు',
    trigger: 'ట్రిగ్గర్', threshold: 'థ్రెషోల్డ్', payout: 'చెల్లింపు',
    level: 'స్థాయి', status: 'స్థితి',
    rainfall: 'వర్షపాతం', aqi: 'AQI', heat_index: 'వేడి సూచిక',
    cyclone: 'తుపాను', hailstorm: 'వడగళ్ళ వాన',
    event_cap: 'ఈవెంట్ పరిమితి', used: 'ఉపయోగించబడింది',
    max_payout: 'గరిష్ఠ చెల్లింపు', this_month: 'ఈ నెల',
    live_thresholds: 'లైవ్ థ్రెషోల్డ్లు', live_data: 'లైవ్ డేటా',
    policy_exclusions: 'పాలసీ మినహాయింపులు',
    covered: 'కవర్ చేయబడింది', near: 'దగ్గర', trigger_ready: 'ట్రిగ్గర్ సిద్ధం',
    not_included: 'చేర్చబడలేదు',

    // Payouts
    my_payouts: 'నా చెల్లింపులు', earnings: 'సంపాదన',
    total_earned: 'మొత్తం సంపాదించింది', events_covered: 'కవర్ అయిన ఈవెంట్లు',
    pending_payouts: 'పెండింగ్ చెల్లింపులు', last_payout: 'చివరి చెల్లింపు',

    // Forecasts
    forecast: 'వాతావరణ అంచనా', loading: 'లోడ్ అవుతోంది…',
    aqi_unavailable: 'AQI అందుబాటులో లేదు',
  },

  HI: {
    // Nav
    dashboard: 'डैशबोर्ड', policy: 'पॉलिसी', payouts: 'भुगतान',
    forecasts: 'मौसम पूर्वानुमान', plans: 'प्लान', profile: 'प्रोफ़ाइल',
    sign_out: 'साइन आउट',

    // Profile
    personal_info: 'व्यक्तिगत जानकारी',
    full_name: 'पूरा नाम', phone: 'फ़ोन', email: 'ईमेल', city: 'शहर',
    save_changes: 'बदलाव सहेजें', saved: '✓ सहेजा गया',
    upi_accounts: 'UPI खाते', add_upi: '+ UPI ID जोड़ें', cancel: '✕ रद्द करें',
    set_primary: 'प्राथमिक सेट करें', primary: 'प्राथमिक', add: 'जोड़ें',
    zone_settings: 'जोन सेटिंग', update_zone: 'जोन अपडेट करें',
    notifications: 'सूचनाएं',
    payout_alerts: 'भुगतान अलर्ट', payout_alerts_desc: 'हर भुगतान पर सूचना पाएं',
    whatsapp: 'व्हाट्सएप', whatsapp_desc: 'व्हाट्सएप के माध्यम से संदेश',
    email_notif: 'ईमेल', email_notif_desc: 'साप्ताहिक सारांश',
    sms: 'SMS', sms_desc: 'केवल गंभीर इवेंट अलर्ट',
    language: 'भाषा',
    danger_zone: '⚠ खतरा क्षेत्र',
    danger_desc: 'आपका खाता हटाना अपरिवर्तनीय है। सभी पॉलिसी, भुगतान इतिहास और डेटा स्थायी रूप से हटा दिए जाएंगे।',
    delete_account: 'खाता हटाएं',
    delete_confirm: 'क्या आप बिल्कुल निश्चित हैं? यह पूर्ववत नहीं किया जा सकता।',
    yes_delete: 'हाँ, हटाएं',
    download_pdf: 'पॉलिसी PDF डाउनलोड',
    fraud_risk: 'धोखाधड़ी जोखिम स्कोर',
    kyc_verified: 'KYC सत्यापित', kyc_pending: 'KYC लंबित',
    plan_label: 'प्लान', active: 'सक्रिय', renew_in: 'दिन बाकी',

    // Dashboard
    live_weather: 'लाइव मौसम',
    weekly_forecast: '7-दिन जोखिम पूर्वानुमान',
    good_morning: 'सुप्रभात', good_afternoon: 'शुभ दोपहर',
    good_evening: 'शुभ संध्या', good_night: 'शुभ रात्रि',
    worker: 'कर्मचारी',

    // Policy
    coverage_triggers: 'कवरेज ट्रिगर',
    trigger: 'ट्रिगर', threshold: 'सीमा', payout: 'भुगतान',
    level: 'स्तर', status: 'स्थिति',
    rainfall: 'वर्षा', aqi: 'AQI', heat_index: 'ताप सूचकांक',
    cyclone: 'चक्रवात', hailstorm: 'ओलावृष्टि',
    event_cap: 'इवेंट सीमा', used: 'उपयोग किया',
    max_payout: 'अधिकतम भुगतान', this_month: 'इस महीने',
    live_thresholds: 'लाइव थ्रेशोल्ड', live_data: 'लाइव डेटा',
    policy_exclusions: 'पॉलिसी बहिष्करण',
    covered: 'कवर्ड', near: 'निकट', trigger_ready: 'ट्रिगर तैयार',
    not_included: 'शामिल नहीं',

    // Payouts
    my_payouts: 'मेरे भुगतान', earnings: 'कमाई',
    total_earned: 'कुल कमाई', events_covered: 'कवर्ड इवेंट',
    pending_payouts: 'लंबित भुगतान', last_payout: 'अंतिम भुगतान',

    // Forecasts
    forecast: 'मौसम पूर्वानुमान', loading: 'लोड हो रहा है…',
    aqi_unavailable: 'AQI अनुपलब्ध',
  },

  TA: {
    // Nav
    dashboard: 'டாஷ்போர்டு', policy: 'பாலிசி', payouts: 'கொடுப்பனவுகள்',
    forecasts: 'வானிலை முன்னறிவிப்பு', plans: 'திட்டங்கள்', profile: 'சுயவிவரம்',
    sign_out: 'வெளியேறு',

    // Profile
    personal_info: 'தனிப்பட்ட தகவல்',
    full_name: 'முழு பெயர்', phone: 'தொலைபேசி', email: 'மின்னஞ்சல்', city: 'நகரம்',
    save_changes: 'மாற்றங்களை சேமி', saved: '✓ சேமிக்கப்பட்டது',
    upi_accounts: 'UPI கணக்குகள்', add_upi: '+ UPI ID சேர்', cancel: '✕ ரத்து செய்',
    set_primary: 'முதன்மையாக அமை', primary: 'முதன்மை', add: 'சேர்',
    zone_settings: 'மண்டல அமைப்புகள்', update_zone: 'மண்டலம் புதுப்பி',
    notifications: 'அறிவிப்புகள்',
    payout_alerts: 'கொடுப்பனவு எச்சரிக்கை', payout_alerts_desc: 'ஒவ்வொரு கொடுப்பனவிலும் அறிவிப்பு',
    whatsapp: 'வாட்ஸ்அப்', whatsapp_desc: 'வாட்ஸ்அப் மூலம் செய்திகள்',
    email_notif: 'மின்னஞ்சல்', email_notif_desc: 'வாராந்திர சுருக்கங்கள்',
    sms: 'SMS', sms_desc: 'முக்கியமான நிகழ்வு எச்சரிக்கைகள் மட்டும்',
    language: 'மொழி',
    danger_zone: '⚠ ஆபத்து மண்டலம்',
    danger_desc: 'உங்கள் கணக்கை நீக்குவது மீளாத செயல். அனைத்து பாலிசிகளும், கொடுப்பனவு வரலாறும் நிரந்தரமாக அழிக்கப்படும்.',
    delete_account: 'கணக்கை நீக்கு',
    delete_confirm: 'நீங்கள் உறுதியாக இருக்கிறீர்களா? இதை மீளவும் செய்ய முடியாது.',
    yes_delete: 'ஆம், நீக்கு',
    download_pdf: 'பாலிசி PDF பதிவிறக்கம்',
    fraud_risk: 'மோசடி அபாய மதிப்பெண்',
    kyc_verified: 'KYC சரிபார்க்கப்பட்டது', kyc_pending: 'KYC நிலுவையில்',
    plan_label: 'திட்டம்', active: 'செயலில்', renew_in: 'நாட்கள் மீதம்',

    // Dashboard
    live_weather: 'நேரடி வானிலை',
    weekly_forecast: '7-நாள் அபாய முன்னறிவிப்பு',
    good_morning: 'காலை வணக்கம்', good_afternoon: 'மதிய வணக்கம்',
    good_evening: 'மாலை வணக்கம்', good_night: 'இரவு வணக்கம்',
    worker: 'தொழிலாளர்',

    // Policy
    coverage_triggers: 'காப்பீட்டு தூண்டிகள்',
    trigger: 'தூண்டி', threshold: 'வரம்பு', payout: 'கொடுப்பனவு',
    level: 'நிலை', status: 'நிலைமை',
    rainfall: 'மழைப்பொழிவு', aqi: 'AQI', heat_index: 'வெப்ப குறியீடு',
    cyclone: 'சூறாவளி', hailstorm: 'ஆலங்கட்டி மழை',
    event_cap: 'நிகழ்வு வரம்பு', used: 'பயன்படுத்தப்பட்டது',
    max_payout: 'அதிகபட்ச கொடுப்பனவு', this_month: 'இந்த மாதம்',
    live_thresholds: 'நேரடி வரம்புகள்', live_data: 'நேரடி தரவு',
    policy_exclusions: 'பாலிசி விலக்குகள்',
    covered: 'காப்பீடு', near: 'அருகில்', trigger_ready: 'தூண்டி தயார்',
    not_included: 'சேர்க்கப்படவில்லை',

    // Payouts
    my_payouts: 'என் கொடுப்பனவுகள்', earnings: 'வருவாய்',
    total_earned: 'மொத்த வருவாய்', events_covered: 'காப்பீட்டு நிகழ்வுகள்',
    pending_payouts: 'நிலுவையில் உள்ள கொடுப்பனவுகள்', last_payout: 'கடைசி கொடுப்பனவு',

    // Forecasts
    forecast: 'வானிலை முன்னறிவிப்பு', loading: 'ஏற்றுகிறது…',
    aqi_unavailable: 'AQI கிடைக்கவில்லை',
  },
};

// ── Context ───────────────────────────────────────────────────────────────────
interface LanguageContextType {
  lang: LangCode;
  setLang: (l: LangCode) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  lang: 'EN',
  setLang: () => {},
  t: (k) => k,
});

export const useLanguage = () => useContext(LanguageContext);

// ── Provider ──────────────────────────────────────────────────────────────────
export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const stored = (localStorage.getItem('bhima_lang') ?? 'EN') as LangCode;
  const [lang, setLangState] = useState<LangCode>(stored);

  const setLang = useCallback((l: LangCode) => {
    setLangState(l);
    localStorage.setItem('bhima_lang', l);
  }, []);

  const t = useCallback(
    (key: string): string => T[lang]?.[key] ?? T['EN']?.[key] ?? key,
    [lang],
  );

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
};
