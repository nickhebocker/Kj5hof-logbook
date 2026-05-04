let logbookData = JSON.parse(localStorage.getItem('kj5hof_logs')) || [];
let editingIndex = -1;

const logForm = document.getElementById('logForm');
const logTableBody = document.querySelector('#logTable tbody');
const modal = document.getElementById('logbookModal');

// Initialize view
updateTable();

// Handle Form Submission (Add or Update)
logForm.addEventListener('submit', function(e) {
    e.preventDefault();

    const newEntry = {
        date: document.getElementById('date').value,
        time: document.getElementById('time').value,
        callsign: document.getElementById('callsign').value.toUpperCase(),
        frequency: document.getElementById('frequency').value,
        mode: document.getElementById('mode').value,
        rstSent: document.getElementById('rstSent').value,
        rstRcvd: document.getElementById('rstRcvd').value,
        notes: document.getElementById('notes').value
    };

    if (editingIndex === -1) {
        // Add new
        logbookData.push(newEntry);
    } else {
        // Update existing
        logbookData[editingIndex] = newEntry;
        editingIndex = -1;
        document.getElementById('submitBtn').innerText = 'Save Contact';
    }

    saveAndRefresh();
    logForm.reset();
});

function saveAndRefresh() {
    localStorage.setItem('kj5hof_logs', JSON.stringify(logbookData));
    updateTable();
}

function updateTable() {
    logTableBody.innerHTML = '';
    
    logbookData.forEach((log, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${log.date}</td>
            <td>${log.time}</td>
            <td>${log.callsign}</td>
            <td>${log.frequency}</td>
            <td>${log.mode}</td>
            <td>${log.rstSent}</td>
            <td>${log.rstRcvd}</td>
            <td>${log.notes}</td>
            <td>
                <button class="edit-btn" onclick="editEntry(${index})">Edit</button>
            </td>
        `;
        logTableBody.appendChild(row);
    });
}

function editEntry(index) {
    const log = logbookData[index];
    
    // Fill form with existing data
    document.getElementById('date').value = log.date;
    document.getElementById('time').value = log.time;
    document.getElementById('callsign').value = log.callsign;
    document.getElementById('frequency').value = log.frequency;
    document.getElementById('mode').value = log.mode;
    document.getElementById('rstSent').value = log.rstSent;
    document.getElementById('rstRcvd').value = log.rstRcvd;
    document.getElementById('notes').value = log.notes;

    // Set state to editing
    editingIndex = index;
    document.getElementById('submitBtn').innerText = 'Update Entry';
    
    // Close modal if it was open
    closeModal();
    window.scrollTo(0, 0);
}

function openModal() {
    modal.style.display = 'block';
    updateTable();
}

function closeModal() {
    modal.style.display = 'none';
}

// Close modal if user clicks outside of it
window.onclick = function(event) {
    if (event.target == modal) {
        closeModal();
    }
};
