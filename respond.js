// respond.js — Premium donor response logic for patient info & status updates
document.addEventListener('DOMContentLoaded', async () => {
    // 1. UI Elements
    const loadingState = document.getElementById('loadingState');
    const errorState   = document.getElementById('errorState');
    const patientCard  = document.getElementById('patientCard');
    const actionArea   = document.getElementById('actionArea');
    const resultArea   = document.getElementById('resultArea');

    const displayBloodGroup  = document.getElementById('displayBloodGroup');
    const displayCity        = document.getElementById('displayCity');
    const displayPatientName = document.getElementById('displayPatientName');
    const displayTime        = document.getElementById('displayTime');
    const displayUrgency     = document.getElementById('displayUrgency');
    const displayNotes       = document.getElementById('displayNotes');
    const notesContainer     = document.getElementById('notesContainer');

    const acceptBtn = document.getElementById('acceptBtn');
    const rejectBtn = document.getElementById('rejectBtn');

    // 2. State & Params
    const params = new URLSearchParams(window.location.search);
    const requestId = params.get('request_id');
    const donorRequestId = params.get('donor_request_id');
    
    let currentDonorRequestId = donorRequestId;
    let requestData = null;

    // 3. Init
    if (!requestId) {
        showError('Missing Request ID', 'We couldn\'t find the request details. Please check the link in your notification.');
        return;
    }

    await loadRequestDetails();

    // 4. Data Fetching
    async function loadRequestDetails() {
        if (!window.db) return;

        try {
            // Fetch request details
            const { data: req, error: reqErr } = await window.db
                .from('requests')
                .select('*')
                .eq('id', requestId)
                .single();

            if (reqErr || !req) {
                showError('Request Expired', 'This blood request is no longer active or has been cancelled.');
                return;
            }

            requestData = req;

            // If we don't have donor_request_id, try to find it for the current logged-in donor
            if (!currentDonorRequestId) {
                const storedDonorId = localStorage.getItem('donor_id');
                if (storedDonorId) {
                    const { data: dr, error: drErr } = await window.db
                        .from('donor_requests')
                        .select('id, status')
                        .eq('request_id', requestId)
                        .eq('donor_id', storedDonorId)
                        .limit(1)
                        .single();
                    
                    if (!drErr && dr) {
                        currentDonorRequestId = dr.id;
                        if (dr.status !== 'pending') {
                            showAlreadyResponded(dr.status);
                            return;
                        }
                    }
                }
            } else {
                // Verify the specific donor_request status
                const { data: dr, error: drErr } = await window.db
                    .from('donor_requests')
                    .select('status')
                    .eq('id', currentDonorRequestId)
                    .single();
                
                if (!drErr && dr && dr.status !== 'pending') {
                    showAlreadyResponded(dr.status);
                    return;
                }
            }

            renderPatientInfo(req);
        } catch (err) {
            console.error('Fetch error:', err.message);
            showError('Connection Error', 'Failed to load details. Please check your internet connection.');
        }
    }

    // 5. Rendering
    function renderPatientInfo(req) {
        loadingState.style.display = 'none';
        patientCard.style.display = 'block';

        displayBloodGroup.textContent = req.blood_group || 'Any';
        displayCity.textContent = req.city || 'Unknown';
        displayPatientName.textContent = req.patient_name || 'Patient Info Protected';
        
        const timeStr = new Date(req.created_at).toLocaleString([], { 
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
        });
        displayTime.textContent = timeStr;

        // Urgency styling
        const urg = (req.urgency || 'normal').toLowerCase();
        displayUrgency.textContent = urg.charAt(0).toUpperCase() + urg.slice(1);
        displayUrgency.className = `urgency-badge urgency-${urg}`;

        if (req.notes) {
            notesContainer.style.display = 'block';
            displayNotes.textContent = req.notes;
        }
    }

    function showError(title, msg) {
        loadingState.style.display = 'none';
        errorState.style.display = 'block';
        document.getElementById('errorTitle').textContent = title;
        document.getElementById('errorMsg').textContent = msg;
    }

    function showAlreadyResponded(status) {
        loadingState.style.display = 'none';
        patientCard.style.display = 'block';
        actionArea.style.display = 'none';
        resultArea.style.display = 'block';

        if (status === 'accepted') {
            document.getElementById('resultTitle').innerHTML = '✅ Already Accepted';
            document.getElementById('resultMsg').textContent = 'You have already accepted this request. Please proceed to coordinate.';
        } else {
            document.getElementById('resultTitle').innerHTML = '❌ Already Declined';
            document.getElementById('resultMsg').textContent = 'You chose not to accept this request.';
        }
    }

    // 6. Action Handlers
    acceptBtn.addEventListener('click', () => handleResponse(true));
    rejectBtn.addEventListener('click', () => handleResponse(false));

    async function handleResponse(isAccept) {
        if (!window.db || !requestData) return;

        acceptBtn.disabled = true;
        rejectBtn.disabled = true;
        acceptBtn.textContent = isAccept ? '⏳ Processing...' : 'Accept Request';
        rejectBtn.textContent = !isAccept ? '⏳ Processing...' : 'Decline';

        const statusUpdate = isAccept ? 'accepted' : 'declined';

        try {
            // Step 1: Update donor_requests row if we have it
            if (currentDonorRequestId) {
                await window.db
                    .from('donor_requests')
                    .update({ status: statusUpdate })
                    .eq('id', currentDonorRequestId);
            } else {
                // Fallback: update all pending for this donor/request combo if ID is missing but donor is logged in
                const donorId = localStorage.getItem('donor_id');
                if (donorId) {
                    await window.db
                        .from('donor_requests')
                        .update({ status: statusUpdate })
                        .eq('request_id', requestId)
                        .eq('donor_id', donorId);
                }
            }

            // Step 2: If accepted, update the parent request status
            if (isAccept) {
                await window.db
                    .from('requests')
                    .update({ status: 'accepted' })
                    .eq('id', requestId);
            }

            // Step 3: Show success
            actionArea.style.display = 'none';
            resultArea.style.display = 'block';

            if (isAccept) {
                document.getElementById('resultTitle').innerHTML = '✅ Request Accepted!';
                document.getElementById('resultMsg').textContent = 'The patient has been notified. They are waiting for your arrival.';
                if (window.notify) window.notify('✅ You accepted the blood request!', { type: 'accepted' });
            } else {
                document.getElementById('resultTitle').innerHTML = '❌ Request Declined';
                document.getElementById('resultMsg').textContent = 'Thank you for your response. We will look for other donors.';
                if (window.notify) window.notify('❌ You declined the request.', { type: 'declined' });
            }

        } catch (err) {
            console.error('Update error:', err.message);
            alert('Something went wrong. Please try again.');
            acceptBtn.disabled = false;
            rejectBtn.disabled = false;
            acceptBtn.textContent = '✅ Accept Request';
            rejectBtn.textContent = '❌ Decline';
        }
    }
});
