// notifications.js — Bell + Toast notification system with clickable links
document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize State
    let notifications = JSON.parse(localStorage.getItem('hemo_notifications')) || [];
    
    // 2. Inject UI into Navbar
    const navbar = document.querySelector('.navbar');
    const logoutBtn = document.querySelector('.logout-btn');
    
    if (navbar && logoutBtn) {
        // Create Nav Actions wrapper if it doesn't exist
        const navActions = document.createElement('div');
        navActions.className = 'nav-actions';
        
        // Create Notification Container
        const notifContainer = document.createElement('div');
        notifContainer.className = 'notification-container';
        
        // Bell Icon
        const bellIcon = document.createElement('span');
        bellIcon.className = 'notification-icon';
        bellIcon.innerHTML = '🔔';
        
        // Badge
        const badge = document.createElement('span');
        badge.className = 'notification-badge';
        badge.id = 'notificationBadge';
        
        // Dropdown
        const dropdown = document.createElement('div');
        dropdown.className = 'notification-dropdown';
        dropdown.id = 'notificationDropdown';
        
        const dropdownHeader = document.createElement('div');
        dropdownHeader.className = 'dropdown-header';
        dropdownHeader.innerHTML = `
            <span>Notifications</span>
            <span class="clear-all" id="clearNotifications">Clear All</span>
        `;
        
        const dropdownList = document.createElement('div');
        dropdownList.id = 'notificationList';
        dropdownList.className = 'notification-list';
        
        dropdown.appendChild(dropdownHeader);
        dropdown.appendChild(dropdownList);
        
        notifContainer.appendChild(bellIcon);
        notifContainer.appendChild(badge);
        notifContainer.appendChild(dropdown);
        
        navActions.appendChild(notifContainer);
        
        // Move logout btn into navActions
        logoutBtn.parentNode.insertBefore(navActions, logoutBtn);
        navActions.appendChild(logoutBtn);
        
        // 3. Inject Toast Container
        const toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        document.body.appendChild(toastContainer);
        
        // 4. Logic & Event Listeners
        
        // Toggle Dropdown
        bellIcon.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('show');
            // Mark all as read when opened
            if (dropdown.classList.contains('show')) {
                notifications.forEach(n => n.read = true);
                saveNotifications();
                updateUI();
            }
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!notifContainer.contains(e.target)) {
                dropdown.classList.remove('show');
            }
        });
        
        // Clear all
        document.getElementById('clearNotifications').addEventListener('click', (e) => {
            e.stopPropagation();
            notifications = [];
            saveNotifications();
            updateUI();
        });
        
        // Render initial UI
        updateUI();
    }
    
    // Core Functions
    function saveNotifications() {
        localStorage.setItem('hemo_notifications', JSON.stringify(notifications));
    }
    
    function updateUI() {
        const badge = document.getElementById('notificationBadge');
        const list = document.getElementById('notificationList');
        
        if (!badge || !list) return;
        
        const unreadCount = notifications.filter(n => !n.read).length;
        
        if (unreadCount > 0) {
            badge.textContent = unreadCount;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
        
        if (notifications.length === 0) {
            list.innerHTML = '<div class="empty-state">No new notifications</div>';
        } else {
            list.innerHTML = '';
            // Show newest first
            [...notifications].reverse().forEach(n => {
                const item = document.createElement('div');
                item.className = `notification-item ${n.read ? 'read' : 'unread'}`;

                // Determine icon based on notification type
                const icon = n.type === 'request'  ? '🚨'
                           : n.type === 'accepted'  ? '✅'
                           : n.type === 'declined'  ? '❌'
                           : '🔔';

                // Make clickable if a url is provided
                if (n.url) {
                    item.style.cursor = 'pointer';
                    item.addEventListener('click', (e) => {
                        e.stopPropagation();
                        window.location.href = n.url;
                    });
                }

                item.innerHTML = `
                    <div style="display:flex; align-items:flex-start; gap:10px;">
                        <span style="font-size:18px; flex-shrink:0; margin-top:2px;">${icon}</span>
                        <div style="flex:1; min-width:0;">
                            <p class="notif-text">${n.message}</p>
                            <small class="notif-time">${new Date(n.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</small>
                            ${n.url ? '<span style="float:right; font-size:11px; color:#2a9d8f; font-weight:600;">View →</span>' : ''}
                        </div>
                    </div>
                `;
                list.appendChild(item);
            });
        }
    }
    
    function showToast(message, options) {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const url  = options && options.url  ? options.url  : null;
        const type = options && options.type ? options.type : null;

        // Determine toast accent colour
        const accentColor = type === 'request'  ? '#d62828'
                          : type === 'accepted'  ? '#2a9d8f'
                          : type === 'declined'  ? '#e76f51'
                          : '#0077b6';

        const toast = document.createElement('div');
        toast.className = 'toast';
        if (url) toast.style.cursor = 'pointer';

        toast.innerHTML = `
            <div class="toast-content">
                <span class="toast-icon">${type === 'request' ? '🚨' : type === 'accepted' ? '✅' : type === 'declined' ? '❌' : '🔔'}</span>
                <p>${message}</p>
            </div>
            <span class="toast-close">&times;</span>
        `;

        container.appendChild(toast);

        // Animate in
        setTimeout(() => toast.classList.add('show'), 10);

        // Navigate on click (if url provided)
        if (url) {
            toast.addEventListener('click', (e) => {
                if (e.target.classList.contains('toast-close')) return; // let close handler work
                window.location.href = url;
            });
        }

        // Close button
        toast.querySelector('.toast-close').addEventListener('click', (e) => {
            e.stopPropagation();
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        });
        
        // Auto remove after 6s (longer for requests)
        const autoRemoveMs = type === 'request' ? 8000 : 5000;
        setTimeout(() => {
            if (toast.parentElement) {
                toast.classList.remove('show');
                setTimeout(() => toast.remove(), 300);
            }
        }, autoRemoveMs);
    }
    
    /**
     * Global notification function.
     * @param {string} message  — Notification text
     * @param {object} [options] — Optional: { url: string, type: 'request'|'accepted'|'declined' }
     *
     * Usage:
     *   notify('Simple message');
     *   notify('🚨 Blood needed!', { url: 'respond.html?request_id=123', type: 'request' });
     */
    window.notify = function(message, options) {
        const url  = options && options.url  ? options.url  : null;
        const type = options && options.type ? options.type : null;

        notifications.push({
            id: Date.now(),
            message: message,
            read: false,
            timestamp: new Date().toISOString(),
            url: url,
            type: type
        });
        saveNotifications();
        updateUI();
        showToast(message, options);
    };
});
