// donate.js — Save donor with email + real-time incoming request alerts

let donorBloodGroup = null;
let donorCity       = null;
let realtimeChannel = null;
let currentRequests = [];

const requestListSection = document.getElementById('requestListSection');
const requestListContainer = document.getElementById('requestListContainer');
const requestListSummary = document.getElementById('requestListSummary');

const storedDonorId = localStorage.getItem('donor_id');
const storedDonorName = localStorage.getItem('donor_name');
const storedDonorEmail = localStorage.getItem('donor_email');

if (storedDonorId || storedDonorName) {
    loadDonorRequests();
}

document.getElementById('donateForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    if (sessionStorage.getItem('isGuest') === 'true') {
        alert('Please sign in to register as a donor.');
        window.location.href = 'auth.html';
        return;
    }

    const confirmationArea = document.getElementById('confirmationArea');
    const btn = this.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.innerHTML = '⏳ Saving...';

    const name         = document.getElementById('donorNameInput').value.trim();
    const email        = document.getElementById('donorEmail').value.trim();
    const blood_group  = document.getElementById('bloodGroupDon').value;

    if (window.triggerLocationPrompt) {
        window.triggerLocationPrompt(async () => {
            const city = localStorage.getItem('global_location_name');
            const lat  = localStorage.getItem('global_lat');
            const lng  = localStorage.getItem('global_lng');

            const coords = { lat: parseFloat(lat), lng: parseFloat(lng) };
            const availability = document.getElementById('availabilitySelect').value;
            const donationType = document.getElementById('interactionTypeSelectDon').value;

    donorBloodGroup = blood_group;
    donorCity       = city;

    const isAvailable = availability === 'available';

    const donorPayload = {
        name,
        email,
        blood_group,
        city,
        lat: coords.lat,
        lng: coords.lng,
        available: isAvailable
        // NOTE: response_score omitted — only include if the column exists in Supabase
    };

    let donorId = null;
    let savedToCloud = false;

    if (window.db) {
        try {
            let existingDonorId = localStorage.getItem('donor_id');
            const forceNew = document.getElementById('createNewProfile')?.checked;

            // ── Fallback: if no ID in local storage, check by email ──
            if (!existingDonorId && !forceNew) {
                try {
                    const { data: byEmail, error: emailErr } = await window.db
                        .from('donors')
                        .select('id')
                        .eq('email', email)
                        .maybeSingle();
                    
                    if (!emailErr && byEmail) {
                        existingDonorId = byEmail.id;
                        localStorage.setItem('donor_id', existingDonorId);
                        console.log('ℹ️ Found existing donor ID by email:', existingDonorId);
                    }
                } catch (e) {
                    console.warn('⚠️ Could not check existing donor by email (column might be missing):', e.message);
                }
            }

            // Prepare payload — we'll try to include email but be ready for it to fail
            const payload = { ...donorPayload };

            if (existingDonorId && !forceNew) {
                // ── UPDATE existing donor row ──────────────────────────
                const { error } = await window.db
                    .from('donors')
                    .update(payload)
                    .eq('id', existingDonorId);
                
                if (error) {
                    if (error.message.includes('email')) {
                        console.warn('⚠️ email column missing in Supabase, retrying update without it...');
                        delete payload.email;
                        const { error: error2 } = await window.db.from('donors').update(payload).eq('id', existingDonorId);
                        if (error2) throw error2;
                    } else { throw error; }
                }
                donorId = existingDonorId;
                savedToCloud = true;
                console.log('✅ Donor record UPDATED in Supabase:', donorId);
            } else {
                // ── INSERT new donor row ───────────────────────────────
                let { data, error } = await window.db
                    .from('donors')
                    .insert([payload])
                    .select();
                
                if (error) {
                    if (error.message.includes('email')) {
                        console.warn('⚠️ email column missing in Supabase, retrying insert without it...');
                        delete payload.email;
                        const res2 = await window.db.from('donors').insert([payload]).select();
                        if (res2.error) throw res2.error;
                        data = res2.data;
                    } else { throw error; }
                }

                if (data && data[0]) {
                    donorId = data[0].id;
                    
                    // Track multiple profiles for this browser
                    let allIds = JSON.parse(localStorage.getItem('all_donor_ids') || '[]');
                    if (!allIds.includes(donorId)) allIds.push(donorId);
                    localStorage.setItem('all_donor_ids', JSON.stringify(allIds));

                    localStorage.setItem('donor_id', donorId); // keep last one for compat
                    localStorage.setItem('donor_name', name);
                    localStorage.setItem('donor_email', email);
                }
                savedToCloud = true;
                console.log('✅ Donor INSERTED to Supabase, id:', donorId);
            }

            // Start direct request listening for this specific donor ID
            if (donorId) subscribeToDirectRequests(donorId, name);

        } catch (err) {
            console.error('❌ Supabase donor save failed:', err.message);
            let userMsg = `❌ <strong>Could not save your profile.</strong><br>
                <small style="color:#888;">Error: ${err.message}</small>`;
            
            if (err.message.includes('column "email"')) {
                userMsg += `<br><small style="color:#d62828;">Hint: The 'email' column is missing in your Supabase 'donors' table. Please add it to enable notifications.</small>`;
            }
            
            confirmationArea.innerHTML = userMsg;
            confirmationArea.style.color = '#d62828';
            return; 
        } finally {
            btn.disabled = false;
            btn.innerHTML = 'Update Status';
        }
    } else {
        console.warn('⚠️ Supabase not initialised.');
        btn.disabled = false;
        btn.innerHTML = 'Update Status';
    }

    let typeMessage = '';
    if (donationType === 'free')      typeMessage = '<br>Registered as Free Donation.';
    else if (donationType === 'mutual')    typeMessage = '<br>Registered with Mutual Support option.';
    else if (donationType === 'emergency') typeMessage = '<br>Registered under Emergency Priority.';

    if (availability === 'available') {
        const cloudMsg = savedToCloud ? ' Your profile is <strong>live</strong>.' : '';
        confirmationArea.innerHTML = `✅ You are registered as a donor!${cloudMsg}${typeMessage}<br><small style="color:#888;">You will receive an email alert when someone nearby needs your blood type.</small>`;
        confirmationArea.style.color = '#2a9d8f';

        // Start real-time subscription for incoming requests
        subscribeToRequests(blood_group, name);
        loadDonorRequests();
    } else {
        confirmationArea.innerHTML = '⏸️ Your status is marked as unavailable.';
        confirmationArea.style.color = '#e76f51';
    }

    if (window.notify) {
        window.notify(availability === 'available'
            ? '🩸 You are now registered as a donor!'
            : '⏸️ Donor status updated to unavailable.');
    }
        });
    }
});

