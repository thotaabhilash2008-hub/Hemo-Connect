// ============================================================
// request.js — Blood Request: Hospitals & Donors Dual Flow
// ============================================================

// ── Active Flow State ──────────────────────────────────────
// 'hospital' | 'donor'
let activeFlow = 'hospital';

// ══════════════════════════════════════════════════════════
//  FLOW TOGGLE HELPERS
// ══════════════════════════════════════════════════════════

/**
 * Switch to the Hospital search flow.
 * Hides the donor section, shows the hospital section,
 * and updates toggle button styles + submit button visibility.
 */
window.showHospitalSection = function () {
    console.log('[FlowToggle] Switched to → Hospital flow');
    activeFlow = 'hospital';

    // Toggle button styles
    document.getElementById('btnHospitalFlow').classList.add('active');
    document.getElementById('btnDonorFlow').classList.remove('active');

    // Section visibility
    document.getElementById('hospitalSection').style.display = 'block';
    document.getElementById('donorSection').style.display = 'none';

    // Submit button swap
    document.getElementById('findHospitalsBtn').style.display = 'flex';
    document.getElementById('findDonorsBtn').style.display = 'none';
};

/**
 * Switch to the Donor search flow.
 * Hides the hospital section, shows the donor section,
 * and updates toggle button styles + submit button visibility.
 */
window.showDonorSection = function () {
    console.log('[FlowToggle] Switched to → Donor flow');
    activeFlow = 'donor';

    // Toggle button styles
    document.getElementById('btnDonorFlow').classList.add('active');
    document.getElementById('btnHospitalFlow').classList.remove('active');

    // Section visibility
    document.getElementById('donorSection').style.display = 'block';
    document.getElementById('hospitalSection').style.display = 'none';

    // Submit button swap
    document.getElementById('findDonorsBtn').style.display = 'flex';
    document.getElementById('findHospitalsBtn').style.display = 'none';
};

// ══════════════════════════════════════════════════════════
//  HOSPITAL FLOW
// ══════════════════════════════════════════════════════════

/**
 * Validates inputs then renders nearby hospital cards.
 * Called by the "Find Nearby Hospitals" button.
 */
window.searchHospitals = function () {
    console.log('[searchHospitals] Button clicked');
    if (!validateSharedInputs()) return;

    if (window.triggerLocationPrompt) {
        window.triggerLocationPrompt(() => {
            const city = localStorage.getItem('global_location_name');
            const bloodGroup = document.getElementById('bloodGroup').value;
            const hospitalsList = document.getElementById('hospitalsList');
            const hospitalSummary = document.getElementById('hospitalSummary');
            const hospitalCount = document.getElementById('hospitalCount');

            hospitalsList.innerHTML = `
                <div class="loading-state">
                    <div class="spinner"></div>
                    <p>Searching nearby hospitals in ${city}…</p>
                </div>`;

            setTimeout(() => {
                const hospitals = generateNearbyHospitals(city, bloodGroup);
                hospitalSummary.innerHTML = `<strong>📍 Showing results near:</strong> ${city} &nbsp;|&nbsp; Blood group: <strong>${bloodGroup}</strong>`;
                hospitalCount.textContent = `${hospitals.length} found`;
                displayHospitals(hospitals);
            }, 600);
        });
    }
};

