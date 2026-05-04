// Configuration - Change these to your desired credentials
const OWNER_USER = "admin";
const OWNER_PASS = "logbook123";

// Element Selectors
const loginContainer = document.getElementById('login-container');
const mainContent = document.getElementById('main-content');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const errorMessage = document.getElementById('error-message');

const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const logBody = document.getElementById('log-body');

// 1. Login Functionality
loginBtn.addEventListener('click', () => {
    const user = usernameInput.value;
    const pass = passwordInput.value;

    if (user === OWNER_USER && pass === OWNER_PASS) {
        // Success
        errorMessage.style.display = 'none';
        loginContainer.style.display = 'none';
        mainContent.style.display = 'block';
        loadLogData();
    } else {
        // Failure
        errorMessage.style.display = 'block';
        passwordInput.value = ""; // Clear password field on fail
    }
});

// 2. Logout Functionality
logoutBtn.addEventListener('click', () => {
    mainContent.style.display = 'none';
    loginContainer.style.display = 'block';
    usernameInput.value = "";
    passwordInput.value = "";
});

// 3. Data Fetching
function loadLogData() {
    fetch('logbook.json')
        .then(response => {
            if (!response.ok) {
                throw new Error("Could not fetch logbook.json");
            }
            return response.json();
        })
        .then(data => {
            renderLogs(data);
        })
        .catch(error => {
            console.error("Error loading logs:", error);
            logBody.innerHTML = "<tr><td colspan='4'>Error loading data.</td></tr>";
        });
}

// 4. Render Data to Table
function renderLogs(logs) {
    logBody.innerHTML = ""; // Clear existing
    logs.forEach(entry => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${entry.date || 'N/A'}</td>
            <td>${entry.callsign || 'N/A'}</td>
            <td>${entry.frequency || 'N/A'}</td>
            <td>${entry.mode || 'N/A'}</td>
        `;
        logBody.appendChild(row);
    });
}
