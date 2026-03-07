// File: /js/pages/admin-tests-list.js

// --- CRITICAL PATH CHECK: The two most common paths for /js/pages/ to reach /js/shared/ ---
// 1. If /js/pages/ and /js/shared/ are siblings within /js/
// import { db } from '../shared/firebase-config.js'; 

// 2. ALTERNATIVE: If /js/pages/ is the root for pages, but firebase-config is in the root /js/shared
// (We will stick with the one that is most common for nested folders, but keep 
// the console check to catch failure.)
import { db } from '../shared/firebase-config.js'; 

import { getDocs, collection, query, orderBy, getDoc, doc } from "https://www.gstatic.com/firebasejs/9.10.0/firebase-firestore.js";

// --- GLOBAL REFERENCES ---
// Check if db is valid before creating the collection reference
const allTestsCollection = db ? collection(db, 'tests') : null;

// --- UTILITY FUNCTIONS (omitted for brevity, confirmed correct) ---

function getTestStatus(startDate, endDate) {
    const now = new Date();
    if (now < startDate) {
        return { status: 'Upcoming', className: 'status-upcoming' };
    } else if (now >= startDate && now <= endDate) {
        return { status: 'Active', className: 'status-active' };
    } else {
        return { status: 'Finished', className: 'status-finished' };
    }
}

