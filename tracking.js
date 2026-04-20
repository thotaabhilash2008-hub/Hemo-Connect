// tracking.js — Gates on real donor approval via Supabase real-time

document.addEventListener('DOMContentLoaded', () => {
    const cancelRequestBtn = document.getElementById('cancelRequestBtn');
    const doneBtn          = document.getElementById('doneBtn');
    const recipientNameEl  = document.getElementById('recipientName');
    const backLink         = document.getElementById('backLink');
    const declinedBanner   = document.getElementById('declinedBanner');

    const entity          = localStorage.getItem('tracking_entity')      || 'the selected contact';
    const entityType      = localStorage.getItem('tracking_entity_type') || 'donor';
    const requestId       = localStorage.getItem('request_id')           || null;
    const donorRequestId  = localStorage.getItem('donor_request_id')     || null;
    const etaMins         = Math.floor(Math.random() * 11) + 5;

    let acceptedAlready = false;
    let sequenceTimeoutIds = [];

    recipientNameEl.textContent = entity;
    if (entityType === 'hospital') {
        backLink.href        = 'hospital_results.html';
        backLink.textContent = '← Back to Hospital Results';
    } else {
        backLink.href        = 'donor_results.html';
        backLink.textContent = '← Back to Donor Results';
    }

    // ── Cancel button ────────────────────────────────────────────────
    if (cancelRequestBtn) {
        cancelRequestBtn.addEventListener('click', async () => {
            sequenceTimeoutIds.forEach(id => clearTimeout(id));
            sequenceTimeoutIds = [];

            if (window.db && donorRequestId) {
                try {
                    await window.db
                        .from('donor_requests')
                        .update({ status: 'cancelled' })
                        .eq('id', donorRequestId);
                    console.log('✅ donor_request cancelled');
                } catch (err) { console.warn('Cancel failed:', err.message); }
            }
            if (window.db && requestId) {
                try {
                    await window.db
                        .from('requests')
                        .update({ status: 'cancelled' })
                        .eq('id', requestId);
                } catch (err) { console.warn('Request cancel failed:', err.message); }
            }
            if (window.notify) window.notify('Blood request cancelled.');
            setTimeout(() => window.history.back(), 900);
        });
    }

    // ── Auto-advance Steps 1 → 2 → 3 only ───────────────────────────
    // Step 4 (Accepted) and Step 5 (On the way) are ONLY triggered by real-time
    function startTrackingSequence() {
        setStep(1);
        sequenceTimeoutIds.push(setTimeout(() => setStep(2), 1500));
        sequenceTimeoutIds.push(setTimeout(() => setStep(3), 3200));
        // Step 3 stays "active" (Waiting for approval) until donor responds
    }

    startTrackingSequence();

    // ── Real-time listener: donor_requests table ─────────────────────
    if (window.db && donorRequestId) {
        const drChannel = window.db
            .channel(`donor-request-${donorRequestId}`)
            .on(
                'postgres_changes',
                {
                    event:  'UPDATE',
                    schema: 'public',
                    table:  'donor_requests',
                    filter: `id=eq.${donorRequestId}`
                },
                payload => {
                    console.log('📡 donor_request update:', payload.new.status);
                    handleDonorResponse(payload.new.status);
                }
            )
            .subscribe();

        window.addEventListener('beforeunload', () => window.db.removeChannel(drChannel));
    }

    // ── Real-time listener: requests table (legacy fallback) ─────────
    if (window.db && requestId) {
        const reqChannel = window.db
            .channel(`request-status-${requestId}`)
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'requests', filter: `id=eq.${requestId}` },
                payload => handleDonorResponse(payload.new.status)
            )
            .subscribe();

        window.addEventListener('beforeunload', () => window.db.removeChannel(reqChannel));
    }

    // ── Also poll on load in case donor already responded ───────────
    if (window.db && donorRequestId) {
        setTimeout(async () => {
            try {
                const { data, error } = await window.db
                    .from('donor_requests')
                    .select('status')
                    .eq('id', donorRequestId)
                    .single();
                if (!error && data) handleDonorResponse(data.status);
            } catch (err) { console.warn('Status poll failed:', err.message); }
        }, 4000);
    }

    // ── Handle donor's response ──────────────────────────────────────
    function handleDonorResponse(status) {
        if (!status || acceptedAlready) return;

        if (status === 'accepted' || status === 'on_the_way') {
            acceptedAlready = true;
            // Clear the "Waiting" step, advance to Accepted
            sequenceTimeoutIds.forEach(id => clearTimeout(id)); // stop any pending auto-steps
            showAcceptedStep();
        }

        if (status === 'on_the_way') {
            setTimeout(() => showOnTheWayStep(), 1400);
        }

        if (status === 'declined') {
            showDeclinedState();
        }

        if (status === 'cancelled') {
            if (window.notify) window.notify('The request was cancelled.');
            cancelRequestBtn && (cancelRequestBtn.style.display = 'none');
        }
    }

    // ── Accepted ────────────────────────────────────────────────────
    function showAcceptedStep() {
        const msg = document.getElementById('msg-accepted');
        if (msg) {
            msg.textContent = `${entity} has accepted your request!`;
            msg.classList.add('blink-highlight');
        }
        setStep(4);
        cancelRequestBtn && (cancelRequestBtn.style.display = 'none');
        doneBtn && (doneBtn.style.display = 'inline-block');
        if (window.notify) window.notify(`✅ ${entity} accepted your blood request!`);

        setTimeout(() => showOnTheWayStep(), 2000);
    }

    // ── On the way ──────────────────────────────────────────────────
    function showOnTheWayStep() {
        const msg = document.getElementById('msg-eta');
        if (msg) {
            msg.textContent = `Arriving in approximately ${etaMins} minutes.`;
            msg.classList.add('blink-highlight');
        }
        setStep(5);
        if (window.notify) window.notify(`🚗 ${entity} is on the way! ETA: ~${etaMins} mins.`);
    }

    // ── Declined ────────────────────────────────────────────────────
    function showDeclinedState() {
        // Mark step 3 as declined
        const step3 = document.getElementById('step-3');
        if (step3) {
            step3.classList.remove('active', 'pending');
            step3.classList.add('declined');
            const icon = step3.querySelector('.step-icon');
            const msg  = step3.querySelector('.step-msg');
            if (icon) icon.textContent = '❌';
            if (msg)  msg.textContent  = `${entity} declined your request.`;
        }

        if (declinedBanner) declinedBanner.style.display = 'block';
        cancelRequestBtn && (cancelRequestBtn.style.display = 'none');
        doneBtn && (doneBtn.style.display = 'inline-block');
        if (window.notify) window.notify(`❌ ${entity} declined the request. Please try another donor.`);
    }

    // ── Step helper ──────────────────────────────────────────────────
    function setStep(n) {
        for (let i = 1; i < n; i++) {
            const step = document.getElementById(`step-${i}`);
            if (step) { step.classList.remove('active', 'pending'); step.classList.add('completed'); }
        }
        const current = document.getElementById(`step-${n}`);
        if (current) { current.classList.remove('pending'); current.classList.add('active'); }
    }
});
