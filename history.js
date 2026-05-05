import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

// Configuration
const SUPABASE_URL = 'https://l7snUYdqjCF89ufpXxhI.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_l7snUYdqjCF89ufpXxhI7A_eVjZTm5G';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let allLogs = [];

/**
 * Loads data from Supabase (if logged in) and LocalStorage
 */
async function loadData() {
    const { data: { session } } = await supabase.auth.getSession();
    
    let cloudLogs = [];
    if (session?.user) {
        const { data, error } = await supabase
            .from('qsos')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (data) cloudLogs = data;
        
        // Show sync button only if local logs exist and user is logged in
        const localData = localStorage.getItem('localLogs');
        const hasLocal = localData && JSON.parse(localData).length > 0;
        document.getElementById('sync-btn').classList.toggle('hidden', !hasLocal);
    }
    
    const localLogs = JSON.parse(localStorage.getItem('localLogs') || '[]');
    
    // Combine logs. Cloud logs have an 'id', local logs usually don't.
    allLogs = [...localLogs, ...cloudLogs];
    renderTable(allLogs);
}

/**
 * Renders the log array to the HTML table
 */
function renderTable(logs) {
    const tbody = document.getElementById('qso-body');
    tbody.innerHTML = "";

    logs.forEach(q => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${new Date(q.created_at).toLocaleString()}</td>
            <td><strong>${q.callsign}</strong></td>
            <td>${q.freq} MHz</td>
            <td>${q.mode}</td>
            <td>${q.rst_s} / ${q.rst_r}</td>
            <td>
                <button class="del-btn" data-id="${q.id || ''}" data-ts="${q.created_at}">Delete</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

/**
 * Deletes a record from either Supabase or LocalStorage
 */
async function deleteLog(id, timestamp) {
    if (!confirm("Are you sure you want to delete this log?")) return;

    if (id) {
        // Cloud Delete
        const { error } = await supabase.from('qsos').delete().eq('id', id);
        if (error) alert("Error deleting from cloud: " + error.message);
    } else {
        // Local Delete
        let local = JSON.parse(localStorage.getItem('localLogs') || '[]');
        local = local.filter(l => l.created_at !== timestamp);
        localStorage.setItem('localLogs', JSON.stringify(local));
    }
    loadData();
}

/**
 * Simple CSV Export
 */
function exportCSV() {
    if (allLogs.length === 0) return alert("No logs to export.");
    let csv = "Date,Callsign,Freq,Mode,RST_S,RST_R,Notes\n";
    allLogs.forEach(q => {
        csv += `${q.created_at},${q.callsign},${q.freq},${q.mode},${q.rst_s},${q.rst_r},"${q.notes || ''}"\n`;
    });
    downloadFile(csv, "radiolog_export.csv", "text/csv");
}

function downloadFile(content, fileName, contentType) {
    const a = document.createElement("a");
    const file = new Blob([content], { type: contentType });
    a.href = URL.createObjectURL(file);
    a.download = fileName;
    a.click();
}

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    loadData();

    // Search Filtering
    document.getElementById('search-bar').addEventListener('input', (e) => {
        const term = e.target.value.toUpperCase();
        const filtered = allLogs.filter(q => 
            q.callsign.includes(term) || 
            q.mode.toUpperCase().includes(term) ||
            new Date(q.created_at).toLocaleString().includes(term)
        );
        renderTable(filtered);
    });

    // Event Delegation for Delete Buttons
    document.getElementById('qso-body').addEventListener('click', (e) => {
        if (e.target.classList.contains('del-btn')) {
            const id = e.target.getAttribute('data-id');
            const ts = e.target.getAttribute('data-ts');
            deleteLog(id, ts);
        }
    });

    // Sync Local Logs to Cloud
    document.getElementById('sync-btn')?.addEventListener('click', async () => {
        const { data: { session } } = await supabase.auth.getSession();
        const local = JSON.parse(localStorage.getItem('localLogs') || '[]');
        
        if (session?.user && local.length > 0) {
            const toUpload = local.map(l => ({ ...l, user_id: session.user.id }));
            const { error } = await supabase.from('qsos').insert(toUpload);
            
            if (!error) {
                localStorage.removeItem('localLogs');
                alert("Cloud sync complete!");
                loadData();
            } else {
                alert("Sync failed: " + error.message);
            }
        }
    });

    // Export Listeners
    document.getElementById('export-csv').addEventListener('click', exportCSV);
    document.getElementById('export-adif').addEventListener('click', () => {
        alert("ADIF Export function triggered (logic to be implemented based on ADIF standards).");
    });
});