window.findDonors = async function () {
    console.log('[findDonors] Button clicked');
    if (!validateSharedInputs()) return;

    if (window.triggerLocationPrompt) {
        window.triggerLocationPrompt(async () => {
            const donorsList = document.getElementById('donorsList');
            const donorSummary = document.getElementById('donorSummary');
            const donorCount = document.getElementById('donorCount');
            const findDonorsBtn = document.getElementById('findDonorsBtn');
            const selectedBlood = document.getElementById('bloodGroup').value;
            const city = localStorage.getItem('global_location_name');

            findDonorsBtn.disabled = true;
            findDonorsBtn.textContent = '⏳ Searching donors…';
            donorsList.innerHTML = `
                <div class="loading-state">
                    <div class="spinner"></div>
                    <p>Scanning network for ${selectedBlood} donors in ${city}…</p>
                </div>`;

            if (!window.db) {
                donorsList.innerHTML = `<div class="empty-state-msg"><p>Database connection unavailable.</p></div>`;
                resetFindDonorsBtn();
                return;
            }

            try {
                const coords = getRequestCoords();
                let { data, error } = await window.db
                    .from('donors')
                    .select('*')
                    .eq('blood_group', selectedBlood)
                    .eq('available', true)
                    .eq('city', city);

                if (!data || data.length === 0) {
                    const res2 = await window.db.from('donors').select('*').eq('blood_group', selectedBlood).eq('available', true);
                    data = res2.data || [];
                }

                const enriched = data.map(d => ({
                    ...d,
                    _distance: calculateDistance(coords.lat, coords.lng, d.lat, d.lng),
                    _sameCity: d.city === city
                })).sort((a, b) => a._distance - b._distance);

                donorSummary.innerHTML = `<strong>📍 Near:</strong> ${city} | ${enriched.length} donor(s) found`;
                donorCount.textContent = `${enriched.length} found`;
                displayDonors(enriched);
                saveRequestAndNotify(selectedBlood, city, coords, enriched);
            } catch (err) {
                console.error(err);
                donorsList.innerHTML = `<div class="empty-state-msg"><p>Search failed: ${err.message}</p></div>`;
            } finally {
                resetFindDonorsBtn();
            }
        });
    }
};

/**
 * Generates a list of mock nearby hospitals for the given city.
 */
function generateNearbyHospitals(city, bloodGroup) {
    const base = [
        { name: 'City Central Hospital',  status: 'Available',    units: '4 units', color: '#2d6a4f' },
        { name: 'Metro Blood Bank',        status: 'Low Stock',    units: '1 unit',  color: '#fb8500' },
        { name: 'Sunrise Care Clinic',     status: 'Out of Stock', units: '0 units', color: '#d62828' },
        { name: 'National Blood Centre',   status: 'Available',    units: '6 units', color: '#2d6a4f' },
        { name: 'Apollo Blood Services',   status: 'Low Stock',    units: '2 units', color: '#fb8500' },
    ];
    return base.map((item, index) => ({
        ...item,
        distance: `${(1.2 + index * 1.8).toFixed(1)} km`,
        label: `${city} — ${item.name}`
    }));
}

/**
 * Renders hospital cards into #hospitalsList.
 */
function displayHospitals(hospitals) {
    const hospitalsList = document.getElementById('hospitalsList');
    if (!hospitals || hospitals.length === 0) {
        hospitalsList.innerHTML = `
            <div class="empty-state-msg">
                <div class="empty-icon">🏥</div>
                <p>No hospitals found nearby. Try a different city.</p>
            </div>`;
        return;
    }

    hospitalsList.innerHTML = hospitals.map(h => {
        const isOut     = h.status === 'Out of Stock';
        const badgeClass = isOut ? 'badge-out' : (h.status === 'Low Stock' ? 'badge-low' : 'badge-available');
        return `
        <div class="result-card">
            <div class="result-card-icon icon-hospital">🏥</div>
            <div class="result-card-info">
                <h4>${h.label}</h4>
                <p>📍 ${h.distance} &nbsp;|&nbsp; 🩸 ${h.units}
                   &nbsp;<span class="badge-status ${badgeClass}">${h.status}</span>
                </p>
            </div>
            <button
                class="action-btn action-btn-hospital"
                onclick="selectEntity('${encodeURIComponent(h.name)}', 'hospital')"
                ${isOut ? 'disabled' : ''}
            >
                Request
            </button>
        </div>`;
    }).join('');
}

// ══════════════════════════════════════════════════════════
//  DONOR FLOW
// ══════════════════════════════════════════════════════════

/**
 * Validates inputs, then fetches donors from Supabase.
 * Called by the "Find Donors" button.
 */
