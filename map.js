// map.js — Real-time visualization of donors and patients using Leaflet.js

document.addEventListener('DOMContentLoaded', async () => {
    const statsEl = document.getElementById('stats');
    
    // Initialize Map centered on India
    const map = L.map('map').setView([20.5937, 78.9629], 5);

    // Dark Theme Tiles (CartoDB Dark Matter)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(map);

    /**
     * Helper to add random jitter to coordinates so markers don't overlap in the same city
     */
    function jitter(coord) {
        return coord + (Math.random() - 0.5) * 0.08;
    }

    /**
     * Custom Marker Factory
     */
    function createNeonMarker(color) {
        return L.divIcon({
            className: 'neon-marker',
            html: `<div class="marker-inner" style="background: ${color}; color: ${color}; border-color: white;"></div>`,
            iconSize: [20, 20],
            iconAnchor: [10, 10]
        });
    }

    const donorLayer = L.layerGroup().addTo(map);
    const patientLayer = L.layerGroup().addTo(map);

    async function loadNetworkData() {
        if (!window.db) {
            statsEl.textContent = 'Database not connected.';
            return;
        }

        try {
            // 1. Fetch Donors
            const { data: donors, error: donorErr } = await window.db
                .from('donors')
                .select('name, city, blood_group, lat, lng, available')
                .limit(200);

            // 2. Fetch Active Requests (Patients)
            const { data: requests, error: reqErr } = await window.db
                .from('requests')
                .select('blood_group, urgency, city, lat, lng, status')
                .neq('status', 'completed')
                .limit(100);

            donorLayer.clearLayers();
            patientLayer.clearLayers();

            let activeDonors = 0;
            let activeReqs = 0;

            // Plot Donors
            if (!donorErr && donors) {
                donors.forEach(d => {
                    if (d.lat && d.lng) {
                        activeDonors++;
                        L.marker([jitter(d.lat), jitter(d.lng)], {
                            icon: createNeonMarker('#39ff14')
                        }).bindPopup(`
                            <div style="color: #0f172a; font-family: 'Outfit', sans-serif;">
                                <strong style="color: #2d6a4f;">🩸 Donor: ${d.name}</strong><br>
                                📍 ${d.city}<br>
                                🧬 Group: ${d.blood_group}<br>
                                ✨ Status: ${d.available ? 'Available' : 'Busy'}
                            </div>
                        `).addTo(donorLayer);
                    }
                });
            }

            // Plot Patients (Requests)
            if (!reqErr && requests) {
                requests.forEach(r => {
                    if (r.lat && r.lng) {
                        activeReqs++;
                        L.marker([jitter(r.lat), jitter(r.lng)], {
                            icon: createNeonMarker('#ff3131')
                        }).bindPopup(`
                            <div style="color: #0f172a; font-family: 'Outfit', sans-serif;">
                                <strong style="color: #d62828;">⚠️ Patient Request</strong><br>
                                📍 ${r.city}<br>
                                🧬 Group: ${r.blood_group}<br>
                                🔥 Urgency: ${r.urgency.toUpperCase()}
                            </div>
                        `).addTo(patientLayer);
                    }
                });
            }

            statsEl.innerHTML = `📡 <strong>${activeDonors}</strong> Donors | 🚨 <strong>${activeReqs}</strong> Live Requests`;

        } catch (err) {
            console.error('Error loading map data:', err);
            statsEl.textContent = 'Error syncing live network.';
        }
    }

    // Initial load
    loadNetworkData();

    // Auto-refresh every 30 seconds
    setInterval(loadNetworkData, 30000);
});
