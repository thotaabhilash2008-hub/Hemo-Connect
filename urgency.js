document.addEventListener('DOMContentLoaded', () => {
    const urgencyRadios = document.querySelectorAll('input[name="urgencyLevel"]');
    const urgencyAlert = document.getElementById('urgencyAlert');
    const customTimeInput = document.getElementById('customTime');

    if(urgencyRadios.length > 0) {
        // Initial state
        urgencyAlert.style.display = 'block';
        urgencyAlert.style.backgroundColor = '#e3f2fd';
        urgencyAlert.style.color = '#0077b6';
        urgencyAlert.style.borderLeft = '4px solid #0077b6';
        urgencyAlert.innerHTML = '🕒 Standard processing.';
        
        if (customTimeInput) {
            customTimeInput.min = "1";
            customTimeInput.max = "24";
            customTimeInput.placeholder = "Hours (max 24)";
            
            customTimeInput.addEventListener('change', (e) => {
                const val = parseInt(e.target.value);
                const min = parseInt(e.target.min);
                const max = parseInt(e.target.max);
                
                if (e.target.value !== '' && !isNaN(val)) {
                    if (val < min || val > max) {
                        e.target.value = '';
                        alert(`Please enter a valid time between ${min} and ${max} hours for the selected urgency level.`);
                    }
                }
            });
        }

        urgencyRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                urgencyAlert.style.display = 'block';
                if (customTimeInput) customTimeInput.value = ''; // Clear out invalid values when switching modes
                
                if (e.target.value === 'normal') {
                    urgencyAlert.style.backgroundColor = '#e3f2fd';
                    urgencyAlert.style.color = '#0077b6';
                    urgencyAlert.style.borderLeft = '4px solid #0077b6';
                    urgencyAlert.innerHTML = '🕒 Standard processing.';
                    if (customTimeInput) {
                        customTimeInput.min = "1";
                        customTimeInput.max = "24";
                        customTimeInput.placeholder = "Hours (max 24)";
                    }
                } else if (e.target.value === 'priority') {
                    urgencyAlert.style.backgroundColor = '#fff0d4';
                    urgencyAlert.style.color = '#fb8500';
                    urgencyAlert.style.borderLeft = '4px solid #fb8500';
                    urgencyAlert.innerHTML = '⚡ Priority alerts activated.';
                    if (customTimeInput) {
                        customTimeInput.min = "6";
                        customTimeInput.max = "12";
                        customTimeInput.placeholder = "Hours (6-12)";
                    }
                } else if (e.target.value === 'emergency') {
                    urgencyAlert.style.backgroundColor = '#ffeef0';
                    urgencyAlert.style.color = '#d62828';
                    urgencyAlert.style.borderLeft = '4px solid #d62828';
                    urgencyAlert.innerHTML = '🚨 Critical request! Notifying all nearby donors immediately.';
                    if (customTimeInput) {
                        customTimeInput.min = "1";
                        customTimeInput.max = "2";
                        customTimeInput.placeholder = "Hours (max 2)";
                    }
                }
            });
        });
    }
});