window.findDonors = async function () {
    console.log('[findDonors] Button clicked');

    if (!validateSharedInputs()) return;

    const selectedBlood = document.getElementById('bloodGroup').value;
    const city          = getCity();
    const donorsList    = document.getElementById('donorsList');
    const donorSummary  = document.getElementById('donorSummary');
    const donorCount    = document.getElementById('donorCount');
    const findDonorsBtn = document.getElementById('findDonorsBtn');

    // Loading UI
    findDonorsBtn.disabled    = true;
    findDonorsBtn.textContent = '⏳ Searching donors…';
    donorsList.innerHTML = `
        <div class="loading-state">
            <div class="spinner"></div>
            <p>Searching donors nearby…</p>
        </div>`;
    donorSummary.innerHTML = `Searching for <strong>${selectedBlood}</strong> donors near <strong>${city}</strong>…`;
    donorCount.textContent = '…';

    // Guard: Supabase must be ready
    if (!window.db) {
        console.error('[findDonors] Supabase client (window.db) is not initialised!');
        donorsList.innerHTML = `
            <div class="empty-state-msg">
                <div class="empty-icon">⚠️</div>
                <p>Database connection unavailable. Please refresh and try again.</p>
            </div>`;
        resetFindDonorsBtn();
        return;
    }

    try {
        // ── Supabase query: try city-scoped first, fall back to nationwide ──
        const useLiveGPS = !!(window.sharedLocation && window.sharedLocation.lat);
        const coords     = getRequestCoords(city);

        console.log(`[findDonors] Querying Supabase → blood_group=${selectedBlood}, available=true, city=${city}`);

        // Step 1: try same-city donors first
        let { data, error } = await window.db
            .from('donors')
            .select('*')
            .eq('blood_group', selectedBlood)
            .eq('available', true)
            .eq('city', city);

        if (error) throw error;

        // Step 2: if no city match, fetch all matching blood_group nationwide
        let broadSearch = false;
        if (!data || data.length === 0) {
            console.warn(`[findDonors] No donors in ${city} — widening to nationwide search`);
            const res2 = await window.db
                .from('donors')
                .select('*')
                .eq('blood_group', selectedBlood)
                .eq('available', true);
            if (res2.error) {
                console.error('[findDonors] Nationwide fetch error:', res2.error.message);
            } else {
                data = res2.data;
                broadSearch = true;
            }
        }

        if (!data || data.length === 0) {
            donorSummary.innerHTML = `No available <strong>${selectedBlood}</strong> donors found near <strong>${city}</strong>.`;
            donorCount.textContent = '0 found';
            donorsList.innerHTML = `
                <div class="empty-state-msg">
                    <div class="empty-icon">🩸</div>
                    <p>No donors available for blood group <strong>${selectedBlood}</strong>.<br>
                       Please try again later or check nearby hospitals.</p>
                </div>`;
            return;
        }

        // Enrich with distance, sorted: same-city first, then by distance
        const enriched = data.map(donor => {
            const hasCoords  = donor.lat && donor.lng;
            const sameCity   = (donor.city || '').toLowerCase() === city.toLowerCase();
            const distance   = (useLiveGPS || hasCoords)
                ? calculateDistance(coords.lat, coords.lng, donor.lat || 0, donor.lng || 0)
                : null;
            return { ...donor, _distance: distance, _sameCity: sameCity };
        }).sort((a, b) => {
            if (a._sameCity !== b._sameCity) return a._sameCity ? -1 : 1;
            if (a._distance !== null && b._distance !== null) return a._distance - b._distance;
            return 0;
        });

        const scopeLabel = broadSearch
            ? `<em style="font-size:12px;color:#e76f51">(No donors in ${city} — showing nationwide results)</em>`
            : '';
        donorSummary.innerHTML = `<strong>📍 Near:</strong> ${city} &nbsp;|&nbsp; Blood group: <strong>${selectedBlood}</strong> &nbsp;|&nbsp; ${enriched.length} donor(s) found ${scopeLabel}`;
        donorCount.textContent = `${enriched.length} found`;
        displayDonors(enriched);

        // Save request and notify (non-blocking for the UI reset)
        saveRequestAndNotify(selectedBlood, city, coords, enriched).catch(err => {
            console.warn('[findDonors] saveRequestAndNotify error:', err.message);
        });

    } catch (err) {
        console.error('[findDonors] Search failed:', err.message);
        donorsList.innerHTML = `
            <div class="empty-state-msg">
                <div class="empty-icon">❌</div>
                <p>Failed to fetch donors: ${err.message}. Please try again.</p>
            </div>`;
    } finally {
        resetFindDonorsBtn();
    }
};

