import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

// Configuration
const SUPABASE_URL = 'https://l7snUYdqjCF89ufpXxhI.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_l7snUYdqjCF89ufpXxhI7A_eVjZTm5G';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

document.addEventListener('DOMContentLoaded', () => {
    const authForm = document.getElementById('auth-form');
    const guestBtn = document.getElementById('guest-btn');
    const togglePw = document.getElementById('toggle-pw');
    const loginTab = document.getElementById('tab-login');
    const signupTab = document.getElementById('tab-signup');
    const callGroup = document.getElementById('callsign-group');
    const passwordInput = document.getElementById('password');

    // Tab Switching Logic
    loginTab?.addEventListener('click', () => {
        callGroup.style.display = 'none';
        loginTab.classList.add('active');
        signupTab.classList.remove('active');
        document.getElementById('reg-callsign').required = false;
    });

    signupTab?.addEventListener('click', () => {
        callGroup.style.display = 'block';
        signupTab.classList.add('active');
        loginTab.classList.remove('active');
        document.getElementById('reg-callsign').required = true;
    });

    // Password Toggle Logic
    togglePw?.addEventListener('click', () => {
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);
    });

    // Guest Access Logic
    guestBtn?.addEventListener('click', () => {
        localStorage.setItem('isGuest', 'true');
        window.location.href = 'main.html';
    });

    // Form Submission (Auth) Logic
    authForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('email').value;
        const password = passwordInput.value;
        const isSignup = signupTab.classList.contains('active');
        const spinner = document.getElementById('loading-spinner');

        if (spinner) spinner.style.display = 'block';

        try {
            if (isSignup) {
                const callsign = document.getElementById('reg-callsign').value.toUpperCase();
                const { data, error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: { callsign: callsign }
                    }
                });
                
                if (error) throw error;
                alert("Signup successful! Please check your email for a confirmation link.");
            } else {
                const { data, error } = await supabase.auth.signInWithPassword({
                    email,
                    password
                });
                
                if (error) throw error;
                
                localStorage.setItem('isGuest', 'false');
                window.location.href = 'main.html';
            }
        } catch (err) {
            alert(err.message);
        } finally {
            if (spinner) spinner.style.display = 'none';
        }
    });
});
