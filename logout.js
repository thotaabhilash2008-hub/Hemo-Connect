// index.html - Landing page with actual Supabase logout

document.addEventListener('DOMContentLoaded', () => {
    // If we have Supabase, let's sign out whenever index.html loads 
    // (since it's acting as the 'Logout' destination right now)
    if (window.db) {
        window.db.auth.signOut().then(() => {
            console.log('Logged out of Supabase.');
            sessionStorage.removeItem('isGuest');
            sessionStorage.removeItem('user_email');
            sessionStorage.removeItem('user_name');
        }).catch(err => {
            console.warn('Logout error:', err.message);
        });
    }
});