// ── Real-time subscription for incoming blood requests ──────────
async function subscribeToRequests(bloodGroup, donorName) {
    if (!window.db) return;

    // Clean up any old channel
    if (realtimeChannel) window.db.removeChannel(realtimeChannel);

    donorBloodGroup = bloodGroup;

    realtimeChannel = window.db
        .channel('incoming-requests-' + bloodGroup)
        .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'requests' },
            payload => {
                const req = payload.new;
                if (!req) return;

                const matchesGroup = req.blood_group === bloodGroup || req.blood_group === bloodGroup.replace('+', '');
                const matchesCity = !donorCity || req.city === donorCity;
                if (matchesGroup && matchesCity) {
                    addRequestToList(req);
                    showIncomingRequestAlert(req, donorName);
                }
            }
        )
        .subscribe(status => {
            if (status === 'SUBSCRIBED') {
                console.log('📡 Real-time active: watching for', bloodGroup, 'requests');
            }
        });

    // Fetch any existing matching requests immediately
    const initialRequests = await fetchMatchingRequests(bloodGroup, donorCity);
    if (initialRequests.length > 0) {
        initialRequests.forEach(r => addRequestToList(r));
    }
}

// ── Show popup alert for donor — with Accept / Decline ─────────────
function showIncomingRequestAlert(req, donorName) {
    const respondUrl = `respond.html?request_id=${req.id}`;
    if (window.notify) {
        window.notify(`🚨 ${req.blood_group} blood needed in ${req.city || 'your area'}!`, {
            url: respondUrl,
            type: 'request'
        });
    }

    // Remove stale banner if any
    const existing = document.getElementById('requestAlertBanner');
    if (existing) existing.remove();

    const banner = document.createElement('div');
    banner.id = 'requestAlertBanner';
    banner.style.cssText = `
        position: fixed; top: 80px; left: 50%; transform: translateX(-50%);
        background: #1d3557; color: white; padding: 22px 28px;
        border-radius: 14px; box-shadow: 0 8px 40px rgba(29,53,87,0.5);
        z-index: 9999; font-family: 'Outfit', sans-serif;
        text-align: center; animation: slideDown 0.4s ease;
        max-width: 92%; min-width: 340px;
        border-top: 4px solid #d62828;
    `;
    banner.innerHTML = `
        <div style="font-size:20px; font-weight:700; margin-bottom:6px; color:#ffd166;">🚨 Incoming Blood Request!</div>
        <div style="font-size:15px; margin-bottom:4px;">
            <strong style="color:#ff6b6b;">${req.blood_group}</strong> blood needed in
            <strong>${req.city || 'nearby'}</strong>
        </div>
        <div style="font-size:13px; color:#adb5bd; margin-bottom:16px;">
            Urgency: <strong style="color:#ffd166;">${req.urgency || 'Normal'}</strong>
        </div>
        <div style="display:flex; gap:12px; justify-content:center;">
            <button id="donorAcceptBtn" style="
                background:#2a9d8f; color:white; border:none;
                padding:10px 24px; border-radius:8px; font-weight:700;
                font-size:15px; cursor:pointer;">✅ Accept</button>
            <button id="donorDeclineBtn" style="
                background:transparent; color:white; border:2px solid #888;
                padding:10px 18px; border-radius:8px; font-weight:600;
                font-size:14px; cursor:pointer;">❌ Decline</button>
        </div>
        <div id="donorResponseMsg" style="margin-top:12px; font-size:13px; color:#adb5bd;"></div>
    `;
    document.body.appendChild(banner);

    // ── Accept ──────────────────────────────────────────────────────
    banner.querySelector('#donorAcceptBtn').addEventListener('click', async () => {
        const msg = banner.querySelector('#donorResponseMsg');
        msg.textContent = '⏳ Confirming...';

        if (window.db && req.id) {
            try {
                // Update donor_requests row → 'accepted' (triggers tracking page via real-time)
                await window.db
                    .from('donor_requests')
                    .update({ status: 'accepted' })
                    .eq('request_id', req.id)
                    .eq('status', 'pending');

                // Also update the parent request
                await window.db
                    .from('requests')
                    .update({ status: 'accepted' })
                    .eq('id', req.id);

                console.log('✅ Donor accepted request:', req.id);
            } catch (err) {
                console.warn('Accept update failed:', err.message);
            }
        }

        msg.innerHTML = '✅ <strong>Accepted!</strong> The requester has been notified.';
        msg.style.color = '#2a9d8f';
        banner.querySelector('#donorAcceptBtn').disabled  = true;
        banner.querySelector('#donorDeclineBtn').disabled = true;
        if (window.notify) window.notify('✅ You accepted the blood request!');
        setTimeout(() => banner.remove(), 4000);
    });

    // ── Decline ─────────────────────────────────────────────────────
    banner.querySelector('#donorDeclineBtn').addEventListener('click', async () => {
        const msg = banner.querySelector('#donorResponseMsg');
        msg.textContent = '⏳ Declining...';

        if (window.db && req.id) {
            try {
                await window.db
                    .from('donor_requests')
                    .update({ status: 'declined' })
                    .eq('request_id', req.id)
                    .eq('status', 'pending');

                console.log('❌ Donor declined request:', req.id);
            } catch (err) {
                console.warn('Decline update failed:', err.message);
            }
        }

        msg.innerHTML = '❌ Declined. The requester will be notified.';
        msg.style.color = '#e76f51';
        banner.querySelector('#donorAcceptBtn').disabled  = true;
        banner.querySelector('#donorDeclineBtn').disabled = true;
        if (window.notify) window.notify('❌ You declined the request.');
        setTimeout(() => banner.remove(), 3500);
    });

    // Auto-dismiss after 30s if no action taken
    setTimeout(() => {
        const b = document.getElementById('requestAlertBanner');
        if (b) b.remove();
    }, 30000);
}

