// File: /js/pages/admin-result-analytics.js

// CRITICAL PATH CHECK: Assumes firebase-config.js is one folder up in 'shared'.
import { db } from '../shared/firebase-config.js'; 
import { getDocs, collection, query, where, getDoc, doc } from "https://www.gstatic.com/firebasejs/9.10.0/firebase-firestore.js";

// Global Chart instances to prevent errors on re-rendering
let scoreDistributionChart = null;
let passFailChart = null;

// --- UTILITY FUNCTIONS ---

/**
 * Populates a select element with options.
 */
function populateSelect(id, options, defaultLabel, valueKey = null, labelKey = null) {
    const selectEl = document.getElementById(id);
    if (!selectEl) return;
    
    selectEl.innerHTML = `<option value="">${defaultLabel}</option>`;
    options.sort((a, b) => {
        const valA = valueKey ? a[valueKey] : a;
        const valB = valueKey ? b[valueKey] : b;
        return String(valA).localeCompare(String(valB));
    }).forEach(opt => {
        const value = valueKey ? opt[valueKey] : opt;
        const label = labelKey ? opt[labelKey] : opt;
        selectEl.innerHTML += `<option value="${value}">${label}</option>`;
    });
}

/**
 * Renders the score distribution bar chart.
 */
function renderScoreDistributionChart(scores) {
    const ctx = document.getElementById('score-distribution-chart').getContext('2d');
    
    // Define score bins (e.g., 0-20, 21-40, 41-60, 61-80, 81-100)
    const bins = [0, 20, 40, 60, 80, 100];
    const labels = ['0-20%', '21-40%', '41-60%', '61-80%', '81-100%'];
    const data = new Array(labels.length).fill(0);
    
    scores.forEach(score => {
        // Assuming max score is 100 for percentage calculation
        const percentage = score; 
        
        if (percentage >= 81) data[4]++;
        else if (percentage >= 61) data[3]++;
        else if (percentage >= 41) data[2]++;
        else if (percentage >= 21) data[1]++;
        else data[0]++;
    });

    if (scoreDistributionChart) scoreDistributionChart.destroy();

    scoreDistributionChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Number of Students',
                data: data,
                backgroundColor: 'rgba(54, 162, 235, 0.6)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: { beginAtZero: true, title: { display: true, text: 'Students' } }
            }
        }
    });
}

/**
 * Renders the pass/fail doughnut chart.
 */
function renderPassFailChart(passCount, failCount) {
    const ctx = document.getElementById('pass-fail-chart').getContext('2d');
    
    if (passFailChart) passFailChart.destroy();

    passFailChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Passed', 'Failed'],
            datasets: [{
                data: [passCount, failCount],
                backgroundColor: ['rgb(75, 192, 192)', 'rgb(255, 99, 132)'],
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'top' },
                title: { display: true, text: 'Pass/Fail (50% cut-off)' }
            }
        }
    });
}


/**
 * Renders student details in the table.
 */
