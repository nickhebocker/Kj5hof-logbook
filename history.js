import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const SUPABASE_URL = 'https://l7snUYdqjCF89ufpXxhI.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_l7snUYdqjCF89ufpXxhI7A_eVjZTm5G';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function loadData() {
    const tbody = document.getElementById('qso-body');
    tbody.innerHTML = "";
    const { data: { session } } = await supabase.auth.getSession();
    
    let logs = [];
    if (session?.user) {
        const { data } = await supabase.from('qsos').select('*').order('created_at', { ascending: false });
        if (data) logs = data;
        document.getElementById('sync-btn').classList.toggle('hidden', localStorage.getItem('localLogs') === null);
    }
    
    const local = JSON.parse(localStorage.getItem('localLogs') || '[]');
    const combined = [...logs, ...local];

    combined.forEach(q => {
        tbody.innerHTML += `<tr>
            <td>${new Date(q.created_at).toLocaleString()}</td>
            <td>${q.callsign}</td>
            <td>${q.freq}</td>
            <td>${q.mode}</td>
            <td>${q.rst_s}/${q.rst_r}</td>
            <td><button class="del-btn" data-id="${q.id || q.created_at}">Delete</button></td>
        </tr>`;
    });
}

document.addEventListener('DOMContentLoaded', () => {
    loadData();

    document.getElementById('sync-btn')?.addEventListener('click', async () => {
        const { data: { session } } = await supabase.auth.getSession();
        const local = JSON.parse(localStorage.getItem('localLogs') || '[]');
        if (session?.user && local.length > 0) {
            const toUpload = local.map(l => ({ ...l, user_id: session.user.id }));
            const { error } = await supabase.from('qsos').insert(toUpload);
            if (!error) {
                localStorage.removeItem('localLogs');
                loadData();
            }
        }
    });
});
