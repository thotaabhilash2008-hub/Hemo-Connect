// ============================================================
// supabase-config.js — BloodLink AI Database Configuration
// ============================================================

const SUPABASE_URL  = 'https://jrzuimnvzqvngrcuamln.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpyenVpbW52enF2bmdyY3VhbWxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0MjA0OTcsImV4cCI6MjA5MTk5NjQ5N30.kEZN1Uo5mTnf1QipsJY50vnHCLzW_37eBEjyT1FiFms';

// Initialize global Supabase client (loaded via CDN)
window.db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── Required Supabase tables ──────────────────────────────────────
// Table: donor_requests
//   id           uuid (PK, default gen_random_uuid())
//   request_id   uuid (FK → requests.id, nullable)
//   donor_id     uuid (FK → donors.id, nullable)
//   donor_name   text
//   entity_type  text  ('donor' | 'hospital')
//   status       text  ('pending' | 'accepted' | 'declined' | 'cancelled')
//   created_at   timestamptz (default now())
//
// Enable Realtime on this table in Supabase dashboard.
// ─────────────────────────────────────────────────────────────────

// Approximate coordinates for major Indian cities
window.cityCoords = {
    'Agra':          { lat: 27.18,  lng: 78.01 },
    'Ahmedabad':     { lat: 23.02,  lng: 72.57 },
    'Bengaluru':     { lat: 12.97,  lng: 77.59 },
    'Bhopal':        { lat: 23.25,  lng: 77.40 },
    'Chennai':       { lat: 13.08,  lng: 80.27 },
    'Delhi':         { lat: 28.70,  lng: 77.10 },
    'Hyderabad':     { lat: 17.38,  lng: 78.48 },
    'Indore':        { lat: 22.71,  lng: 75.85 },
    'Jaipur':        { lat: 26.91,  lng: 75.78 },
    'Kanpur':        { lat: 26.44,  lng: 80.33 },
    'Kochi':         { lat: 9.93,   lng: 76.26 },
    'Kolkata':       { lat: 22.56,  lng: 88.36 },
    'Lucknow':       { lat: 26.84,  lng: 80.94 },
    'Ludhiana':      { lat: 30.90,  lng: 75.85 },
    'Mumbai':        { lat: 19.07,  lng: 72.87 },
    'Nagpur':        { lat: 21.14,  lng: 79.08 },
    'Patna':         { lat: 25.59,  lng: 85.13 },
    'Pune':          { lat: 18.52,  lng: 73.85 },
    'Surat':         { lat: 21.17,  lng: 72.83 },
    'Thane':         { lat: 19.21,  lng: 72.97 },
    'Vadodara':      { lat: 22.30,  lng: 73.20 },
    'Visakhapatnam': { lat: 17.68,  lng: 83.21 }
};

console.log('✅ Supabase connected to BloodLink AI');

// ── EmailJS Configuration ────────────────────────────────────
// Sign up free at https://emailjs.com → get these 3 values
window.EMAILJS_PUBLIC_KEY  = 'YOUR_PUBLIC_KEY';   // Account → API Keys
window.EMAILJS_SERVICE_ID  = 'YOUR_SERVICE_ID';   // Email Services → Service ID
window.EMAILJS_TEMPLATE_ID = 'YOUR_TEMPLATE_ID';  // Email Templates → Template ID

if (window.emailjs) {
    if (window.EMAILJS_PUBLIC_KEY && window.EMAILJS_PUBLIC_KEY !== 'YOUR_PUBLIC_KEY') {
        emailjs.init(window.EMAILJS_PUBLIC_KEY);
        console.log('✅ EmailJS initialized');
    } else {
        console.warn('⚠️ EmailJS not initialized: set EMAILJS_PUBLIC_KEY, EMAILJS_SERVICE_ID, and EMAILJS_TEMPLATE_ID in supabase-config.js');
    }
}
