// donor_requests.js — Load donor request records and allow accept/decline responses

document.addEventListener('DOMContentLoaded', async () => {
    const requestsContainer = document.getElementById('donorRequestsContainer');
    const statusElement = document.getElementById('requestsStatus');

    if (sessionStorage.getItem('isGuest') === 'true') {
        statusElement.textContent = 'Please sign in to view your donor requests.';
        return;
    }

    const donorId = localStorage.getItem('donor_id');
    const allIds  = JSON.parse(localStorage.getItem('all_donor_ids') || '[]');
    const donorName = localStorage.getItem('donor_name');
    const donorEmail = localStorage.getItem('donor_email');

    // Ensure current donorId is in allIds
    if (donorId && !allIds.includes(donorId)) allIds.push(donorId);

    if (allIds.length === 0 && !donorName) {
        statusElement.textContent = 'No donor profile found. Register as a donor first on the Donate page.';
        return;
    }

    statusElement.textContent = 'Loading your request list...';
    await loadRequestList();

    async function loadRequestList() {
        if (!window.db) {
            statusElement.textContent = 'Unable to connect to the database.';
            return;
        }

        try {
            console.log('📡 Fetching donor requests for IDs:', allIds, 'or Name:', donorName);

            // Use .in() for multiple IDs if we have them
            let query = window.db.from('donor_requests').select('*, requests(*)');
            
            if (allIds.length > 0) {
                query = query.in('donor_id', allIds);
            } else {
                query = query.eq('donor_name', donorName);
            }

            const { data, error } = await query.order('created_at', { ascending: false });
            
            if (error) {
                console.warn('Primary query failed, trying fallback (no join):', error.message);
                // Fallback: try without the join
                const fallbackQuery = window.db.from('donor_requests').select('*');
                const { data: fData, error: fError } = await (allIds.length > 0 
                    ? fallbackQuery.in('donor_id', allIds) 
                    : fallbackQuery.eq('donor_name', donorName)
                ).order('created_at', { ascending: false });

                if (fError) throw fError;
                renderRequestCards(fData || []);
            } else {
                renderRequestCards(data || []);
            }
        } catch (err) {
            statusElement.innerHTML = `<span style="color:#d62828;">❌ <strong>Database Error:</strong> ${err.message}</span><br>
                <small style="color:#666;">Hint: Make sure the 'donor_requests' table exists and RLS policies allow public access.</small>`;
            console.error('donor_requests load failed:', err);
        }
    }

    function renderRequestCards(requests) {
        requestsContainer.innerHTML = '';

        if (!Array.isArray(requests) || requests.length === 0) {
            statusElement.textContent = 'You have no donor requests yet. New requests will appear here as they arrive.';
            return;
        }

        statusElement.textContent = `Showing ${requests.length} request${requests.length === 1 ? '' : 's'} for your profiles.`;

        requests.forEach(row => {
            const req = row.requests || {};
            const card = document.createElement('div');
            card.className = 'patient-card'; 
            card.style.cssText = 'background:#fff; border-radius:18px; padding:24px; box-shadow:0 10px 28px rgba(15,23,42,0.08); border:1px solid rgba(0,0,0,0.05); margin-bottom:20px;';

            // Status Badge
            const statusLabel = row.status === 'pending'
                ? '<span style="color:#fb8500; font-weight:700;">Pending</span>'
                : row.status === 'accepted'
                    ? '<span style="color:#2a9d8f; font-weight:700;">Accepted</span>'
                    : '<span style="color:#d62828; font-weight:700;">Declined</span>';

            // Urgency Badge
            const urg = (req.urgency || 'normal').toLowerCase();
            const urgLabel = urg.charAt(0).toUpperCase() + urg.slice(1);
            const urgColor = urg === 'emergency' ? '#d62828' : urg === 'priority' ? '#fb8500' : '#0077b6';
            const urgBg = urg === 'emergency' ? '#ffeef0' : urg === 'priority' ? '#fff3e0' : '#e3f2fd';

            card.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:18px;">
                    <div>
                        <div style="font-size:32px; font-weight:800; color:#d62828;">${req.blood_group || '??'} <span style="font-size:16px; color:#888; font-weight:400;">Needed</span></div>
                        <div style="font-size:14px; color:#4a4a4a; margin-top:2px;">📍 ${req.city || 'Nearby'}</div>
                    </div>
                    <div style="background:${urgBg}; color:${urgColor}; padding:5px 12px; border-radius:20px; font-size:12px; font-weight:700; text-transform:uppercase;">
                        ${urgLabel}
                    </div>
                </div>

                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:15px; padding:15px 0; border-top:1px solid #eee; border-bottom:1px solid #eee; margin-bottom:18px;">
                    <div>
                        <label style="display:block; font-size:10px; color:#888; text-transform:uppercase; font-weight:700; margin-bottom:2px;">Patient Name</label>
                        <span style="font-size:14px; font-weight:600; color:#1d3557;">${req.patient_name || 'Protected'}</span>
                    </div>
                    <div>
                        <label style="display:block; font-size:10px; color:#888; text-transform:uppercase; font-weight:700; margin-bottom:2px;">Status</label>
                        <span style="font-size:14px;">${statusLabel}</span>
                    </div>
                    ${req.notes ? `<div style="grid-column: 1 / -1;">
                        <label style="display:block; font-size:10px; color:#888; text-transform:uppercase; font-weight:700; margin-bottom:2px;">Notes</label>
                        <span style="font-size:13px; color:#555;">${req.notes}</span>
                    </div>` : ''}
                </div>

                <div style="display:flex; gap:12px; flex-wrap:wrap;">
                    <button class="action-button accept-button" data-donor-request-id="${row.id}" data-request-id="${row.request_id || req.id || ''}" style="flex:1; background:#2a9d8f; color:#fff; border:none; padding:12px; border-radius:10px; font-weight:700; cursor:pointer; transition:all 0.2s;">Accept</button>
                    <button class="action-button decline-button" data-donor-request-id="${row.id}" data-request-id="${row.request_id || req.id || ''}" style="flex:1; background:#fff; color:#1d3557; border:1px solid #d1d5db; padding:12px; border-radius:10px; font-weight:600; cursor:pointer; transition:all 0.2s;">Decline</button>
                    <button onclick="window.location.href='respond.html?request_id=${req.id || ''}'" style="width:100%; margin-top:8px; background:none; border:none; color:#0077b6; font-size:12px; font-weight:600; cursor:pointer;">View Full Details →</button>
                </div>
            `;

            if (row.status !== 'pending') {
                card.querySelectorAll('.action-button').forEach(btn => btn.disabled = true);
                card.querySelectorAll('.action-button').forEach(btn => btn.style.opacity = '0.6');
                card.querySelectorAll('.action-button').forEach(btn => btn.style.cursor = 'not-allowed');
            }

            requestsContainer.appendChild(card);
        });

        requestsContainer.querySelectorAll('.action-button').forEach(button => {
            button.addEventListener('click', async event => {
                const donorRequestId = event.currentTarget.dataset.donorRequestId;
                const requestId = event.currentTarget.dataset.requestId;
                const isAccept = event.currentTarget.classList.contains('accept-button');
                if (!donorRequestId || !requestId) return;
                await respondToRequest(donorRequestId, requestId, isAccept);
            });
        });
    }

    async function respondToRequest(donorRequestId, requestId, accept) {
        if (!window.db) return;

        const statusUpdate = accept ? 'accepted' : 'declined';
        try {
            const { error: donorError } = await window.db
                .from('donor_requests')
                .update({ status: statusUpdate })
                .eq('id', donorRequestId)
                .eq('status', 'pending');
            if (donorError) throw donorError;

            if (accept) {
                const { error: requestError } = await window.db
                    .from('requests')
                    .update({ status: 'accepted' })
                    .eq('id', requestId);
                if (requestError) throw requestError;
            }

            if (window.notify) {
                window.notify(accept ? '✅ Request accepted.' : '❌ Request declined.');
            }

            await loadRequestList();
        } catch (err) {
            console.warn('Request response failed:', err.message);
            statusElement.textContent = 'Could not update request status. Please try again.';
        }
    }
});
