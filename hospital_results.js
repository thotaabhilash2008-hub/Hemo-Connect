// hospital_results.js — Live geolocation + Supabase-powered nearby hospitals & donors

document.addEventListener('DOMContentLoaded', () => {
    const statusArea               = document.getElementById('statusArea');
    const hospResultsContainer     = document.getElementById('hospResultsContainer');
    const donorFallbackBtnContainer = document.getElementById('donorFallbackBtnContainer');
    const showDonorOptionsBtn      = document.getElementById('showDonorOptionsBtn');
    const donorFallbackSection     = document.getElementById('donorFallbackSection');
    const donorRequestForm         = document.getElementById('donorRequestForm');

    // ── Step 1: Acquire live location ──────────────────────────────
    statusArea.innerHTML = `<span style="color:#457b9d;"><strong>📍 Acquiring your location...</strong></span>`;

    function onLocationSuccess(position) {
        const userLat = position.coords.latitude;
        const userLng = position.coords.longitude;

        // Persist for downstream pages
        localStorage.setItem('user_lat', userLat);
        localStorage.setItem('user_lng', userLng);

        statusArea.innerHTML = `<span style="color:#2a9d8f;"><strong>📍 Location found — searching nearby hospitals...</strong></span>`;
        loadNearbyHospitals(userLat, userLng);
    }

    function onLocationError(err) {
        console.warn('Geolocation failed:', err.message);
        // Fallback: use city coords from request form
        const city = localStorage.getItem('request_city');
        const coords = (window.cityCoords && city && window.cityCoords[city])
            ? window.cityCoords[city]
            : { lat: 17.38, lng: 78.48 }; // Default: Hyderabad

        statusArea.innerHTML = `<span style="color:#fb8500;"><strong>⚠️ Using city location — searching nearby hospitals...</strong></span>`;
        loadNearbyHospitals(coords.lat, coords.lng);
    }

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(onLocationSuccess, onLocationError, {
            enableHighAccuracy: true,
            timeout: 3500,
            maximumAge: 0
        });
    } else {
        onLocationError({ message: 'Geolocation not supported' });
    }

    // ── Step 2: Load nearby hospitals (mock enriched with distance) ──
    function loadNearbyHospitals(lat, lng) {
        // Mock hospitals enriched with real-ish distances based on user coords
        // In production, replace with a real hospitals API (e.g. Google Places)
        const MOCK_HOSPITALS = [
            { name: 'City Central Hospital',  baseLat: lat + 0.012, baseLng: lng + 0.008, units: 4,  status: 'Available',    badgeClass: 'badge-available' },
            { name: 'Metro Blood Bank',        baseLat: lat - 0.031, baseLng: lng + 0.021, units: 1,  status: 'Low Stock',    badgeClass: 'badge-low'       },
            { name: 'Sunrise Care Clinic',     baseLat: lat + 0.045, baseLng: lng - 0.033, units: 0,  status: 'Out of Stock', badgeClass: 'badge-out'       },
            { name: 'Apollo Blood Centre',     baseLat: lat - 0.018, baseLng: lng - 0.015, units: 6,  status: 'Available',    badgeClass: 'badge-available' },
            { name: 'Rainbow Medical Hub',     baseLat: lat + 0.061, baseLng: lng + 0.042, units: 2,  status: 'Low Stock',    badgeClass: 'badge-low'       }
        ].map(h => {
            const dlat = h.baseLat - lat;
            const dlng = h.baseLng - lng;
            const distance = Math.sqrt(dlat * dlat + dlng * dlng) * 111;
            return { ...h, distance: parseFloat(distance.toFixed(1)) };
        }).sort((a, b) => a.distance - b.distance);

        setTimeout(() => {
            statusArea.innerHTML = `<span style="color:#2a9d8f;"><strong>✅ Found ${MOCK_HOSPITALS.length} nearby facilities.</strong></span>`;

            let html = '';
            MOCK_HOSPITALS.forEach(hosp => {
                const statusColor = hosp.badgeClass === 'badge-available' ? '#2a9d8f'
                    : hosp.badgeClass === 'badge-low' ? '#fb8500' : '#d62828';
                const canRequest = hosp.status !== 'Out of Stock';

                html += `
                    <div class="result-card" style="border-left: 4px solid ${statusColor};">
                        <div class="result-card-icon icon-hospital">🏥</div>
                        <div class="result-card-info">
                            <h4>${hosp.name}</h4>
                            <p>📍 ${hosp.distance} km away &nbsp;|&nbsp; ⏱️ Stock: <strong>${hosp.units} units</strong></p>
                            <div style="margin-top: 5px;">
                                <span class="section-badge" style="background:${statusColor}22; color:${statusColor}; border:1px solid ${statusColor}44;">${hosp.status}</span>
                            </div>
                        </div>
                        <button class="action-btn action-btn-hospital" 
                            ${canRequest ? `onclick="showModal('hospital', '${hosp.name}')"` : 'disabled'}
                            style="${!canRequest ? 'background:#ccc; cursor:not-allowed;' : ''}">
                            ${canRequest ? 'Request' : 'Out of Stock'}
                        </button>
                    </div>`;
            });

            hospResultsContainer.innerHTML = html;
            donorFallbackBtnContainer.style.display = 'block';
        }, 1200);
    }

    // ── Reveal donor fallback ────────────────────────────────────────
    if (showDonorOptionsBtn) {
        showDonorOptionsBtn.addEventListener('click', function() {
            donorFallbackBtnContainer.style.display = 'none';
            donorFallbackSection.style.display = 'block';
            donorFallbackSection.scrollIntoView({ behavior: 'smooth' });
        });
    }

    // ── Donor fallback form → go to donor_results.html ─────────────
    if (donorRequestForm) {
        donorRequestForm.addEventListener('submit', function(e) {
            e.preventDefault();
            if (sessionStorage.getItem('isGuest') === 'true') {
                alert('Please sign in to request from donors.');
                window.location.href = 'auth.html';
                return;
            }
            window.location.href = 'donor_results.html';
        });
    }
});

// ── Hospital "Contact / Request" button ─────────────────────────────
window.showModal = async function(type, name) {
    if (sessionStorage.getItem('isGuest') === 'true') {
        alert('Please sign in to send requests.');
        window.location.href = 'auth.html';
        return;
    }

    // Insert a donor_request row with status 'pending' so the donor can approve/decline
    let donorRequestId = null;
    if (window.db) {
        try {
            const { data, error } = await window.db
                .from('donor_requests')
                .insert([{
                    entity_name: name,
                    entity_type: type,
                    request_id:  localStorage.getItem('request_id') || null,
                    status:      'pending'
                }])
                .select();
            if (error) throw error;
            if (data && data[0]) {
                donorRequestId = data[0].id;
                localStorage.setItem('donor_request_id', donorRequestId);
            }
        } catch (err) {
            console.warn('donor_requests insert failed (table may not exist yet):', err.message);
        }
    }

    localStorage.setItem('tracking_entity', name);
    localStorage.setItem('tracking_entity_type', type);

    if (window.notify) {
        window.notify(`📤 Request sent to ${name}!`, {
            url: 'tracking.html',
            type: 'accepted'
        });
    }
    window.location.href = 'tracking.html';
};