function updateRequestSection() {
    const count = currentRequests.length;
    if (!requestListSection || !requestListContainer || !requestListSummary) return;

    requestListSection.style.display = count > 0 ? 'block' : 'none';
    requestListSummary.textContent = count > 0
        ? `${count} request${count === 1 ? '' : 's'} waiting for your response.`
        : 'Waiting for matching requests...';
}

function getCurrentDonorFilter() {
    const donorId = localStorage.getItem('donor_id');
    const donorName = localStorage.getItem('donor_name');
    return { donorId, donorName };
}

async function loadDonorRequests() {
    if (!window.db) return;

    const { donorId, donorName } = getCurrentDonorFilter();
    if (!donorId && !donorName) return;

    try {
        let query = window.db.from('donor_requests').select('*, requests(*)');

        if (donorId) {
            query = query.eq('donor_id', donorId);
        } else {
            query = query.eq('donor_name', donorName);
        }

        const { data, error } = await query.order('created_at', { ascending: false });
        if (error) throw error;

        if (Array.isArray(data) && data.length > 0) {
            data.forEach(row => {
                const requestInfo = row.requests || {};
                addRequestToList({
                    donor_request_id: row.id,
                    request_id: row.request_id,
                    blood_group: requestInfo.blood_group || requestInfo.blood_group,
                    city: requestInfo.city || 'Unknown',
                    urgency: requestInfo.urgency || 'Normal',
                    notes: requestInfo.notes || '',
                    patient_name: requestInfo.patient_name || requestInfo.requester_name || '',
                    patient_contact: requestInfo.patient_contact || '',
                    status: row.status || 'pending'
                });
            });
        }
    } catch (err) {
        console.warn('Failed to load donor requests:', err.message);
    }
}