/**
 * Renders donor cards into #donorsList.
 * @param {Array} data - Enriched donor rows from Supabase.
 */
window.displayDonors = function (data) {
    const donorsList = document.getElementById('donorsList');
    if (!data || data.length === 0) {
        donorsList.innerHTML = `
            <div class="empty-state-msg">
                <div class="empty-icon">🩸</div>
                <p>No donors available nearby.</p>
            </div>`;
        return;
    }

    donorsList.innerHTML = data.map(donor => {
        const donorName = donor.name || 'Anonymous Donor';
        const donorId   = donor.id   || '';

        // Build location label precisely — never show a fake distance
        let locParts = [];
        if (donor._sameCity) {
            locParts.push('📍 Same city');
        } else if (donor.city) {
            locParts.push(`📍 ${donor.city}`);
        }
        if (donor._distance !== null && donor._distance !== undefined) {
            locParts.push(`~${donor._distance} km away`);
        }
        const locLabel = locParts.length ? locParts.join(' · ') : 'Location unavailable';

        // Availability tag
        const availTag = donor.available
            ? `<span style="font-size:11px;background:#e8f5e9;color:#2d6a4f;padding:2px 8px;border-radius:10px;font-weight:600;">Available</span>`
            : `<span style="font-size:11px;background:#fff3e0;color:#e65100;padding:2px 8px;border-radius:10px;font-weight:600;">Busy</span>`;

        return `
        <div class="result-card">
            <div class="result-card-icon icon-donor">🩸</div>
            <div class="result-card-info">
                <h4>${donorName} ${availTag}</h4>
                <p>${locLabel}
                   &nbsp;&nbsp;<span class="blood-badge">${donor.blood_group || ''}</span>
                </p>
            </div>
            <button
                class="action-btn action-btn-donor"
                data-donor-id="${donorId}"
                data-donor-name="${encodeURIComponent(donorName)}"
                onclick="selectEntity('${encodeURIComponent(donorName)}', 'donor', '${donorId}')"
            >
                Request Donor
            </button>
        </div>`;
    }).join('');
};

function resetFindDonorsBtn() {
    const btn = document.getElementById('findDonorsBtn');
    if (btn) {
        btn.disabled     = false;
        btn.textContent  = '🩸 Find Donors';
    }
}

// ══════════════════════════════════════════════════════════
//  SHARED UTILITIES
// ══════════════════════════════════════════════════════════

/** Validates blood group + city before any search */
function validateSharedInputs() {
    const bloodGroup = document.getElementById('bloodGroup').value;
    
    if (!bloodGroup) {
        alert('Please select a blood group first.');
        document.getElementById('bloodGroup').focus();
        return false;
    }
    return true;
}

/** Returns the current city string from global storage */
function getCity() {
    return localStorage.getItem('global_location_name') || 'Unknown';
}

/** Returns {lat, lng} for request origin from global storage */
function getRequestCoords() {
    const lat = localStorage.getItem('global_lat');
    const lng = localStorage.getItem('global_lng');
    return { 
        lat: lat ? parseFloat(lat) : 0, 
        lng: lng ? parseFloat(lng) : 0 
    };
}

