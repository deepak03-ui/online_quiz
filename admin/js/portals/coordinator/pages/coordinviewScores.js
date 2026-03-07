// Final, fully updated code for viewing scores.
// --- FIX: Now reads sections and subjects from 'metadata/appData' ---
import { db } from '../../../shared/firebase-config.js';
import { doc, getDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/9.10.0/firebase-firestore.js";

export function initViewScores(coordinator) { // Accepts coordinator object for locked-down view
    const tableBody = document.getElementById('score-table-body');
    let distributionChart = null;
    let passFailChart = null;

    const yearSelect = document.getElementById('score-filter-year');
    const deptSelect = document.getElementById('score-filter-department');
    const sectionSelect = document.getElementById('score-filter-section');
    const subjectSelect = document.getElementById('score-filter-subject');
    const testSelect = document.getElementById('score-filter-testid');
    const attendanceSelect = document.getElementById('score-filter-attendance');
    
    // --- UPDATED: Renamed cache to be more accurate ---
    let metadataCache = null;

    const resetSelect = (selectEl, label) => {
        if (selectEl) {
            selectEl.innerHTML = `<option value="">-- ${label} --</option>`;
            selectEl.disabled = true;
        }
    };

    const initializePage = async () => {
        try {
            // Helper for coordinator view with multiple options
            const populateCoordinatorSelect = (selectEl, options, label) => {
                if (selectEl) {
                    selectEl.innerHTML = `<option value="">-- Choose ${label} --</option>`;
                    (options?.sort() || []).forEach(opt => selectEl.innerHTML += `<option value="${opt}">${opt}</option>`);
                    selectEl.disabled = false; // Make sure it's enabled
                }
            };

            let isDeptHandled = false;
            let isYearHandled = false;
            let isDeptLocked = false;
            let isYearLocked = false;

            if (coordinator) {
                // --- Department ---
                if (deptSelect && coordinator.department) {
                    isDeptHandled = true;
                    if (Array.isArray(coordinator.department)) {
                        if (coordinator.department.length === 1) {
                            // Lock for single-item array
                            const dept = coordinator.department[0];
                            deptSelect.innerHTML = `<option value="${dept}">${dept}</option>`;
                            deptSelect.value = dept;
                            deptSelect.disabled = true;
                            isDeptLocked = true;
                        } else if (coordinator.department.length > 1) {
                            // Populate for multi-item array
                            populateCoordinatorSelect(deptSelect, coordinator.department, 'Department');
                        }
                    } else { // It's a string
                        // Lock for string
                        deptSelect.innerHTML = `<option value="${coordinator.department}">${coordinator.department}</option>`;
                        deptSelect.value = coordinator.department;
                        deptSelect.disabled = true;
                        isDeptLocked = true;
                    }
                }

                // --- Year ---
                if (yearSelect && coordinator.year) {
                    isYearHandled = true;
                    if (Array.isArray(coordinator.year)) {
                        if (coordinator.year.length === 1) {
                            // Lock for single-item array
                            const year = coordinator.year[0];
                            yearSelect.innerHTML = `<option value="${year}">${year}</option>`;
                            yearSelect.value = year;
                            yearSelect.disabled = true;
                            isYearLocked = true;
                        } else if (coordinator.year.length > 1) {
                            // Populate for multi-item array
                            populateCoordinatorSelect(yearSelect, coordinator.year, 'Year');
                        }
                    } else { // It's a string
                        // Lock for string
                        yearSelect.innerHTML = `<option value="${coordinator.year}">${coordinator.year}</option>`;
                        yearSelect.value = coordinator.year;
                        yearSelect.disabled = true;
                        isYearLocked = true;
                    }
                }
            }

            // --- Admin Fallback ---
            if (!isDeptHandled || !isYearHandled) {
                // --- UPDATED: Use metadataCache ---
                if (!metadataCache) {
                    const appDataRef = doc(db, 'metadata', 'appData');
                    const appDataSnap = await getDoc(appDataRef);
                    if (!appDataSnap.exists()) return console.error("appData document not found.");
                    metadataCache = appDataSnap.data();
                }
                
                const populateAdminSelect = (selectEl, options, label) => {
                    if (selectEl) {
                        selectEl.innerHTML = `<option value="">-- Choose ${label} --</option>`;
                        (options?.sort() || []).forEach(opt => selectEl.innerHTML += `<option value="${opt}">${opt}</option>`);
                        selectEl.disabled = false;
                    }
                };
                
                if (!isYearHandled) populateAdminSelect(yearSelect, metadataCache.years, 'Year');
                if (!isDeptHandled) populateAdminSelect(deptSelect, metadataCache.departments, 'Department');
            }
            
            // --- Final Setup ---
            if (isDeptLocked && isYearLocked) {
                await updateDependentFilters();
            } else {
                resetSelect(sectionSelect, 'Select Dept & Year');
                resetSelect(subjectSelect, 'Select Dept & Year');
                resetSelect(testSelect, 'Select Subject');
            }

            if (tableBody) tableBody.innerHTML = '<tr><td colspan="7" class="text-center">Please select filters and click "Apply" to view scores.</td></tr>';
        
        } catch (error) {
            console.error("Failed to initialize page:", error);
        }
    };
    
    // --- **** THIS FUNCTION IS FULLY UPDATED **** ---
    const updateDependentFilters = async () => {
        const selectedDept = deptSelect.value;
        const selectedYear = yearSelect.value;

        resetSelect(sectionSelect, 'Select Dept & Year');
        resetSelect(subjectSelect, 'Select Dept & Year');
        resetSelect(testSelect, 'Select Subject');

        if (!selectedDept || !selectedYear) return;

        try {
            // 1. Load metadata if not already cached
            if (!metadataCache) {
                const appDataRef = doc(db, 'metadata', 'appData');
                const appDataSnap = await getDoc(appDataRef);
                if (appDataSnap.exists()) {
                    metadataCache = appDataSnap.data();
                } else {
                    console.error("appData document not found.");
                    resetSelect(sectionSelect, 'Metadata Error');
                    resetSelect(subjectSelect, 'Metadata Error');
                    return;
                }
            }

            const key = `${selectedDept}_${selectedYear}`;
            const appData = metadataCache;

            // 2. Populate Sections from metadataCache["ADS_1"].sections
            if (appData[key] && appData[key].sections) {
                sectionSelect.innerHTML = `<option value="">All Sections</option>`;
                (appData[key].sections.sort() || []).forEach(sec => sectionSelect.innerHTML += `<option value="${sec}">${sec}</option>`);
                sectionSelect.disabled = false;
            } else {
                resetSelect(sectionSelect, 'No Sections Found');
            }

            // 3. Populate Subjects from metadataCache.all_subjects
            if (appData.all_subjects) {
                subjectSelect.innerHTML = `<option value="">All Subjects</option>`;
                (appData.all_subjects.sort() || []).forEach(sub => subjectSelect.innerHTML += `<option value="${sub}">${sub}</option>`);
                subjectSelect.disabled = false;
            } else {
                resetSelect(subjectSelect, 'No Subjects Found');
            }
        } catch (error) {
            console.error("Error updating dependent filters:", error);
        }
    };

    const populateTestIdFilter = async () => {
        const subject = subjectSelect.value;
        const dept = deptSelect.value;
        const year = yearSelect.value;

        resetSelect(testSelect, 'Select Subject First');
        if (!subject || !dept || !year) return;

        try {
            // This part is likely correct, as it queries a different document key
            // This relies on `coordinmanageTests.js` writing to `assignments/{subject}_{year}`
            const assignmentKey = `${subject}_${year}`;
            const assignmentRef = doc(db, 'assignments', assignmentKey);
            const assignmentSnap = await getDoc(assignmentRef);
           
            let assignmentInfo = null;
            if (assignmentSnap.exists()) {
                assignmentInfo = assignmentSnap.data();
            }

            if (assignmentInfo && assignmentInfo.testIds) {
                const testIds = assignmentInfo.testIds || [];
                if (testIds.length > 0) {
                    const testQuery = query(collection(db, 'tests'), where('__name__', 'in', testIds));
                    const testSnapshot = await getDocs(testQuery);
                    testSelect.innerHTML = '<option value="">-- Choose a Test --</option>';
                    testSnapshot.docs.forEach(doc => {
                        const test = doc.data();
                        testSelect.innerHTML += `<option value="${doc.id}">${test.title}</option>`;
                    });
                    testSelect.disabled = false;
                } else {
                    resetSelect(testSelect, 'No Tests Found');
                }
            } else {
                resetSelect(testSelect, 'No Tests Found');
            }
        } catch(error) {
            console.error("Error fetching tests for filter:", error);
            resetSelect(testSelect, 'Error Loading Tests');
        }
    };
    
    deptSelect?.addEventListener('change', updateDependentFilters);
    yearSelect?.addEventListener('change', updateDependentFilters);
    subjectSelect?.addEventListener('change', populateTestIdFilter);

    document.getElementById('dynamic-content-area').addEventListener('click', (e) => {
        if (e.target.id === 'score-apply-btn') {
            renderScores(getScoreFilters());
        } else if (e.target.id === 'score-clear-btn') {
            // Respect locked filters for coordinators
            const isCoordinator = coordinator && (coordinator.department || coordinator.year);
            
            const isYearLocked = coordinator && (typeof coordinator.year === 'string' || (Array.isArray(coordinator.year) && coordinator.year.length === 1));
            const isDeptLocked = coordinator && (typeof coordinator.department === 'string' || (Array.isArray(coordinator.department) && coordinator.department.length === 1));

            if (!isYearLocked) yearSelect.value = "";
            if (!isDeptLocked) deptSelect.value = "";

            sectionSelect.value = "";
            subjectSelect.value = "";
            testSelect.value = "";
            attendanceSelect.value = "";
            if(tableBody) tableBody.innerHTML = '<tr><td colspan="7" class="text-center">Please select a test to view scores.</td></tr>';
            updateAnalysis([]);
        } else if (e.target.id === 'score-download-btn') {
            const table = document.getElementById('score-table');
            if (table) {
                const wb = XLSX.utils.table_to_book(table, { sheet: "Scores" });
                XLSX.writeFile(wb, 'student_scores.xlsx');
            }
        }
    });

    const updateAnalysis = (scores) => {
        const safeUpdateText = (id, value) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
            }
        };
        const attendedScores = scores.filter(s => s.attended);
        safeUpdateText('total-students-val', scores.length);
        safeUpdateText('attended-students-val', attendedScores.length);
        const chartsWrapper = document.getElementById('charts-wrapper');

        if (attendedScores.length === 0) {
            safeUpdateText('average-score-val', 'N/A');
            safeUpdateText('highest-score-val', 'N/A');
            safeUpdateText('pass-rate-val', 'N/A');
            if (chartsWrapper) chartsWrapper.style.display = 'none';
            if (distributionChart) distributionChart.destroy();
            if (passFailChart) passFailChart.destroy();
            return;
        }
        if (chartsWrapper) chartsWrapper.style.display = 'flex';
        const numericScores = attendedScores.map(s => parseFloat(s.score) || 0);
        const totalScore = numericScores.reduce((sum, score) => sum + score, 0);
        const passCount = attendedScores.filter(s => (parseFloat(s.score) || 0) >= 50).length;
        safeUpdateText('average-score-val', (totalScore / attendedScores.length).toFixed(2));
        safeUpdateText('highest-score-val', Math.max(...numericScores).toFixed(2));
        safeUpdateText('pass-rate-val', `${((passCount / attendedScores.length) * 100).toFixed(1)}%`);
        const distribution = { '0-24': 0, '25-49': 0, '50-74': 0, '75-100': 0 };
        numericScores.forEach(score => {
            if (score <= 24) distribution['0-24']++;
            else if (score <= 49) distribution['25-49']++;
            else if (score <= 74) distribution['50-74']++;
            else distribution['75-100']++;
        });
        const distCtx = document.getElementById('distributionChart')?.getContext('2d');
        if (distCtx) {
            if (distributionChart) distributionChart.destroy();
            distributionChart = new Chart(distCtx, {
                type: 'bar', data: { labels: Object.keys(distribution), datasets: [{ label: '# of Students', data: Object.values(distribution), backgroundColor: ['#ef4444', '#f97316', '#84cc16', '#22c55e'] }] },
                options: { responsive: true, plugins: { legend: { display: false }, title: { display: true, text: 'Score Distribution' } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
            });
        }
        const pfCtx = document.getElementById('passFailChart')?.getContext('2d');
        if (pfCtx) {
            if (passFailChart) passFailChart.destroy();
            passFailChart = new Chart(pfCtx, {
                type: 'doughnut', data: { labels: ['Pass', 'Fail'], datasets: [{ data: [passCount, attendedScores.length - passCount], backgroundColor: ['#22c55e', '#ef4444'] }] },
                options: { responsive: true, plugins: { title: { display: true, text: 'Pass/Fail Rate' } } }
            });
        }
    };

    const getScoreFilters = () => ({
        year: yearSelect.value, department: deptSelect.value, section: sectionSelect.value,
        subject: subjectSelect.value, testId: testSelect.value, attendance: attendanceSelect.value,
    });
    
    const renderScores = async (filters) => {
        if (!filters.testId) {
            if (tableBody) tableBody.innerHTML = '<tr><td colspan="12" class="text-center">Please select a test to view scores.</td></tr>';
            return updateAnalysis([]);
        }
        try {
            if (tableBody) tableBody.innerHTML = '<tr><td colspan="12" class="text-center">Loading data...</td></tr>';
            
            const testDocRef = doc(db, 'tests', filters.testId);
            const testDocSnap = await getDoc(testDocRef);
            if (!testDocSnap.exists()) {
                throw new Error("Selected test document could not be found.");
            }
            const testDetails = testDocSnap.data();
            const commonSubjectCode = testDetails.subjectCodes?.[0] || 'N/A';
            const commonTestName = testDetails.title || 'N/A';

            let studentQueryConstraints = [where('role', '==', 'student')];
            // --- UPDATED: 'year' is now an 'array-contains' query ---
            if (filters.year) studentQueryConstraints.push(where('year', 'array-contains', filters.year));
            if (filters.department) studentQueryConstraints.push(where('department', '==', filters.department));
            if (filters.section) studentQueryConstraints.push(where('section', '==', filters.section));
            
            const studentQuery = query(collection(db, 'users'), ...studentQueryConstraints);
            const scoreQuery = query(collection(db, 'scores'), where('testId', '==', filters.testId));
            
            const [studentSnapshot, scoreSnapshot] = await Promise.all([getDocs(studentQuery), getDocs(scoreQuery)]);
            const scoresMap = new Map(scoreSnapshot.docs.map(doc => [doc.data().userId, doc.data()]));
            
            let mergedStudentList = studentSnapshot.docs.map(doc => {
                const student = { ...doc.data(), id: doc.id };
                const scoreData = scoresMap.get(student.email);
                
                if (scoreData) {
                    let finalScore = 'N/A';
                    const rawScore = parseFloat(scoreData.rawScore);
                    const totalMarks = parseFloat(scoreData.totalMarks);
                    if (!isNaN(rawScore) && !isNaN(totalMarks) && totalMarks > 0) finalScore = ((rawScore / totalMarks) * 100).toFixed(2);
                    return { ...student, ...scoreData, score: finalScore, attended: true, subjectCode: commonSubjectCode, testName: commonTestName };
                } else {
                    return { ...student, score: 'Absent', attended: false, subjectCode: commonSubjectCode, testName: commonTestName, rawScore: 'N/A', totalMarks: 'N/A', status: 'Not Attended' };
                }
            });
            
            let finalStudentList = [];
            if (filters.attendance === 'attended') finalStudentList = mergedStudentList.filter(s => s.attended);
            else if (filters.attendance === 'not_attended') finalStudentList = mergedStudentList.filter(s => !s.attended);
            else finalStudentList = mergedStudentList;
            
            updateAnalysis(finalStudentList);

            if (tableBody) {
                tableBody.innerHTML = finalStudentList.length > 0
                    ? finalStudentList.map((s, index) => `
                        <tr>
                            <td>${index + 1}</td>
                            <td>${s.name || 'N/A'}</td>
                            <td>${s.rollNo || 'N/A'}</td>
                            <td>${Array.isArray(s.year) ? s.year.join(', ') : (s.year || 'N/A')}</td>
                            <td>${s.department || 'N/A'}</td>
                            <td>${s.section || 'N/A'}</td>
                            <td>${s.subjectCode}</td>
                            <td>${s.testName}</td>
                            <td>${s.score}</td>
                            <td>${s.rawScore ?? 'N/A'}</td>
                            <td>${s.totalMarks ?? 'N/A'}</td>
                            <td>${s.status || 'Not Attended'}</td>
                        </tr>`).join('')
                    : '<tr><td colspan="12" class="text-center">No students found for the selected criteria.</td></tr>';
            }
        } catch (error) {
            console.error("Error fetching scores: ", error);
             if (tableBody && error.code === 'failed-precondition') {
                 tableBody.innerHTML = '<tr><td colspan="12" style="text-align:center; color: red;"><b>Query Error:</b> A database index is required. Please check the browser console for a link to create it.</td></tr>';
            } else {
                if (tableBody) tableBody.innerHTML = `<tr><td colspan="12" class="text-center">An error occurred: ${error.message}</td></tr>`;
            }
        }
    };

    initializePage();
}