let logbookData = JSON.parse(localStorage.getItem('kj5hof_logs')) || [];
let editingIndex = -1;

const logForm = document.getElementById('logForm');
const logTableBody = document.querySelector('#logTable tbody');
const modal = document.getElementById('logbookModal');
const submitBtn = document.getElementById('submitBtn');

// Initialize
updateTable();

// Handle Form Submission
logForm.addEventListener('submit', function(e) {
    e.preventDefault();

    const entry = {
        date: document.getElementById('date').value,
        timeOn: document.getElementById('timeOn').value,
        timeOff: document.getElementById('timeOff').value,
        callsign: document.getElementById('callsign').value.toUpperCase(),
        name: document.getElementById('name').value,
        freq: document.getElementById('freq').value,
        band: document.getElementById('band').value,
        mode: document.getElementById('mode').value,
        rstSent: document.getElementById('rstSent').value,
        rstRcvd: document.getElementById('rstRcvd').value,
        power: document.getElementById('power').value,
        location: document.getElementById('location').value,
        state: document.getElementById('state').value,
        country: document.getElementById('country').value,
        gridsquare: document.getElementById('gridsquare').value,
        comment: document.getElementById('comment').value
    };

    if (editingIndex === -1) {
        logbookData.unshift(entry); // New entries at top
    } else {
        logbookData[editingIndex] = entry;
        editingIndex = -1;
        submitBtn.innerText = 'Save Contact';
        submitBtn.style.backgroundColor = '#28a745';
    }

    saveData();
    logForm.reset();
});

function saveData() {
    localStorage.setItem('kj5hof_logs', JSON.stringify(logbookData));
    updateTable();
}

function updateTable() {
    if (!logTableBody) return;
    logTableBody.innerHTML = '';
    
    logbookData.forEach((log, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>
                <button class="edit-btn" onclick="editEntry(${index})">Edit</button>
            </td>
            <td>${log.date}</td>
            <td>${log.timeOn}</td>
            <td>${log.callsign}</td>
            <td>${log.name}</td>
            <td>${log.freq}</td>
            <td>${log.band}</td>
            <td>${log.mode}</td>
            <td>${log.rstSent}</td>
            <td>${log.rstRcvd}</td>
            <td>${log.power}</td>
            <td>${log.location}</td>
            <td>${log.state}</td>
            <td>${log.country}</td>
            <td>${log.gridsquare}</td>
            <td>${log.comment}</td>
        `;
        logTableBody.appendChild(row);
    });
}

function editEntry(index) {
    const log = logbookData[index];
    
    document.getElementById('date').value = log.date;
    document.getElementById('timeOn').value = log.timeOn;
    document.getElementById('timeOff').value = log.timeOff;
    document.getElementById('callsign').value = log.callsign;
    document.getElementById('name').value = log.name;
    document.getElementById('freq').value = log.freq;
    document.getElementById('band').value = log.band;
    document.getElementById('mode').value = log.mode;
    document.getElementById('rstSent').value = log.rstSent;
    document.getElementById('rstRcvd').value = log.rstRcvd;
    document.getElementById('power').value = log.power;
    document.getElementById('location').value = log.location;
    document.getElementById('state').value = log.state;
    document.getElementById('country').value = log.country;
    document.getElementById('gridsquare').value = log.gridsquare;
    document.getElementById('comment').value = log.comment;

    editingIndex = index;
    submitBtn.innerText = 'Update Entry';
    submitBtn.style.backgroundColor = '#ffc107';
    
    closeModal();
    window.scrollTo({top: 0, behavior: 'smooth'});
}

function openModal() {
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden'; 
}

function closeModal() {
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
}

window.onclick = function(event) {
    if (event.target == modal) closeModal();
};