/** Haversine-approximation distance in km */
function calculateDistance(lat1, lng1, lat2, lng2) {
    if (!lat1 || !lng1 || !lat2 || !lng2) return 30;
    const dlat   = lat2 - lat1;
    const dlng   = lng2 - lng1;
    const rawKm  = Math.sqrt(dlat * dlat + dlng * dlng) * 111;
    return parseFloat(Math.max(0.5, Math.min(rawKm, 50)).toFixed(1));
}

/**
 * Called when user clicks "Request Donor" or "Request" on a hospital card.
 * Saves tracking data to localStorage, then navigates to tracking.html.
 * For donors, looks up the matching donor_request row so tracking.js
 * can subscribe to real-time status updates.
 *
 * @param {string} encodedName  - encodeURIComponent(name)
 * @param {string} type         - 'donor' | 'hospital'
 * @param {string} [donorId]    - donor.id from Supabase (optional for hospitals)
 */
window.selectEntity = async function (encodedName, type, donorId) {
    if (sessionStorage.getItem('isGuest') === 'true') {
        alert('Please sign in to send requests.');
        window.location.href = 'auth.html';
        return;
    }

    const name      = decodeURIComponent(encodedName);
    const requestId = localStorage.getItem('request_id');
    console.log(`[selectEntity] Selected ${type}: ${name} | donor_id=${donorId} | request_id=${requestId}`);

    localStorage.setItem('tracking_entity', name);
    localStorage.setItem('tracking_entity_type', type);

    // ── Look up the donor_request row so tracking.js can use its id ──
    if (type === 'donor' && donorId && requestId && window.db) {
        try {
            const { data: drRows, error: drErr } = await window.db
                .from('donor_requests')
                .select('id')
                .eq('donor_id', donorId)
                .eq('request_id', requestId)
                .limit(1);

            if (!drErr && drRows && drRows.length > 0) {
                localStorage.setItem('donor_request_id', drRows[0].id);
                console.log('[selectEntity] donor_request_id saved:', drRows[0].id);
            } else {
                // donor_request row not found (request wasn't saved yet) — clear stale id
                localStorage.removeItem('donor_request_id');
                console.warn('[selectEntity] No donor_request row found for this donor+request combo');
            }
        } catch (err) {
            console.warn('[selectEntity] donor_request lookup failed:', err.message);
            localStorage.removeItem('donor_request_id');
        }
    } else {
        localStorage.removeItem('donor_request_id');
    }

    if (window.notify) window.notify(`Your request has been sent to ${name}.`);
    window.location.href = 'tracking.html';
};

// Backwards-compat alias
window.selectDonor = (name, type = 'donor') => window.selectEntity(encodeURIComponent(name), type);

// ══════════════════════════════════════════════════════════
//  SUPABASE — SAVE REQUEST + NOTIFY DONORS
// ══════════════════════════════════════════════════════════