function renderStudentResultsTable(results) {
    const tbody = document.getElementById('results-tbody');
    tbody.innerHTML = '';

    if (results.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-gray-500 p-8">No student results found for this test.</td></tr>';
        return;
    }

    results.forEach(res => {
        const percentage = ((res.score / res.totalMarks) * 100).toFixed(1);
        const status = res.score >= (res.totalMarks / 2) ? 'PASS' : 'FAIL';
        const statusClass = status === 'PASS' ? 'text-green-600' : 'text-red-600';

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${res.regNo}</td>
            <td>${res.studentName}</td>
            <td>${res.score} / ${res.totalMarks}</td>
            <td>${percentage}%</td>
            <td class="${statusClass} font-semibold">${status}</td>
        `;
        tbody.appendChild(row);
    });
}


// --- CORE LOGIC ---

/**
 * Step 1: Initialize filters (Dept, Year)
 */
async function initializeFilters() {
    if (!db) {
        console.error("CRITICAL ERROR: DB is not initialized.");
        return;
    }
    
    try {
        const appDataSnap = await getDoc(doc(db, 'metadata', 'appData'));
        if (appDataSnap.exists()) {
            const metadata = appDataSnap.data();
            populateSelect('filter-dept', metadata.departments || [], '-- All Depts --');
            populateSelect('filter-year', metadata.years || [], '-- All Years --');
        }
    } catch (error) {
        console.error("Error initializing filters:", error);
    }
}

/**
 * Step 2: Update Test ID dropdown based on Dept/Year selection
 */
async function updateTestSelect() {
    const dept = document.getElementById('filter-dept').value;
    const year = document.getElementById('filter-year').value;
    const testSelect = document.getElementById('filter-test-id');
    const viewButton = document.getElementById('view-analytics-btn');
    
    testSelect.disabled = true;
    viewButton.disabled = true;
    testSelect.innerHTML = '<option value="">-- Loading Tests... --</option>';

    if (!dept || !year) {
        testSelect.innerHTML = '<option value="">-- Select Dept & Year --</option>';
        return;
    }

    try {
        // Query the 'tests' collection for tests matching the filters
        const q = query(collection(db, 'tests'), 
                        where('departments', 'array-contains', dept),
                        where('years', 'array-contains', year)
                    );
        const querySnapshot = await getDocs(q);
        
        const tests = querySnapshot.docs.map(doc => ({
            testId: doc.data().testId,
            title: doc.data().title
        }));
        
        if (tests.length > 0) {
            populateSelect('filter-test-id', tests, '-- Choose Test --', 'testId', 'title');
            testSelect.disabled = false;
        } else {
            testSelect.innerHTML = '<option value="">-- No Tests Found --</option>';
        }

    } catch (error) {
        console.error("Error fetching tests for filters:", error);
        testSelect.innerHTML = '<option value="">-- Error Loading Tests --</option>';
    }
}

/**
 * Step 3: Fetch and display results for the selected test
 */
async function loadAnalytics() {
    const testId = document.getElementById('filter-test-id').value;
    const analyticsContent = document.getElementById('analytics-content');

    if (!testId) {
        alert("Please select a valid test.");
        return;
    }

    analyticsContent.innerHTML = '<p class="text-center text-gray-500 p-8">Fetching results...</p>';
    document.getElementById('analytics-summary').style.display = 'none';
    document.getElementById('analytics-charts-container').style.display = 'none';
    
    // Clear previous charts if they exist
    if (scoreDistributionChart) scoreDistributionChart.destroy();
    if (passFailChart) passFailChart.destroy();

    try {
        // 1. Fetch test details (to get totalMarks)
        const testDoc = await getDoc(doc(db, 'tests', testId));
        if (!testDoc.exists()) {
             analyticsContent.innerHTML = '<p class="text-center text-red-500 p-8">Error: Test details not found.</p>';
             return;
        }
        const totalMarks = testDoc.data().totalMarks || 100; // Default to 100 if missing

        // 2. Fetch all results for the selected testId
        const q = query(collection(db, 'test_results'), where('testId', '==', testId));
        const resultsSnap = await getDocs(q);
        
        const results = resultsSnap.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            totalMarks: totalMarks // Attach total marks to each result for calculation
        }));

        if (results.length === 0) {
            analyticsContent.innerHTML = '<p class="text-center text-gray-500 p-8">No results submitted for this test yet.</p>';
            renderStudentResultsTable([]);
            return;
        }

        // 3. Process Data
        const scores = results.map(res => res.score || 0);
        const totalStudents = scores.length;
        const sumScores = scores.reduce((sum, score) => sum + score, 0);
        const avgScore = sumScores / totalStudents;
        const highScore = Math.max(...scores);
        const passCutoff = totalMarks / 2;
        const passCount = scores.filter(s => s >= passCutoff).length;
        const failCount = totalStudents - passCount;
        const passRate = (passCount / totalStudents) * 100;

        // 4. Update UI
        document.getElementById('avg-score').textContent = `${avgScore.toFixed(2)} / ${totalMarks}`;
        document.getElementById('high-score').textContent = `${highScore} / ${totalMarks}`;
        document.getElementById('pass-rate').textContent = `${passRate.toFixed(1)}%`;
        document.getElementById('participants').textContent = totalStudents;
        
        analyticsContent.innerHTML = ''; // Clear 'Fetching results...'
        document.getElementById('analytics-summary').style.display = 'grid';
        document.getElementById('analytics-charts-container').style.display = 'grid';
        
        // 5. Render Charts and Table
        const scorePercentages = scores.map(s => (s / totalMarks) * 100);
        renderScoreDistributionChart(scorePercentages);
        renderPassFailChart(passCount, failCount);
        renderStudentResultsTable(results);

    } catch (error) {
        console.error("Error loading analytics:", error);
        analyticsContent.innerHTML = `<p class="text-center text-red-500 p-8">An error occurred: ${error.message}</p>`;
    }
}


// --- EVENT HANDLERS ---

function setupEventListeners() {
    const deptSelect = document.getElementById('filter-dept');
    const yearSelect = document.getElementById('filter-year');
    const testSelect = document.getElementById('filter-test-id');
    const viewButton = document.getElementById('view-analytics-btn');
    
    // Listen for changes in Dept or Year to update Test ID list
    [deptSelect, yearSelect].forEach(select => {
        select.addEventListener('change', updateTestSelect);
    });

    // Enable View button when a Test is selected
    testSelect.addEventListener('change', () => {
        viewButton.disabled = !testSelect.value;
    });

    // Load Analytics when button is clicked
    viewButton.addEventListener('click', loadAnalytics);
}

// --- EXPORTED INITIALIZER ---

export function initResultAnalytics() {
    console.log("initResultAnalytics started.");
    initializeFilters();
    setupEventListeners();
}