document.addEventListener('DOMContentLoaded', () => {
    const selects = document.querySelectorAll('select[name="interactionType"]');
    const mutualSupportField = document.getElementById('mutualSupportField');
    const emergencyAlert = document.getElementById('emergencyAlert');

    if(selects.length > 0) {
        selects.forEach(select => {
            // Set initial state based on default selected value
            handleInteractionChange(select.value);

            select.addEventListener('change', (e) => {
                handleInteractionChange(e.target.value);
            });
        });
    }

    function handleInteractionChange(val) {
        if (!mutualSupportField || !emergencyAlert) return;
        
        if (val === 'mutual') {
            mutualSupportField.style.display = 'block';
            emergencyAlert.style.display = 'none';
        } else if (val === 'emergency') {
            mutualSupportField.style.display = 'none';
            emergencyAlert.style.display = 'block';
        } else {
            mutualSupportField.style.display = 'none';
            emergencyAlert.style.display = 'none';
        }
    }
});
