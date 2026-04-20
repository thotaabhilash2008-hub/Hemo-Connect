// script.js — Supabase Auth: Sign Up, Sign In, Forgot Password, Guest

document.addEventListener('DOMContentLoaded', () => {
    const loginBox   = document.querySelector('.login');
    const signupBox  = document.querySelector('.signup');
    const forgotBox  = document.querySelector('.forgot');
    const container  = document.querySelector('.container');

    // ── Form toggle helpers ──────────────────────────────────────
    function setActiveForm(formToShow) {
        [loginBox, signupBox, forgotBox].forEach(f => f.classList.remove('active'));
        setTimeout(() => {
            formToShow.classList.add('active');
            if (formToShow === signupBox)     container.style.height = '780px';
            else if (formToShow === forgotBox) container.style.height = '480px';
            else                               container.style.height = '680px';
        }, 100);
    }

    document.querySelectorAll('.toggle-signup').forEach(l =>
        l.addEventListener('click', e => { e.preventDefault(); setActiveForm(signupBox); }));
    document.querySelectorAll('.toggle-login').forEach(l =>
        l.addEventListener('click', e => { e.preventDefault(); setActiveForm(loginBox); }));
    document.querySelectorAll('.toggle-forgot').forEach(l =>
        l.addEventListener('click', e => { e.preventDefault(); setActiveForm(forgotBox); }));

    // ── Guest Access ─────────────────────────────────────────────
    document.querySelectorAll('.guest-btn').forEach(btn =>
        btn.addEventListener('click', e => {
            e.preventDefault();
            sessionStorage.setItem('isGuest', 'true');
            window.location.href = 'dashboard.html';
        })
    );

    // ── Helper: show/hide errors & loading ───────────────────────
    function setError(elId, msg) {
        const el = document.getElementById(elId);
        if (!el) return;
        el.textContent = msg;
        el.style.display = msg ? 'block' : 'none';
    }

    function setLoading(btnId, loading, defaultText) {
        const btn = document.getElementById(btnId);
        if (!btn) return;
        btn.disabled = loading;
        btn.textContent = loading ? '⏳ Please wait...' : defaultText;
    }

    const savePasswordPopup = document.getElementById('savePasswordPopup');
    const savePwdYes = document.getElementById('savePwdYes');
    const savePwdNo = document.getElementById('savePwdNo');
    const savePwdNever = document.getElementById('savePwdNever');
    let pendingSaveCredentials = null;
    let pendingRedirect = null;
    let redirectTimer = null;

    function showSavePasswordPopup(email, password, name, redirectUrl = null) {
        if (!savePasswordPopup || !savePwdYes || !savePwdNo) return;
        
        // Don't show if user said "Never"
        if (localStorage.getItem('password_save_never') === 'true') {
            if (redirectUrl) window.location.href = redirectUrl;
            return;
        }

        pendingSaveCredentials = { email, password, name };
        pendingRedirect = redirectUrl;
        savePasswordPopup.style.display = 'block';
        if (redirectTimer) clearTimeout(redirectTimer);
        if (redirectUrl) {
            redirectTimer = setTimeout(() => {
                hideSavePasswordPopup();
                window.location.href = redirectUrl;
            }, 6000);
        }
    }

    function hideSavePasswordPopup() {
        if (!savePasswordPopup) return;
        savePasswordPopup.style.display = 'none';
        pendingSaveCredentials = null;
        if (redirectTimer) {
            clearTimeout(redirectTimer);
            redirectTimer = null;
        }
        pendingRedirect = null;
    }

    async function saveCredentials(email, password, name) {
        if (!email || !password) return false;

        if (navigator.credentials) {
            try {
                let cred = null;
                if (window.PasswordCredential) {
                    cred = new window.PasswordCredential({
                        id: email,
                        password,
                        name: name || email
                    });
                } else if (navigator.credentials.create) {
                    cred = await navigator.credentials.create({
                        password: {
                            id: email,
                            password,
                            name: name || email
                        }
                    });
                }

                if (cred) {
                    await navigator.credentials.store(cred);
                    console.log('✅ Saved credentials via Chrome password manager');
                    return true;
                }
            } catch (err) {
                console.warn('Credential manager store failed:', err);
            }
        }

        console.warn('⚠️ Browser credential manager not available. Chrome password save may not trigger automatically.');
        return false;
    }

    if (savePwdYes) {
        savePwdYes.addEventListener('click', async () => {
            if (pendingSaveCredentials) {
                await saveCredentials(pendingSaveCredentials.email, pendingSaveCredentials.password, pendingSaveCredentials.name);
            }
            const redirectUrl = pendingRedirect;
            hideSavePasswordPopup();
            if (redirectUrl) window.location.href = redirectUrl;
        });
    }
    if (savePwdNo) {
        savePwdNo.addEventListener('click', () => {
            const redirectUrl = pendingRedirect;
            hideSavePasswordPopup();
            if (redirectUrl) window.location.href = redirectUrl;
        });
    }
    if (savePwdNever) {
        savePwdNever.addEventListener('click', () => {
            localStorage.setItem('password_save_never', 'true');
            const redirectUrl = pendingRedirect;
            hideSavePasswordPopup();
            if (redirectUrl) window.location.href = redirectUrl;
        });
    }

    // ── SIGN UP ──────────────────────────────────────────────────
    const signupFormEl = document.getElementById('signupFormEl');
    if (signupFormEl) {
        signupFormEl.addEventListener('submit', async e => {
            e.preventDefault();
            setError('signupError', '');
            setError('signupSuccess', '');
            setLoading('signupBtn', true, 'Sign Up');

            const name     = document.getElementById('signupName').value.trim();
            const email    = document.getElementById('signupEmail').value.trim();
            const password = document.getElementById('signupPassword').value;

            if (!window.db) {
                setError('signupError', 'Database not connected. Please refresh.');
                setLoading('signupBtn', false, 'Sign Up');
                return;
            }

            try {
                const { data, error } = await window.db.auth.signUp({
                    email,
                    password,
                    options: { data: { full_name: name } }
                });

                if (error) throw error;

                // Also insert into user_profiles (fallback if trigger isn't set)
                if (data.user) {
                    try {
                        await window.db.from('user_profiles').upsert([{
                            id:        data.user.id,
                            email:     email,
                            full_name: name
                        }]);
                    } catch (profileErr) {
                        // Non-critical — trigger handles this normally
                        console.warn('Profile insert skipped:', profileErr.message);
                    }
                }

                // Show success message (user may need to confirm email)
                setError('signupSuccess',
                    data.user && data.user.identities && data.user.identities.length === 0
                        ? '⚠️ This email is already registered. Please sign in.'
                        : '✅ Account created! Please check your email to confirm, then sign in.'
                );
                setLoading('signupBtn', false, 'Sign Up');

                if (email && password) {
                    showSavePasswordPopup(email, password, name);
                }

            } catch (err) {
                setError('signupError', err.message || 'Sign up failed. Try again.');
                setLoading('signupBtn', false, 'Sign Up');
            }
        });
    }

    // ── SIGN IN ──────────────────────────────────────────────────
    const loginFormEl = document.getElementById('loginFormEl');
    if (loginFormEl) {
        loginFormEl.addEventListener('submit', async e => {
            e.preventDefault();
            setError('loginError', '');
            setLoading('loginBtn', true, 'Sign In');

            const email    = document.getElementById('loginEmail').value.trim();
            const password = document.getElementById('loginPassword').value;

            if (!window.db) {
                setError('loginError', 'Database not connected. Please refresh.');
                setLoading('loginBtn', false, 'Sign In');
                return;
            }

            try {
                const { data, error } = await window.db.auth.signInWithPassword({ email, password });

                if (error) throw error;

                // Persist session
                sessionStorage.setItem('isGuest', 'false');
                sessionStorage.setItem('user_email', data.user.email);
                sessionStorage.setItem('user_name', data.user.user_metadata?.full_name || email);

                showSavePasswordPopup(email, password, data.user.user_metadata?.full_name || email, 'dashboard.html');

            } catch (err) {
                setLoading('loginBtn', false, 'Sign In');
                if (err.message.includes('Email not confirmed')) {
                    setError('loginError', '⚠️ Please confirm your email first, then sign in.');
                } else if (err.message.includes('Invalid login credentials')) {
                    setError('loginError', '❌ Incorrect email or password.');
                } else {
                    setError('loginError', err.message || 'Sign in failed.');
                }
            }
        });
    }

    // ── FORGOT PASSWORD ───────────────────────────────────────────
    const forgotFormEl = document.getElementById('forgotFormEl');
    if (forgotFormEl) {
        forgotFormEl.addEventListener('submit', async e => {
            e.preventDefault();
            setError('forgotMsg', '');
            setLoading('forgotBtn', true, 'Send Reset Link');

            const email = document.getElementById('forgotEmail').value.trim();

            if (!window.db) {
                setLoading('forgotBtn', false, 'Send Reset Link');
                return;
            }

            try {
                const { error } = await window.db.auth.resetPasswordForEmail(email, {
                    redirectTo: window.location.origin + '/auth.html'
                });

                if (error) throw error;

                const msgEl = document.getElementById('forgotMsg');
                msgEl.textContent = '✅ Reset link sent! Check your inbox.';
                msgEl.style.color = '#2a9d8f';
                msgEl.style.display = 'block';

            } catch (err) {
                const msgEl = document.getElementById('forgotMsg');
                msgEl.textContent = err.message || 'Failed to send reset link.';
                msgEl.style.color = '#e63946';
                msgEl.style.display = 'block';
            }

            setLoading('forgotBtn', false, 'Send Reset Link');
        });
    }

    // ── Check existing session on load ───────────────────────────
    if (window.db) {
        window.db.auth.getSession().then(async ({ data }) => {
            if (data.session) {
                // Already logged in — redirect to dashboard
                sessionStorage.setItem('isGuest', 'false');
                sessionStorage.setItem('user_email', data.session.user.email);
                window.location.href = 'dashboard.html';
            } else {
                // Not logged in — check for saved credentials to autofill
                if (navigator.credentials && navigator.credentials.get) {
                    try {
                        const cred = await navigator.credentials.get({ password: true });
                        if (cred && cred.type === 'password') {
                            // Show the mock autofill prompt
                            const autofillPrompt = document.getElementById('autofillPrompt');
                            const btnTrigger     = document.getElementById('btnTriggerAutofill');
                            
                            if (autofillPrompt && btnTrigger) {
                                autofillPrompt.style.display = 'block';
                                btnTrigger.onclick = () => {
                                    const emailEl = document.getElementById('loginEmail');
                                    const passEl  = document.getElementById('loginPassword');
                                    if (emailEl && passEl) {
                                        emailEl.value = cred.id;
                                        passEl.value  = cred.password;
                                        autofillPrompt.style.display = 'none';
                                        console.log('🪄 Form autofilled via prompt');
                                    }
                                };
                            }

                            // Prepare the account chooser
                            const accountChooser = document.getElementById('accountChooser');
                            const loginEmail     = document.getElementById('loginEmail');
                            const chooserName    = document.getElementById('chooserName');
                            const chooserEmail   = document.getElementById('chooserEmail');
                            const accountItem    = document.getElementById('accountItem');

                            if (accountChooser && loginEmail && chooserName && chooserEmail && accountItem) {
                                chooserName.textContent = cred.name || 'Saved Account';
                                chooserEmail.textContent = cred.id;

                                loginEmail.addEventListener('focus', () => {
                                    const rect = loginEmail.getBoundingClientRect();
                                    accountChooser.style.top = (rect.bottom + window.scrollY + 5) + 'px';
                                    accountChooser.style.left = rect.left + 'px';
                                    accountChooser.style.width = rect.width + 'px';
                                    accountChooser.style.display = 'block';
                                });

                                accountItem.onclick = () => {
                                    const passEl = document.getElementById('loginPassword');
                                    loginEmail.value = cred.id;
                                    if (passEl) passEl.value = cred.password;
                                    accountChooser.style.display = 'none';
                                    if (autofillPrompt) autofillPrompt.style.display = 'none';
                                };

                                // Hide when clicking outside
                                document.addEventListener('click', (e) => {
                                    if (!accountChooser.contains(e.target) && e.target !== loginEmail) {
                                        accountChooser.style.display = 'none';
                                    }
                                });
                            }
                        }
                    } catch (err) {
                        console.warn('Autofill retrieval failed:', err);
                    }
                }
            }
        });
    }
    // ── GOOGLE AUTH ──────────────────────────────────────────────
    window.signInWithGoogle = async function() {
        if (!window.db) {
            alert('Database not connected. Please refresh.');
            return;
        }

        try {
            console.log('🚀 Initialising Google OAuth...');
            const { data, error } = await window.db.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: window.location.origin + '/dashboard.html'
                }
            });

            if (error) throw error;
        } catch (err) {
            console.error('❌ Google Auth failed:', err.message);
            alert('Google login failed: ' + err.message);
        }
    };
});
