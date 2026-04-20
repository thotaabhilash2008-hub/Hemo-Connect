-- Hemo Connect: Live Tracking & Donor Management Schema
-- Run this in your Supabase SQL Editor

-- 1. DONORS TABLE: Stores registered donor profiles
CREATE TABLE IF NOT EXISTS donors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    name TEXT NOT NULL,
    email TEXT UNIQUE,
    blood_group TEXT NOT NULL,
    city TEXT,
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    available BOOLEAN DEFAULT true,
    last_donation DATE
);

-- 2. REQUESTS TABLE: Stores initial blood requests from recipients
CREATE TABLE IF NOT EXISTS requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    blood_group TEXT NOT NULL,
    urgency TEXT NOT NULL, -- 'normal', 'priority', 'emergency'
    city TEXT NOT NULL,
    status TEXT DEFAULT 'pending', -- 'pending', 'fulfilled', 'cancelled'
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- 3. DONOR_REQUESTS TABLE: Junction table for live tracking of specific matches
CREATE TABLE IF NOT EXISTS donor_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    request_id UUID REFERENCES requests(id) ON DELETE CASCADE,
    donor_id UUID REFERENCES donors(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending', -- 'pending', 'accepted', 'declined', 'cancelled', 'in_transit', 'delivered'
    eta_mins INTEGER DEFAULT 15,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. ENABLE REAL-TIME
-- Important: Go to your Supabase Dashboard -> Database -> Replication
-- And enable the 'donor_requests' and 'requests' tables for the 'realtime' publication.
-- Or run:
ALTER PUBLICATION supabase_realtime ADD TABLE donor_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE requests;

-- 5. INDEXES for performance
CREATE INDEX IF NOT EXISTS idx_donors_blood_city ON donors(blood_group, city) WHERE available = true;
CREATE INDEX IF NOT EXISTS idx_dr_status ON donor_requests(status);

-- ── DATA & IMPACT TRACKING EXTENSIONS ──

-- 6. USER PROFILES: Stores extended impact data
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    total_donations INTEGER DEFAULT 0,
    lives_saved INTEGER DEFAULT 0,
    points INTEGER DEFAULT 0,
    last_donation_date TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. BADGES: Define available system badges
CREATE TABLE IF NOT EXISTS badges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    icon TEXT, -- Emoji or URL
    requirement_type TEXT, -- 'donations', 'emergency', 'consistency'
    requirement_value INTEGER
);

-- 8. USER BADGES: Links users to their earned badges
CREATE TABLE IF NOT EXISTS user_badges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    badge_id UUID REFERENCES badges(id) ON DELETE CASCADE,
    earned_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 9. SEED INITIAL BADGES (Optional)
INSERT INTO badges (name, description, icon, requirement_type, requirement_value)
VALUES 
    ('Beginner Donor', 'Unlocked after your 1st donation', '🥉', 'donations', 1),
    ('Regular Lifesaver', 'Awarded for 15 successful donations', '🥈', 'donations', 15),
    ('Guardian Angel', 'Unlocked after 50 life-saving donations', '🥇', 'donations', 50)
ON CONFLICT (name) DO NOTHING;

