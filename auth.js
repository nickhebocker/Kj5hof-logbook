import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

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

    // Tab Switching
    loginTab?.addEventListener('click', () => {
        callGroup.style.display = 'none';
        loginTab.classList.add('active');
        signupTab.classList.remove('active');
    });

    signupTab?.addEventListener('click', () => {
        callGroup.style.display = 'block';
        signupTab.classList.add('active');
        loginTab.classList.remove('active');
    });

    // Password Toggle
    togglePw?.addEventListener('click', () => {
        const pwInput = document.getElementById('password');
        pwInput.type = pwInput.type === 'password' ? 'text' : 'password';
    });

    // Guest Access
    guestBtn?.addEventListener('click', () => {
        localStorage.setItem('isGuest', 'true');
        window.location.href = 'main.html';
    });

    // Auth Submission
    authForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const isSignup = signupTab.classList.contains('active');

        if (isSignup) {
            const callsign = document.getElementById('reg-callsign').value.toUpperCase();
            const { error } = await supabase.auth.signUp({
                email,
                password,
                options: { data: { callsign: callsign } }
            });
            if (error) alert(error.message);
            else alert("Signup successful! Check your email for a confirmation link.");
        } else {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) alert(error.message);
            else {
                localStorage.setItem('isGuest', 'false');
                window.location.href = 'main.html';
            }
        }
    });
});