function renderTests(tests) {
    const tbody = document.getElementById('tests-tbody');
    const testCountEl = document.getElementById('test-count');
    tbody.innerHTML = '';
    testCountEl.textContent = tests.length;

    if (tests.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center text-gray-500 p-8">No tests found matching the current filters.</td></tr>';
        return;
    }

    tests.forEach(test => {
        const startDate = test.start.toDate();
        const endDate = test.end.toDate();
        const { status, className } = getTestStatus(startDate, endDate);

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${test.testId}</td>
            <td>${test.title}</td>
            <td>${test.subject}</td>
            <td>${test.departments?.join(', ') || 'N/A'} / ${test.years?.join(', ') || 'N/A'}</td>
            <td>${test.totalQuestions}</td>
            <td>${startDate.toLocaleString()}</td>
            <td>${endDate.toLocaleString()}</td>
            <td><span class="${className} status-badge">${status}</span></td>
            <td>
                <button class="btn-secondary btn-sm" data-action="view" data-id="${test.testId}">View</button>
                <button class="btn-secondary btn-sm" data-action="results" data-id="${test.testId}">Results</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function populateFilterSelect(id, options, defaultLabel) {
    const selectEl = document.getElementById(id);
    if (!selectEl) return;
    
    selectEl.innerHTML = `<option value="">${defaultLabel}</option>`;
    options.sort().forEach(opt => {
        selectEl.innerHTML += `<option value="${opt}">${opt}</option>`;
    });
}

// --- CORE LOGIC ---

/**
 * 1. Fetches metadata for filters (Dept, Year)
 */
async function initializeFilters() {
    // CRITICAL CHECK 1: Was the DB object successfully imported?
    if (!db) {
        console.error("CRITICAL ERROR: 'db' object is null. The path to '../shared/firebase-config.js' is likely incorrect or firebase-config.js failed to initialize 'db'.");
        populateFilterSelect('filter-department', [], 'DB Init Failed');
        populateFilterSelect('filter-year', [], 'DB Init Failed');
        return;
    }
    
    const docPath = 'metadata';
    const docId = 'appData';

    try {
        console.log(`[DB CHECK] Attempting to fetch document: ${docPath}/${docId}`);
        const appDataSnap = await getDoc(doc(db, docPath, docId));
        
        // CRITICAL CHECK 2: Does the document exist?
        if (appDataSnap.exists()) {
            const metadata = appDataSnap.data();
            
            // CRITICAL CHECK 3: Do the required fields exist inside the document?
            const departments = metadata.departments || [];
            const years = metadata.years || [];

            if (departments.length === 0 || years.length === 0) {
                 console.warn("WARNING: Document found, but 'departments' or 'years' arrays are empty or missing/misspelled inside the document.");
            } else {
                 console.log("SUCCESS: Departments and Years loaded.");
            }
            
            populateFilterSelect('filter-department', departments, 'All Departments');
            populateFilterSelect('filter-year', years, 'All Years');
        } else {
            console.error(`ERROR: Firestore document '${docPath}/${docId}' NOT FOUND. Please verify the document exists in your database.`);
            populateFilterSelect('filter-department', [], 'Doc Missing');
            populateFilterSelect('filter-year', [], 'Doc Missing');
        }
        
        // Only fetch tests if the DB connection is up
        fetchAndCacheTests(); 
        
    } catch (error) {
        // This usually catches network issues or bad credentials, which you already ruled out.
        console.error("FATAL FETCH ERROR: An unexpected error occurred during metadata fetch.", error);
        populateFilterSelect('filter-department', [], 'FETCH ERROR');
        populateFilterSelect('filter-year', [], 'FETCH ERROR');
    }
}

/**
 * 2. Fetches all tests (or a sensible limit) and caches them locally.
 */
async function fetchAndCacheTests() {
    if (!allTestsCollection) return;

    try {
        const q = query(allTestsCollection, orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);
        
        allTestsCache = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        console.log(`Fetched and cached ${allTestsCache.length} tests.`);
        applyFiltersAndRender(false);

    } catch (error) {
        console.error("Error fetching tests.", error);
        document.getElementById('tests-tbody').innerHTML = '<tr><td colspan="9" class="text-center text-red-500 p-8">Failed to load tests from Firebase.</td></tr>';
    }
}


/**
 * 3. Applies filters to the cached data and calls render.
 */
function applyFiltersAndRender(log = true) {
    const deptFilter = document.getElementById('filter-department').value;
    const yearFilter = document.getElementById('filter-year').value;
    const subjectFilter = document.getElementById('filter-subject').value;
    const statusFilter = document.getElementById('filter-status').value;

    let filteredTests = allTestsCache.filter(test => {
        if (!test.start || !test.end) return false;
        
        const { status } = getTestStatus(test.start.toDate(), test.end.toDate());
        
        if (deptFilter && !test.departments?.includes(deptFilter)) {
            return false;
        }
        
        if (yearFilter && !test.years?.includes(yearFilter)) {
            return false;
        }
        
        if (subjectFilter && test.subject !== subjectFilter) {
            return false;
        }
        
        if (statusFilter && status.toLowerCase() !== statusFilter) {
            return false;
        }

        return true;
    });

    if (log) console.log(`Applying filters. Found ${filteredTests.length} tests.`);

    renderTests(filteredTests);
}

// --- EVENT HANDLERS (omitted for brevity, confirmed correct) ---

function setupEventListeners() {
    document.getElementById('apply-filters-btn')?.addEventListener('click', () => {
        applyFiltersAndRender(true);
    });

    document.getElementById('reset-filters-btn')?.addEventListener('click', () => {
        document.getElementById('filter-department').value = '';
        document.getElementById('filter-year').value = '';
        document.getElementById('filter-subject').value = '';
        document.getElementById('filter-status').value = '';
        applyFiltersAndRender(true);
    });
    
    // Auto-update Subject filter based on Dept/Year selection
    const deptSelect = document.getElementById('filter-department');
    const yearSelect = document.getElementById('filter-year');
    
    if (deptSelect && yearSelect) {
        [deptSelect, yearSelect].forEach(select => {
            select.addEventListener('change', async () => {
                const dept = deptSelect.value;
                const year = yearSelect.value;
                
                if (dept && year) {
                    const subjectKey = `${dept}_${year}`; 
                    try {
                        const subjectSnap = await getDoc(doc(db, 'subjects', subjectKey));
                        if (subjectSnap.exists() && subjectSnap.data().subjectCodes) {
                            populateFilterSelect('filter-subject', subjectSnap.data().subjectCodes, 'All Subjects');
                        } else {
                            populateFilterSelect('filter-subject', [], 'No Subjects Found');
                        }
                    } catch(e) {
                         populateFilterSelect('filter-subject', [], 'Error Loading Subjects');
                    }
                } else {
                    populateFilterSelect('filter-subject', [], 'All Subjects');
                }
            });
        });
    }

    // Handle Action Buttons (View, Results)
    document.getElementById('tests-tbody')?.addEventListener('click', (e) => {
        const target = e.target;
        if (target.tagName === 'BUTTON' && target.dataset.id) {
            const testId = target.dataset.id;
            const action = target.dataset.action;
            
            if (action === 'view') {
                console.log(`Action: View details for Test ID: ${testId}`);
            } else if (action === 'results') {
                console.log(`Action: View results for Test ID: ${testId}`);
            }
        }
    });
}

// --- EXPORTED INITIALIZER ---

export function initTestBank() {
    console.log("initTestBank started. Running critical checks.");
    initializeFilters();
    setupEventListeners();
}