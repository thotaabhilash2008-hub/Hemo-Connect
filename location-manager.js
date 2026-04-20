// location-manager.js — Global Location Selector (GPS + Manual)

document.addEventListener('DOMContentLoaded', () => {
    // 1. Setup UI Injection
    const injectLocationSelector = () => {
        const navActions = document.querySelector('.nav-actions');
        if (!navActions) return;

        // Check if already injected
        if (document.querySelector('.location-container')) return;

        const container = document.createElement('div');
        container.className = 'location-container';
        
        const currentLoc = localStorage.getItem('global_location_name') || 'Select Location';

        container.innerHTML = `
            <div class="location-icon" id="locBtn">
                <span>📍</span>
                <span class="current-city" id="navCityName">${currentLoc}</span>
            </div>
            <div class="location-dropdown" id="locDropdown">
                <div class="loc-option" id="btnLiveLoc">
                    <i>📡</i>
                    <div class="loc-option-text">
                        <h5>Share Live Location</h5>
                        <p>Use your device's GPS for high accuracy</p>
                    </div>
                </div>
                <div class="loc-option" id="btnManualLoc">
                    <i>🏙️</i>
                    <div class="loc-option-text">
                        <h5>Enter Manually</h5>
                        <p>Search or select from the city list</p>
                    </div>
                </div>
                <div id="manualSearchArea" style="display:none; padding: 15px; border-top: 1px solid rgba(255,255,255,0.1);">
                    <div style="position:relative; margin-bottom: 12px;">
                        <input type="text" id="citySearchInput" placeholder="Type city name..." 
                               style="width: 100%; background: rgba(0,0,0,0.3); border: 1px solid #00d2ff; border-radius: 10px; padding: 10px 12px; color: white; outline: none; font-size: 14px;">
                        <span style="position:absolute; right: 12px; top: 10px; opacity: 0.5;">🔍</span>
                    </div>
                    <div id="manualCityList">
                        ${Object.keys(window.cityCoords || {}).map(city => `
                            <div class="city-item" data-city="${city}">${city}</div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;

        navActions.prepend(container);

        // 2. Event Listeners
        const locBtn = document.getElementById('locBtn');
        const locDropdown = document.getElementById('locDropdown');
        const btnLive = document.getElementById('btnLiveLoc');
        const btnManual = document.getElementById('btnManualLoc');
        const cityList = document.getElementById('manualCityList');

        locBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            locDropdown.classList.toggle('show');
        });

        document.addEventListener('click', (e) => {
            if (!container.contains(e.target)) locDropdown.classList.remove('show');
        });

        btnManual.addEventListener('click', (e) => {
            e.stopPropagation();
            const searchArea = document.getElementById('manualSearchArea');
            searchArea.style.display = searchArea.style.display === 'none' ? 'block' : 'none';
            if (searchArea.style.display === 'block') document.getElementById('citySearchInput').focus();
        });

        // Search/Filter Logic
        const searchInput = document.getElementById('citySearchInput');
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            document.querySelectorAll('.city-item').forEach(item => {
                const city = item.getAttribute('data-city').toLowerCase();
                item.style.display = city.includes(query) ? 'block' : 'none';
            });
        });

        searchInput.addEventListener('click', (e) => e.stopPropagation());

        // Manual City Selection
        document.querySelectorAll('.city-item').forEach(item => {
            item.addEventListener('click', () => {
                const city = item.getAttribute('data-city');
                const coords = window.cityCoords[city];
                saveLocation(city, coords.lat, coords.lng);
                locDropdown.classList.remove('show');
                if (window.notify) window.notify(`📍 Location set to ${city}`);
            });
        });

        // Live Location Selection
        btnLive.addEventListener('click', () => {
            if (!navigator.geolocation) {
                alert('Geolocation is not supported by your browser');
                return;
            }

            btnLive.innerHTML = '<i>⏳</i><div class="loc-option-text"><h5>Fetching GPS...</h5><p>Please allow access</p></div>';

            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const { latitude, longitude } = pos.coords;
                    // For demo, we'll try to find the nearest city or just mark as 'Live Location'
                    saveLocation('Live Location', latitude, longitude);
                    locDropdown.classList.remove('show');
                    btnLive.innerHTML = '<i>📡</i><div class="loc-option-text"><h5>Share Live Location</h5><p>Use your device\'s GPS</p></div>';
                    if (window.notify) window.notify('📍 Live GPS location shared');
                },
                (err) => {
                    console.error('Geolocation error:', err);
                    alert('Could not fetch your live location. Please select manually.');
                    btnLive.innerHTML = '<i>📡</i><div class="loc-option-text"><h5>Share Live Location</h5><p>Use your device\'s GPS</p></div>';
                }
            );
        });
    };

    function saveLocation(name, lat, lng) {
        localStorage.setItem('global_location_name', name);
        localStorage.setItem('global_lat', lat);
        localStorage.setItem('global_lng', lng);
        
        const display = document.getElementById('navCityName');
        if (display) display.textContent = name;

        // Trigger custom event for other scripts to update
        window.dispatchEvent(new CustomEvent('locationUpdated', { detail: { name, lat, lng } }));
    }

    window.triggerLocationPrompt = function(callback) {
        const locDropdown = document.getElementById('locDropdown');
        const locBtn = document.getElementById('locBtn');
        
        if (locDropdown) {
            locDropdown.classList.add('show');
            locBtn.classList.add('pulse-highlight');
            if (window.notify) window.notify('📍 Please select your location to continue');
        }

        // Listen for the selection once
        const onLocationSet = () => {
            locBtn.classList.remove('pulse-highlight');
            window.removeEventListener('locationUpdated', onLocationSet);
            if (callback) callback();
        };
        window.addEventListener('locationUpdated', onLocationSet);
    };

    // Style for the pulse highlight
    const style = document.createElement('style');
    style.textContent = `
        .pulse-highlight {
            animation: locPulse 1.5s infinite;
            border: 2px solid #00d2ff !important;
            border-radius: 12px;
            box-shadow: 0 0 15px #00d2ff !important;
        }
        @keyframes locPulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.1); }
            100% { transform: scale(1); }
        }
    `;
    document.head.appendChild(style);

    // Attempt injection immediately and after a short delay (for notifications.js)
    injectLocationSelector();
    setTimeout(injectLocationSelector, 500);
});
