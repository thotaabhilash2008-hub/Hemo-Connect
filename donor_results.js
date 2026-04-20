// donor_results.js — Supabase-powered donor fetch with AI ranking

document.addEventListener('DOMContentLoaded', async () => {
    const statusArea           = document.getElementById('statusArea');
    const donorResultsContainer = document.getElementById('donorResultsContainer');
    const aiHeaderSection      = document.getElementById('aiHeaderSection');
    const aiToggleLabel        = document.getElementById('aiToggleLabel');
    const aiToggle             = document.getElementById('aiToggle');

    let donors = [];

    // --- Try to fetch from Supabase ---
    const requestedBloodGroup = localStorage.getItem('request_blood_group');
    const requestCity         = localStorage.getItem('request_city');

    // Prefer live geolocation; fall back to city coords
    const liveUserLat = parseFloat(localStorage.getItem('user_lat'));
    const liveUserLng = parseFloat(localStorage.getItem('user_lng'));
    const cityFallback = (window.cityCoords && requestCity && window.cityCoords[requestCity])
        ? window.cityCoords[requestCity] : null;

    const requestCoords = (!isNaN(liveUserLat) && !isNaN(liveUserLng))
        ? { lat: liveUserLat, lng: liveUserLng }
        : cityFallback;

    if (window.db && requestedBloodGroup) {
        try {
            const { data, error } = await window.db
                .from('donors')
                .select('*')
                .eq('blood_group', requestedBloodGroup)
                .eq('available', true);

            if (error) throw error;

            if (data && data.length > 0) {
                // Map Supabase rows → local format, calculating distance from request city
                donors = data.map(d => {
                    let distance = 5; // default km
                    if (requestCoords && d.lat && d.lng) {
                        // Simple Euclidean approximation (good enough for demo)
                        const dlat = d.lat - requestCoords.lat;
                        const dlng = d.lng - requestCoords.lng;
                        distance = Math.round(Math.sqrt(dlat * dlat + dlng * dlng) * 111); // 1° ≈ 111 km
                        distance = Math.max(0.5, Math.min(distance, 50)); // clamp 0.5–50 km
                    }
                    return {
                        id:            d.id,
                        name:          d.name,
                        bloodGroup:    d.blood_group,
                        city:          d.city || '–',
                        distance:      parseFloat(distance.toFixed(1)),
                        eta:           Math.round(distance * 3),   // rough ETA: 3 min/km
                        availability:  d.available ? 1 : 0,
                        responseScore: d.response_score || 0.80
                    };
                });
                console.log(`✅ Fetched ${donors.length} donor(s) from Supabase`);
            } else {
                console.log('ℹ️ No matching Supabase donors found for this request.');
                donors = [];
            }
        } catch (err) {
            console.warn('⚠️ Supabase fetch failed:', err.message);
            donors = [];
        }
    } else {
        donors = [];
    }

    // Show results after brief "matching" delay
    setTimeout(() => {
        statusArea.style.display   = 'none';
        aiHeaderSection.style.display = 'flex';
        aiToggleLabel.style.display   = 'block';
        renderDonors(aiToggle ? aiToggle.checked : true);
    }, 1800);

    if (aiToggle) {
        aiToggle.addEventListener('change', e => renderDonors(e.target.checked));
    }

    // ── AI Ranking & Render ──────────────────────────────────────
    function renderDonors(useAI) {
        // Score every donor
        donors.forEach(d => {
            d.score = (1 / (d.distance || 1)) * 0.5
                    + (d.availability * 0.2)
                    + ((d.responseScore || 0.8) * 0.3);
        });

        let bestMatch    = null;
        let fastest      = null;
        let mostReliable = null;

        if (useAI) {
            donors.sort((a, b) => b.score - a.score);
            bestMatch    = donors[0];
            fastest      = [...donors].sort((a, b) => a.distance - b.distance)[0];
            mostReliable = [...donors].sort((a, b) => b.responseScore - a.responseScore)[0];
        } else {
            donors.sort((a, b) => a.distance - b.distance);
        }

        let html = '';
        donors.forEach(donor => {
            const isTop     = useAI && donor === bestMatch;
            const statusColor = donor.availability ? '#2a9d8f' : '#888';

            let badges = '';
            if (useAI) {
                if (donor === bestMatch)
                    badges += `<span class="section-badge" style="background:#ffd16622; color:#d4a32a; border:1px solid #ffd16644;">🩸 Best Match</span>`;
                if (donor === fastest)
                    badges += `<span class="section-badge" style="background:#2a9d8f22; color:#1b7a6e; border:1px solid #2a9d8f44;">⚡ Fastest</span>`;
            }

            html += `
                <div class="result-card ${isTop ? 'ai-recommended' : ''}" style="border-left: 4px solid ${statusColor}; ${isTop ? 'background:#fff9e6;' : ''}">
                    <div class="result-card-icon icon-donor">🩸</div>
                    <div class="result-card-info">
                        <h4 style="display:flex; align-items:center; gap:8px;">
                            ${donor.name} 
                            <span class="blood-badge">${donor.bloodGroup}</span>
                        </h4>
                        <p>📍 ${donor.distance} km away &nbsp;|&nbsp; ⏱️ ETA: ${donor.eta} mins</p>
                        <div style="margin-top: 6px; display:flex; gap:6px;">
                            ${badges}
                        </div>
                    </div>
                    <button class="action-btn action-btn-donor" 
                        ${donor.availability ? `onclick="showModal('donor', '${donor.name}', '${donor.id || ''}')"` : 'disabled'}
                        style="${!donor.availability ? 'background:#ccc; cursor:not-allowed;' : ''}">
                        ${donor.availability ? 'Request' : 'Unavailable'}
                    </button>
                </div>`;
        });

        donorResultsContainer.innerHTML = html || '<p style="text-align:center;color:#888;">No matching donors found.</p>';
    }
});

// ── Route to tracking page on Accept — creates a pending donor_request ────
window.showModal = async function(type, name, donorId) {
    if (sessionStorage.getItem('isGuest') === 'true') {
        alert('Please sign in to send requests.');
        window.location.href = 'auth.html';
        return;
    }

    // Persist tracking info
    localStorage.setItem('tracking_entity',      name);
    localStorage.setItem('tracking_entity_type', type);
    if (donorId) localStorage.setItem('tracking_donor_id', donorId);

    // Insert a donor_request row with status 'pending'
    // The donor must approve → status becomes 'accepted' → tracking advances
    let donorRequestId = null;
    if (window.db) {
        try {
            const { data, error } = await window.db
                .from('donor_requests')
                .insert([{
                    donor_id:    donorId  || null,
                    donor_name:  name,
                    entity_type: type,
                    request_id:  localStorage.getItem('request_id') || null,
                    status:      'pending'
                }])
                .select();

            if (error) throw error;
            if (data && data[0]) {
                donorRequestId = data[0].id;
                localStorage.setItem('donor_request_id', donorRequestId);
                console.log('✅ donor_request created (pending):', donorRequestId);
            }
        } catch (err) {
            // Table may not exist yet in Supabase — gracefully fall through
            console.warn('donor_requests insert failed:', err.message);
        }
    }

    if (window.notify) {
        window.notify(`📤 Request sent to ${name}. Waiting for approval...`, {
            url: 'tracking.html',
            type: 'accepted'
        });
    }
    window.location.href = 'tracking.html';
};
