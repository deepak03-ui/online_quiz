// File: /js/student-dashboard.js

// CRITICAL PATH CHECK: Import path is relative to /js/student-dashboard.js -> /js/shared/firebase-config.js
import { db } from './shared/firebase-config.js'; 
import { query, collection, where, getDocs } from "https://www.gstatic.com/firebasejs/9.10.0/firebase-firestore.js";

/**
 * Renders the student's profile details into the profile section and header.
 * @param {object} studentData - The student's data object (from sessionStorage/login).
 */
export function renderProfileDetails(studentData) {
    if (!studentData) return;

    const getInitial = (name) => (name ? name.charAt(0).toUpperCase() : 'S');
    const getFullName = (name) => (name || 'Student');
    const getRollNo = (regNo) => (regNo || 'N/A');
    const getDept = (dept) => (dept || 'N/A');
    const getYearSection = (year, section) => (year && section ? `${year} - Sec ${section}` : 'N/A');

    // Update Header (using IDs from student-new2.html)
    document.getElementById('welcome-name').textContent = getFullName(studentData.name);
    
    // Update Profile Card Details (These elements must be present from loading the component HTML)
    const avatarEl = document.getElementById('student-avatar-initial');
    if (avatarEl) {
        avatarEl.textContent = getInitial(studentData.name);
        document.getElementById('student-name-display').textContent = getFullName(studentData.name);
        document.getElementById('student-roll-display').textContent = getRollNo(studentData.regNo);
        
        document.getElementById('detail-email').textContent = studentData.email || 'N/A';
        document.getElementById('detail-rollno').textContent = getRollNo(studentData.regNo);
        document.getElementById('detail-department').textContent = getDept(studentData.department);
        document.getElementById('detail-year-section').textContent = getYearSection(studentData.year, studentData.section);
    } else {
        console.warn("Profile card elements not found. Ensure student-profile-summary.html is loaded into #profile.");
    }
}

/**
 * Fetches and calculates the number of Pending and Done tests for the student.
 * Updates the counters in the dashboard-overview section.
 * @param {object} student - The student's context containing regNo, dept, year, section.
 */
async function fetchTestMetrics(student) {
    // IDs from student-new2.html
    const pendingCountEl = document.getElementById('welcome-pending-tests');
    const doneCountEl = document.getElementById('welcome-completed-tests');
    
    if (!pendingCountEl || !doneCountEl) return;

    pendingCountEl.textContent = '0';
    doneCountEl.textContent = '0';

    if (!db) {
        console.error("DB not initialized. Check firebase-config.js.");
        return;
    }

    try {
        const studentRegNo = student.regNo;
        const now = new Date();

        // 1. Fetch ALL tests applicable to the student's current assignment group
        const qTests = query(
            collection(db, 'tests'), 
            where('departments', 'array-contains', student.department),
            where('years', 'array-contains', student.year),
            where('sections', 'array-contains', student.section),
            where('end', '>', now) // Only consider tests that haven't ended yet
        );
        const testsSnap = await getDocs(qTests);
        const applicableTestIds = testsSnap.docs.map(doc => doc.id);

        // 2. Fetch the student's completed results
        const qResults = query(
            collection(db, 'test_results'),
            where('regNo', '==', studentRegNo)
        );
        const resultsSnap = await getDocs(qResults);
        const completedTestIds = resultsSnap.docs.map(doc => doc.data().testId);

        // 3. Calculate Metrics
        
        // Tests Done: Completed tests that were assigned and upcoming.
        const testsDone = completedTestIds.filter(id => applicableTestIds.includes(id)).length;
        doneCountEl.textContent = testsDone;

        // Tests Pending: Assigned tests (applicableTestIds) that were NOT completed.
        const testsPending = applicableTestIds.length - testsDone;
        pendingCountEl.textContent = testsPending;

    } catch (error) {
        console.error("Error fetching test metrics (check Firebase Rules/Indexes):", error);
        pendingCountEl.textContent = 'ERR';
        doneCountEl.textContent = 'ERR';
    }
}


// --- EXPORTED INITIALIZER ---

/**
 * Main function to initialize the dashboard's profile and stats section.
 * @param {object} studentContext - The student's context data.
 */
export async function initStudentDashboard(studentContext) {
    if (!studentContext || !studentContext.regNo) {
        console.error("Student context missing. Cannot initialize dashboard.");
        return;
    }
    
    // 1. Render Profile Details into the component that was loaded into #profile
    renderProfileDetails(studentContext);

    // 2. Fetch and Calculate Test Metrics for the header
    await fetchTestMetrics(studentContext);
}