// Final, fully updated code for viewing scores. Fetches directly from the 'scores' collection.
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
    
    let assignmentsDataCache = null;

    const resetSelect = (selectEl, label) => {
        if (selectEl) {
            selectEl.innerHTML = `<option value="">-- ${label} --</option>`;
            selectEl.disabled = true;
        }
    };

    const initializePage = async () => {
        try {
            // Handle coordinator view (locked filters)
            if (coordinator && coordinator.department && coordinator.year) {
                if (deptSelect) {
                    deptSelect.innerHTML = `<option value="${coordinator.department}">${coordinator.department}</option>`;
                    deptSelect.value = coordinator.department;
                    deptSelect.disabled = true;
                }
                if (yearSelect) {
                    yearSelect.innerHTML = `<option value="${coordinator.year}">${coordinator.year}</option>`;
                    yearSelect.value = coordinator.year;
                    yearSelect.disabled = true;
                }
                await updateDependentFilters();
            } else {
                // Handle admin view (dynamic filters)
                const appDataRef = doc(db, 'metadata', 'appData');
                const appDataSnap = await getDoc(appDataRef);
                if (!appDataSnap.exists()) return console.error("appData document not found.");

                const metadata = appDataSnap.data();
                const populateSelect = (selectEl, options, label) => {
                    if (selectEl) {
                        selectEl.innerHTML = `<option value="">-- Choose ${label} --</option>`;
                        (options?.sort() || []).forEach(opt => selectEl.innerHTML += `<option value="${opt}">${opt}</option>`);
                    }
                };
                populateSelect(yearSelect, metadata.years, 'Year');
                populateSelect(deptSelect, metadata.departments, 'Department');
                resetSelect(sectionSelect, 'Select Dept & Year');
                resetSelect(subjectSelect, 'Select Dept & Year');
                resetSelect(testSelect, 'Select Subject');
            }

            if (tableBody) tableBody.innerHTML = '<tr><td colspan="7" class="text-center">Please select filters and click "Apply" to view scores.</td></tr>';
        } catch (error) {
            console.error("Failed to initialize page:", error);
        }
    };
    
    const updateDependentFilters = async () => {
        const selectedDept = deptSelect.value;
        const selectedYear = yearSelect.value;

        resetSelect(sectionSelect, 'Select Dept & Year');
        resetSelect(subjectSelect, 'Select Dept & Year');
        resetSelect(testSelect, 'Select Subject');

        if (!selectedDept || !selectedYear) return;

        try {
            const key = `${selectedDept}_${selectedYear}`;
            const assignmentRef = doc(db, 'assignments', key);
            const assignmentSnap = await getDoc(assignmentRef);
            
            if (assignmentSnap.exists()) {
                const assignmentInfo = assignmentSnap.data();
                if (!assignmentsDataCache) assignmentsDataCache = {};
                assignmentsDataCache[key] = assignmentInfo;

                sectionSelect.innerHTML = `<option value="">All Sections</option>`;
                (assignmentInfo.sections?.sort() || []).forEach(sec => sectionSelect.innerHTML += `<option value="${sec}">${sec}</option>`);
                sectionSelect.disabled = false;

                subjectSelect.innerHTML = `<option value="">All Subjects</option>`;
                (assignmentInfo.subjects?.sort() || []).forEach(sub => subjectSelect.innerHTML += `<option value="${sub}">${sub}</option>`);
                subjectSelect.disabled = false;
            } else {
                resetSelect(sectionSelect, 'No Sections Found');
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
            const assignmentKey = `${subject}_${year}`;
            let assignmentInfo = assignmentsDataCache ? assignmentsDataCache[assignmentKey] : null;
            if (!assignmentInfo) {
                const assignmentRef = doc(db, 'assignments', assignmentKey);
                const assignmentSnap = await getDoc(assignmentRef);
                if (assignmentSnap.exists()) {
                    assignmentInfo = assignmentSnap.data();
                }
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
            const isCoordinator = coordinator && coordinator.department;
            if (!isCoordinator) {
                yearSelect.value = "";
                deptSelect.value = "";
            }
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
            if (tableBody) tableBody.innerHTML = '<tr><td colspan="7" class="text-center">Please select a test to view scores.</td></tr>';
            return updateAnalysis([]);
        }
        try {
            if (tableBody) tableBody.innerHTML = '<tr><td colspan="7" class="text-center">Loading data...</td></tr>';
            
            let scoreQueryConstraints = [where('testId', '==', filters.testId)];
            if (filters.department) scoreQueryConstraints.push(where('department', '==', filters.department));
            if (filters.year) scoreQueryConstraints.push(where('year', '==', filters.year));
            if (filters.section) scoreQueryConstraints.push(where('section', '==', filters.section));

            const scoreQuery = query(collection(db, 'scores'), ...scoreQueryConstraints);
            const scoreSnapshot = await getDocs(scoreQuery);
            
            const scores = scoreSnapshot.docs.map(doc => ({ ...doc.data(), attended: doc.data().status === 'completed' }));
            
            let finalStudentList = [];
            if (filters.attendance === 'attended') {
                finalStudentList = scores.filter(s => s.attended);
            } else {
                finalStudentList = scores;
            }

            updateAnalysis(scores);

            if (tableBody) {
                tableBody.innerHTML = finalStudentList.length > 0
                    ? finalStudentList.map((s, index) => `
                        <tr>
                            <td>${index + 1}</td>
                            <td>${s.studentName || 'N/A'}</td>
                            <td class="email-cell">${s.email || 'N/A'}</td>
                            <td>${s.rollNo || 'N/A'}</td>
                            <td>${s.score ?? 'N/A'}</td>
                            <td>${s.rawScore ?? 'N/A'}</td>
                            <td>${s.totalMarks ?? 'N/A'}</td>
                        </tr>`).join('')
                    : '<tr><td colspan="7" class="text-center">No scores found for the selected criteria.</td></tr>';
            }
        } catch (error) {
            console.error("Error fetching scores: ", error);
            if (tableBody) tableBody.innerHTML = '<tr><td colspan="7" class="text-center">An error occurred while fetching data.</td></tr>';
        }
    };

    initializePage();
}