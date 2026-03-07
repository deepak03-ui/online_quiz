// File: /js/portals/admin/pages/admin-dashboard.js

// Path corrected: Three levels up to reach /js/shared/
import { db } from '../../../shared/firebase-config.js'; 
import { getDocs, collection, query, where, orderBy, limit, Timestamp } from "https://www.gstatic.com/firebasejs/9.10.0/firebase-firestore.js";

let uptimeInterval = null;

// --- CONFIGURATION: BASE COLLECTION PATHS ---
// These paths target your database structure (e.g., scores/users)
const SCORES_COLLECTION = 'scores';
const USERS_COLLECTION_PATH = `${SCORES_COLLECTION}/users`;
const TESTS_COLLECTION_PATH = `${SCORES_COLLECTION}/tests`;
const RESULTS_COLLECTION_PATH = `${SCORES_COLLECTION}/test_results`; 
// -----------------------------------------------------------------


// --- UTILITY FUNCTIONS ---
function renderActivityChart() {
    const ctx = document.getElementById('activity-bar-chart')?.getContext('2d');
    if (!ctx || typeof Chart === 'undefined') return;
    const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const data = [120, 150, 100, 210, 180, 250, 140]; 
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{ label: 'Test Sessions Started', data: data, backgroundColor: '#3b82f6', borderRadius: 4 }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true }, x: { grid: { display: false } } }
        }
    });
}

function formatUptime(seconds) {
    const d = Math.floor(seconds / (3600*24));
    const h = Math.floor(seconds % (3600*24) / 3600);
    const m = Math.floor(seconds % 3600 / 60);
    return `${d}d ${h}h ${m}m`;
}


/**
 * 1. Fetches key statistics for the dashboard cards.
 */
async function fetchKeyStats() {
    if (!db) {
        console.error("DB INIT FAILED: Cannot fetch key stats. Check firebase-config.js.");
        document.querySelectorAll('.stat-value').forEach(el => el.textContent = 'INIT FAIL');
        document.getElementById('health-alert-log').textContent = `DB Initialization Failed. Check Console.`;
        return;
    }
    
    try {
        const fetchPromises = [
            getDocs(collection(db, USERS_COLLECTION_PATH)),          
            getDocs(collection(db, TESTS_COLLECTION_PATH)),          
            getDocs(collection(db, RESULTS_COLLECTION_PATH)),        
        ];
        
        const now = Timestamp.now();
        const activeQ = query(collection(db, TESTS_COLLECTION_PATH), where('start', '<=', now), where('end', '>=', now));
        fetchPromises.push(getDocs(activeQ));
        
        const [usersSnap, allTestsSnap, resultsSnap, activeTestsSnap] = await Promise.all(fetchPromises);

        document.getElementById('stat-total-students').textContent = usersSnap.size.toLocaleString();
        document.getElementById('stat-total-tests').textContent = allTestsSnap.size.toLocaleString();
        document.getElementById('stat-total-results').textContent = resultsSnap.size.toLocaleString();
        document.getElementById('stat-active-tests').textContent = activeTestsSnap.size.toLocaleString();

        document.getElementById('health-db-status').textContent = 'Operational';
        document.getElementById('health-db-status').className = 'px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800';

    } catch (error) {
        console.error("FATAL ERROR: Firestore read failed. Check Security Rules and Indexes.", error);
        document.querySelectorAll('.stat-value').forEach(el => el.textContent = 'RULE ERR');
        document.getElementById('health-alert-log').textContent = `DB Fetch Failed: ${error.message}. Check Security Rules/Indexes.`;
        document.getElementById('health-db-status').textContent = 'ERROR';
        document.getElementById('health-db-status').className = 'px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800';
    }
}

/**
 * 2. Fetches and displays the most recent 5 test creations.
 */
async function fetchRecentTests() {
    const tbody = document.getElementById('recent-tests-tbody');
    if (!tbody || !db) return; 

    tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-gray-400">Fetching tests...</td></tr>';
    
    try {
        const q = query(
            collection(db, TESTS_COLLECTION_PATH), 
            orderBy('createdAt', 'desc'), 
            limit(5)
        );
        const snapshot = await getDocs(q);
        const recentTests = snapshot.docs.map(doc => doc.data());

        if (recentTests.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-gray-400">No tests created yet.</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        recentTests.forEach(test => {
            const row = document.createElement('tr');
            row.className = 'hover:bg-gray-50';
            row.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${test.title || 'N/A'}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${test.subject || 'N/A'}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${test.totalQuestions || 0}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${test.createdBy || 'System'}</td>
            `;
            tbody.appendChild(row);
        });

    } catch (error) {
        console.error("Error fetching recent tests (Check createdAt index):", error);
        tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-red-500">Failed to load recent tests.</td></tr>';
    }
}

function setupSystemHealth() {
    let currentUptimeSeconds = 124500; // Simulated start
    const uptimeEl = document.getElementById('health-uptime');
    const sessionsEl = document.getElementById('health-sessions');
    
    if (uptimeInterval) clearInterval(uptimeInterval);

    uptimeInterval = setInterval(() => {
        currentUptimeSeconds++;
        if (uptimeEl) uptimeEl.textContent = formatUptime(currentUptimeSeconds);
    }, 1000);

    // Simulated active sessions
    let sessionCount = 5;
    setInterval(() => {
        sessionCount = Math.max(5, Math.floor(Math.random() * 20) + 5); 
        if (sessionsEl) sessionsEl.textContent = sessionCount;
    }, 10000);
}


// --- EXPORTED INITIALIZER ---

export function initAdminDashboard(admin) {
    console.log("initAdminDashboard started.");
    fetchKeyStats();
    fetchRecentTests();
    setupSystemHealth();
    renderActivityChart();
}

export function cleanupAdminDashboard() {
    if (uptimeInterval) {
        clearInterval(uptimeInterval);
        uptimeInterval = null;
    }
}