async function saveRequestAndNotify(bloodGroup, city, coords, matchedDonors) {
    if (!window.db) return;

    const urgency = document.querySelector('input[name="urgencyLevel"]:checked')?.value || 'normal';

    // Persist to localStorage
    localStorage.setItem('request_blood_group', bloodGroup);
    localStorage.setItem('request_city', city);
    localStorage.setItem('request_urgency', urgency);
    localStorage.setItem('request_lat', coords.lat);
    localStorage.setItem('request_lng', coords.lng);

    // Insert request row
    let requestId = null;
    try {
        const { data, error } = await window.db
            .from('requests')
            .insert([{ blood_group: bloodGroup, urgency, city, lat: coords.lat, lng: coords.lng, status: 'searching' }])
            .select();

        if (error) throw error;
        if (data && data[0]) {
            requestId = data[0].id;
            localStorage.setItem('request_id', requestId);
            console.log('✅ Request saved:', requestId);
        }
    } catch (err) {
        console.warn('⚠️ Supabase request insert failed:', err.message);
    }

    // Insert donor_requests rows
    if (requestId && matchedDonors.length > 0) {
        try {
            const payload = matchedDonors.map(d => ({
                donor_id:    d.id,
                donor_name:  d.name,
                entity_type: 'donor',
                request_id:  requestId,
                status:      'pending'
            }));
            const { error: drErr } = await window.db.from('donor_requests').insert(payload);
            if (drErr) throw drErr;
            console.log(`✅ Created ${payload.length} donor_request records`);
        } catch (err) {
            console.warn('⚠️ donor_requests insert failed:', err.message);
        }
    }

    // Email notifications (if EmailJS is configured)
    const emailConfigured = window.emailjs
        && window.EMAILJS_PUBLIC_KEY
        && window.EMAILJS_SERVICE_ID !== 'YOUR_SERVICE_ID'
        && window.EMAILJS_TEMPLATE_ID !== 'YOUR_TEMPLATE_ID';

    const emailNotificationArea = document.getElementById('emailNotificationArea');
    const notified = [];

    if (emailConfigured && matchedDonors.length > 0 && requestId) {
        if (!window._emailjsInitialized) {
            emailjs.init(window.EMAILJS_PUBLIC_KEY);
            window._emailjsInitialized = true;
        }
        const acceptUrl = `${window.location.origin}/respond.html?request_id=${encodeURIComponent(requestId)}&action=accept`;
        const rejectUrl = `${window.location.origin}/respond.html?request_id=${encodeURIComponent(requestId)}&action=reject`;

        matchedDonors.forEach(donor => {
            if (!donor.email) { return; }
            notified.push(donor.name || donor.email);
            emailjs.send(window.EMAILJS_SERVICE_ID, window.EMAILJS_TEMPLATE_ID, {
                to_name: donor.name, to_email: donor.email,
                blood_group: bloodGroup, city, urgency,
                action_accept_url: acceptUrl, action_reject_url: rejectUrl,
                app_url: window.location.origin + '/donate.html'
            }).then(() => {
                console.log(`📧 Email sent to ${donor.name} (${donor.email})`);
            }).catch(err => {
                console.warn(`Email failed for ${donor.email}:`, err);
            });
        });
    }

    if (emailNotificationArea) {
        if (notified.length > 0) {
            emailNotificationArea.innerHTML = `📧 Notifications sent to: <strong>${notified.join(', ')}</strong>.`;
            emailNotificationArea.style.display = 'block';
        } else {
            emailNotificationArea.style.display = 'none';
        }
    }
}

// ══════════════════════════════════════════════════════════
//  INIT — Load existing request status on page load
// ══════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
    // Default to hospital flow
    showHospitalSection();

    // Load any existing request status
    const savedRequestId = localStorage.getItem('request_id');
    if (savedRequestId) {
        loadExistingRequestStatus(savedRequestId);
    }
});

async function loadExistingRequestStatus(requestId) {
    const requestStatusArea = document.getElementById('requestStatusArea');
    if (!requestStatusArea || !window.db) return;

    try {
        const [{ data: req, error: reqErr }, { data: drRows }] = await Promise.all([
            window.db.from('requests').select('*').eq('id', requestId).single(),
            window.db.from('donor_requests').select('*').eq('request_id', requestId).order('created_at', { ascending: false })
        ]);

        if (reqErr || !req) { requestStatusArea.style.display = 'none'; return; }

        const statusMap = {
            accepted:  '✅ Your request has been accepted.',
            declined:  '❌ Your request was declined. Continuing search for other donors.',
            cancelled: '⚠️ This request has been cancelled.',
            searching: '⏳ Your request is still searching for a donor.'
        };
        let text = statusMap[req.status] || `Request <strong>${requestId}</strong>: <strong>${req.status}</strong>`;

        if (drRows && drRows.length) {
            const latest = drRows[0];
            text += `<br>Latest donor: <strong>${latest.donor_name || 'Unknown'}</strong> — ${latest.status}`;
        }

        requestStatusArea.innerHTML = text;
        requestStatusArea.style.display = 'block';
    } catch (err) {
        console.warn('Failed to load existing request status:', err.message);
        requestStatusArea.style.display = 'none';
    }
}