function addRequestToList(req) {
    if (!req) return;

    const uniqueId = req.donor_request_id || req.request_id || req.id;
    if (!uniqueId) return;
    if (currentRequests.some(item => (item.donor_request_id || item.request_id || item.id) === uniqueId)) return;

    currentRequests.unshift(req);
    renderRequestList();
}

function removeRequestFromList(requestKey) {
    currentRequests = currentRequests.filter(item => {
        const uniqueId = item.donor_request_id || item.request_id || item.id;
        return uniqueId !== requestKey;
    });
    renderRequestList();
}

function renderRequestList() {
    if (!requestListContainer) return;

    requestListContainer.innerHTML = '';
    if (currentRequests.length === 0) {
        updateRequestSection();
        return;
    }

    currentRequests.forEach(req => {
        const card = document.createElement('div');
        card.style.cssText = 'background:#ffffff; border:1px solid #e5e5e5; border-radius:18px; padding:18px; box-shadow:0 10px 28px rgba(15,23,42,0.08);'
        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:14px; margin-bottom:14px;">
                <div>
                    <div style="font-size:16px; font-weight:700; color:#1d3557;">${req.blood_group || 'Blood request'}</div>
                    <div style="font-size:14px; color:#4a4a4a; margin-top:4px;">${req.city ? `Location: ${req.city}` : 'Location: Nearby'}</div>
                </div>
                <div style="font-size:13px; color:#888;">Urgency: <strong>${req.urgency || 'Normal'}</strong></div>
            </div>
            <div style="font-size:14px; color:#555; line-height:1.5; margin-bottom:16px;">
                Request ID: <strong>${req.request_id || req.id}</strong><br>
                Status: <strong>${req.status || 'pending'}</strong><br>
                ${req.notes ? `Notes: ${req.notes}<br>` : ''}
                ${req.patient_name ? `Patient: ${req.patient_name}<br>` : ''}
                ${req.patient_contact ? `Contact: ${req.patient_contact}` : ''}
            </div>
            <div style="display:flex; gap:10px; flex-wrap:wrap;">
                <button class="request-action-button accept-button" data-donor-request-id="${req.donor_request_id || ''}" data-request-id="${req.request_id || req.id}" style="background:#2a9d8f; color:#fff; border:none; padding:10px 18px; border-radius:10px; cursor:pointer;">Accept</button>
                <button class="request-action-button decline-button" data-donor-request-id="${req.donor_request_id || ''}" data-request-id="${req.request_id || req.id}" style="background:#f8f9fa; color:#1d3557; border:1px solid #d1d5db; padding:10px 18px; border-radius:10px; cursor:pointer;">Decline</button>
            </div>
        `;

        requestListContainer.appendChild(card);
    });

    requestListContainer.querySelectorAll('.request-action-button').forEach(button => {
        button.addEventListener('click', async event => {
            const donorRequestId = event.currentTarget.dataset.donorRequestId;
            const requestId = event.currentTarget.dataset.requestId;
            const isAccept = event.currentTarget.classList.contains('accept-button');
            if (!donorRequestId || !requestId) return;

            if (isAccept) {
                await respondToRequest(donorRequestId, requestId, true);
            } else {
                await respondToRequest(donorRequestId, requestId, false);
            }
        });
    });

    updateRequestSection();
}

async function fetchMatchingRequests(bloodGroup, city) {
    if (!window.db) return [];

    let query = window.db
        .from('requests')
        .select('*')
        .eq('status', 'searching');

    if (bloodGroup) query = query.eq('blood_group', bloodGroup);
    if (city) query = query.eq('city', city);

    try {
        const { data, error } = await query;
        if (error) throw error;
        return Array.isArray(data) ? data : [];
    } catch (err) {
        console.warn('Failed to load matching requests:', err.message);
        return [];
    }
}

async function respondToRequest(donorRequestId, requestId, accept) {
    if (!window.db) return;

    const statusUpdate = accept ? 'accepted' : 'declined';

    try {
        await window.db
            .from('donor_requests')
            .update({ status: statusUpdate })
            .eq('id', donorRequestId)
            .eq('status', 'pending');

        if (accept) {
            await window.db
                .from('requests')
                .update({ status: 'accepted' })
                .eq('id', requestId);
        }

        removeRequestFromList(donorRequestId);
        if (window.notify) {
            window.notify(accept ? '✅ Request accepted.' : '❌ Request declined.');
        }
    } catch (err) {
        console.warn('Failed to update request status:', err.message);
    }
}

// ── Notify donor on page load (simulated incoming) ──────────────
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (window.notify && sessionStorage.getItem('isGuest') !== 'true') {
            window.notify("🚨 URGENT: A patient nearby requires your blood type! Check requests.");
        }
    }, 4000);
});

// ── Real-time subscription for DIRECT requests sent to THIS donor ──────
let directRequestsChannel = null;
async function subscribeToDirectRequests(donorId, donorName) {
    if (!window.db || !donorId) return;
    
    // Clean up existing
    if (directRequestsChannel) window.db.removeChannel(directRequestsChannel);

    console.log(`📡 Subscribing to direct matches for: ${donorName} (${donorId})`);
    
    directRequestsChannel = window.db
        .channel('direct-matches-' + donorId)
        .on(
            'postgres_changes',
            { 
                event: 'INSERT', 
                schema: 'public', 
                table: 'donor_requests',
                filter: `donor_id=eq.${donorId}` 
            },
            async payload => {
                const dr = payload.new;
                console.log('🎯 Direct match received!', dr);
                
                // Fetch full request details to show in the list
                const { data: req } = await window.db
                    .from('requests')
                    .select('*')
                    .eq('id', dr.request_id)
                    .single();

                if (req) {
                    addRequestToList({
                        donor_request_id: dr.id,
                        request_id: dr.request_id,
                        blood_group: req.blood_group,
                        city: req.city,
                        urgency: req.urgency,
                        notes: req.notes,
                        patient_name: req.patient_name || req.requester_name,
                        status: dr.status || 'pending'
                    });
                }

                if (window.notify) {
                    window.notify(`📢 NEW REQUEST for ${donorName}! Someone needs your blood group. Click to respond.`, {
                        url: `respond.html?request_id=${dr.request_id}`,
                        type: 'accepted'
                    });
                }
            }
        )
        .subscribe(status => {
            console.log('📡 Direct subscription status:', status);
        });
}

// Check for existing donor and start direct listener on load
document.addEventListener('DOMContentLoaded', () => {
    const donorId = localStorage.getItem('donor_id');
    const donorName = localStorage.getItem('donor_name');
    if (donorId) {
        subscribeToDirectRequests(donorId, donorName || 'Donor');
    }
});
