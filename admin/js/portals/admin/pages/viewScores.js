// File: /js/portals/admin/pages/viewScores.js
// --- CORRECTED: Uses 'completed' and 'not finished' statuses ---

import { db } from '../../../shared/firebase-config.js';
import { doc, getDoc, collection, query, where, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/9.10.0/firebase-firestore.js";

export function initViewScores() {
    const tableBody = document.getElementById('score-table-body');
    let distributionChart = null;
    let passFailChart = null;

    const yearSelect = document.getElementById('score-filter-year');
    const deptSelect = document.getElementById('score-filter-department');
    const sectionSelect = document.getElementById('score-filter-section');
    const subjectSelect = document.getElementById('score-filter-subject');
    const testSelect = document.getElementById('score-filter-testid');
    const attendanceSelect = document.getElementById('score-filter-attendance');
    
    let subjectMapCache = {}; 

    // --- (Helper functions are correct) ---
    const calculateYearOfStudy = (graduationYear) => {
        // ... (function remains the same)
        const gradYearNum = parseInt(graduationYear, 10);
        if (!gradYearNum || isNaN(gradYearNum)) return 'N/A';
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();
        const admissionYear = gradYearNum - 4;
        const currentAcademicYearStart = currentMonth < 5 ? currentYear - 1 : currentYear;
        const yearOfStudy = currentAcademicYearStart - admissionYear + 1;
        if (yearOfStudy > 4) return 'Alumni';
        if (yearOfStudy <= 0) return 'Upcoming';
        return yearOfStudy.toString();
    };
    const getGraduationYearFromStudyYear = (studyYear) => {
        // ... (function remains the same)
        const yearNum = parseInt(studyYear, 10);
        if (!yearNum || isNaN(yearNum) || yearNum <= 0 || yearNum > 4) {
            return null;
        }
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();
        const currentAcademicYearStart = currentMonth < 5 ? currentYear - 1 : currentYear;
        const gradYear = currentAcademicYearStart + (4 - yearNum) + 1;
        return gradYear;
    };
    // --- (End of helpers) ---

    const resetSelect = (selectEl, label) => {
        if (selectEl) {
            selectEl.innerHTML = `<option value="">-- ${label} --</option>`;
            selectEl.disabled = true;
        }
    };

    const initializePage = async () => {
        // ... (function remains the same, but check colspans)
        try {
            // ... (metadata fetching) ...
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
            
            const filterDataString = sessionStorage.getItem('viewScoresFilter');
            
            if (filterDataString) {
                // ... (pre-fill logic) ...
                // --- Colspan is 13 (to include Action column) ---
                if (tableBody) tableBody.innerHTML = '<tr><td colspan="13" class="text-center">Filters pre-filled. Select section and click "Apply".</td></tr>';
            } else {
                resetSelect(sectionSelect, 'Select Dept & Year');
                resetSelect(subjectSelect, 'Select Dept & Year');
                resetSelect(testSelect, 'Select Subject');
                // --- Colspan is 13 (to include Action column) ---
                if (tableBody) tableBody.innerHTML = '<tr><td colspan="13" class="text-center">Please select filters and click "Apply".</td></tr>';
            }
        } catch (error) {
            console.error("Failed to initialize page:", error);
        }
    };
    
    // --- (updateDependentFilters is correct) ---
    const updateDependentFilters = async () => {
        // ... (function remains the same)
        const selectedDept = deptSelect.value;
        const selectedStudyYear = yearSelect.value; // e.g., "3"

        resetSelect(sectionSelect, 'Select Dept & Year');
        resetSelect(subjectSelect, 'Select Dept & Year');
        resetSelect(testSelect, 'Select Subject');
        subjectMapCache = {}; // Clear cache

        if (!selectedDept || !selectedStudyYear) return;

        const graduationYear = getGraduationYearFromStudyYear(selectedStudyYear); // "2027"
        if (!graduationYear) return;
        
        const assignmentKey = `${selectedDept}_${graduationYear}`; // "ADS_2027"
        const subjectKey = `${selectedDept}_${selectedStudyYear}`;  // "ADS_3"

        try {
            const assignmentRef = doc(db, 'assignments', assignmentKey);
            const subjectRef = doc(db, 'subjects', subjectKey);
            
            const [assignmentSnap, subjectSnap] = await Promise.all([
                getDoc(assignmentRef),
                getDoc(subjectRef)
            ]);
            
            let subjectCodes = [];
            
            if (subjectSnap.exists()) {
                const subjectData = subjectSnap.data();
                subjectMapCache = subjectData.subjectMap || {};
                subjectCodes = subjectData.subjectCodes || [];
            }

            if (assignmentSnap.exists()) {
                const assignmentInfo = assignmentSnap.data();
                sectionSelect.innerHTML = `<option value="">All Sections</option>`;
                (assignmentInfo.sections?.sort() || []).forEach(sec => sectionSelect.innerHTML += `<option value="${sec}">${sec}</option>`);
                sectionSelect.disabled = false;
            } else {
                console.warn(`No document found in 'assignments' for key: ${assignmentKey}`);
                resetSelect(sectionSelect, 'No Sections Found');
            }
            
            if (subjectCodes.length > 0) {
                subjectSelect.innerHTML = `<option value="">All Subjects</option>`;
                subjectCodes.sort().forEach(code => {
                    const subjectName = subjectMapCache[code] || 'Unknown Subject';
                    subjectSelect.innerHTML += `<option value="${code}">${code} - ${subjectName}</option>`;
                });
                subjectSelect.disabled = false;
            } else {
                 resetSelect(subjectSelect, 'No Subjects Found');
            }

        } catch (error) {
            console.error("Error updating dependent filters:", error);
        }
    };
    
    // --- (populateTestIdFilter is correct) ---
    const populateTestIdFilter = async (subjectCode) => {
        // ... (function remains the same)
        const subject = subjectCode || subjectSelect.value;
        const dept = deptSelect.value;
        const year = yearSelect.value; // This is the study year (e.g., "3")

        resetSelect(testSelect, 'Select Subject First');
        if (!subject || !dept || !year) return;

        try {
            const testQuery = query(collection(db, 'tests'),
                where('subjectCodes', 'array-contains', subject)
            );

            const testSnapshot = await getDocs(testQuery);
            const filteredDocs = testSnapshot.docs.filter(doc => {
                const testData = doc.data();
                const hasDept = testData.departments?.includes(dept);
                const hasYear = testData.years?.includes(year);
                return hasDept && hasYear;
            });

            if (filteredDocs.length > 0) {
                testSelect.innerHTML = '<option value="">-- Choose a Test --</option>';
                filteredDocs.forEach(doc => {
                    const test = doc.data();
                    testSelect.innerHTML += `<option value="${doc.id}">${test.title}</option>`;
                });
                testSelect.disabled = false;
            } else {
                resetSelect(testSelect, 'No Tests Found');
            }
        } catch(error) {
            console.error("Error fetching tests for filter:", error);
            resetSelect(testSelect, 'Error Loading Tests');
        }
    };
    
    // --- (handleDeleteScore is correct) ---
    const handleDeleteScore = async (button) => {
        const scoreId = button.dataset.scoreId;
        if (!scoreId) return console.error("No score ID found on button.");
        
        if (!confirm("Are you sure you want to delete this score entry? This will permanently remove the student's attempt and mark them as 'Not Attended' for this test. This action cannot be undone.")) {
            return;
        }
        
        try {
            button.disabled = true;
            button.textContent = 'Deleting...';
            
            const scoreRef = doc(db, 'scores', scoreId);
            await deleteDoc(scoreRef);
            
            console.log("Score deleted successfully:", scoreId);
            
            // Refresh the table
            await renderScores(getScoreFilters());
            
        } catch (error) {
            console.error("Error deleting score:", error);
            alert("Failed to delete score: " + error.message);
            button.disabled = false;
            button.textContent = 'Delete';
        }
    };

    deptSelect?.addEventListener('change', updateDependentFilters);
    yearSelect?.addEventListener('change', updateDependentFilters);
    subjectSelect?.addEventListener('change', () => populateTestIdFilter());

    // --- (Main click listener is correct) ---
    document.getElementById('dynamic-content-area').addEventListener('click', (e) => {
        if (e.target.id === 'score-apply-btn') {
            renderScores(getScoreFilters());
        } else if (e.target.id === 'score-clear-btn') {
            [yearSelect, deptSelect, sectionSelect, subjectSelect, testSelect, attendanceSelect].forEach(sel => { if(sel) sel.value = ""; });
            // --- Colspan is 13 ---
            if(tableBody) tableBody.innerHTML = '<tr><td colspan="13" class="text-center">Please select a test to view scores.</td></tr>';
            updateAnalysis([]);
            
            resetSelect(sectionSelect, 'Select Dept & Year');
            resetSelect(subjectSelect, 'Select Dept & Year');
            resetSelect(testSelect, 'Select Subject');
            
        } else if (e.target.id === 'score-download-btn') {
            const table = document.getElementById('score-table');
            const wb = XLSX.utils.table_to_book(table, { sheet: "Scores" });
            XLSX.writeFile(wb, 'admin_student_scores.xlsx');
        
        } else if (e.target.classList.contains('score-delete-btn')) {
            handleDeleteScore(e.target);
        }
    });

    const updateAnalysis = (scores) => {
        const safeUpdateText = (id, value) => {
            const element = document.getElementById(id);
            if (element) element.textContent = value;
        };
        
        // --- CORRECTED: Use 'completed' status for analysis ---
        const attendedScores = scores.filter(s => s.attended && s.status === 'completed');
        
        safeUpdateText('total-students-val', scores.length);
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
        
        // ... (Rest of the analysis logic is correct) ...
        if (chartsWrapper) chartsWrapper.style.display = 'block';
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
                options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
            });
        }
        const pfCtx = document.getElementById('passFailChart')?.getContext('2d');
        if (pfCtx) {
            if (passFailChart) passFailChart.destroy();
            passFailChart = new Chart(pfCtx, {
                type: 'doughnut', data: { labels: ['Pass', 'Fail'], datasets: [{ data: [passCount, attendedScores.length - passCount], backgroundColor: ['#22c55e', '#ef4444'] }] },
                options: { responsive: true }
            });
        }
    };

    const getScoreFilters = () => ({
        year: yearSelect.value,
        department: deptSelect.value, 
        section: sectionSelect.value,
        subject: subjectSelect.value, 
        testId: testSelect.value, 
        attendance: attendanceSelect.value,
    });
    
    // --- THIS IS THE MAIN RENDER FUNCTION WITH ALL CORRECTIONS ---
    const renderScores = async (filters) => {
        if (!filters.testId) {
            // --- Colspan is 13 ---
            if (tableBody) tableBody.innerHTML = '<tr><td colspan="13" class="text-center">Please select a test to view scores.</td></tr>';
            return updateAnalysis([]);
        }
        try {
            // --- Colspan is 13 ---
            if (tableBody) tableBody.innerHTML = '<tr><td colspan="13" class="text-center">Loading data...</td></tr>';
            
            const testDocRef = doc(db, 'tests', filters.testId);
            const testDocSnap = await getDoc(testDocRef);
            if (!testDocSnap.exists()) {
                throw new Error("Selected test document could not be found.");
            }
            const testDetails = testDocSnap.data();
            const commonSubjectCode = filters.subject || testDetails.subjectCodes?.[0] || 'N/A';
            const commonTestName = testDetails.title || 'N/A';

            let studentQueryConstraints = [where('role', '==', 'student')];
            if (filters.department) studentQueryConstraints.push(where('department', '==', filters.department));
            if (filters.section) studentQueryConstraints.push(where('section', '==', filters.section));
            
            const studentQuery = query(collection(db, 'users'), ...studentQueryConstraints);
            const scoreQuery = query(collection(db, 'scores'), where('testId', '==', filters.testId));
            
            const [studentSnapshot, scoreSnapshot] = await Promise.all([getDocs(studentQuery), getDocs(scoreQuery)]);
            
            // --- Store scoreDocId along with score data ---
            const scoresMap = new Map(scoreSnapshot.docs.map(doc => [doc.data().userId, { ...doc.data(), scoreDocId: doc.id }]));
            
            let mergedStudentList = studentSnapshot.docs.map(doc => {
                const student = { ...doc.data(), id: doc.id };
                const scoreData = scoresMap.get(student.email);
                const calculatedStudyYear = calculateYearOfStudy(student.year);
                
                let studentData;
                if (scoreData) {
                    let finalScore = 'N/A';
                    const rawScore = parseFloat(scoreData.rawScore);
                    const totalMarks = parseFloat(scoreData.totalMarks);
                    // --- Use 'completed' status to calculate final score ---
                    if (scoreData.status === 'completed' && !isNaN(rawScore) && !isNaN(totalMarks) && totalMarks > 0) {
                        finalScore = ((rawScore / totalMarks) * 100).toFixed(2);
                    } else if (scoreData.status !== 'completed') {
                        finalScore = 'N/A'; // Score is N/A if not completed
                    }
                    
                    studentData = { ...student, ...scoreData, score: finalScore, attended: true, subjectCode: commonSubjectCode, testName: commonTestName };
                } else {
                    studentData = { ...student, score: 'Absent', attended: false, subjectCode: commonSubjectCode, testName: commonTestName, rawScore: 'N/A', totalMarks: 'N/A', status: 'Not Attended' };
                }
                return { ...studentData, year: calculatedStudyYear };
            });

            let yearFilteredList = mergedStudentList;
            if (filters.year) {
                yearFilteredList = mergedStudentList.filter(s => s.year === filters.year);
            }

            // --- ▼▼▼ THIS IS THE CORRECTED FILTER LOGIC ▼▼▼ ---
            let finalStudentList = [];
            if (filters.attendance === 'attended') {
                // 'attended' means score doc exists AND status is 'completed'
                // --- CORRECTED: Use 'completed' ---
                finalStudentList = yearFilteredList.filter(s => s.attended && s.status === 'completed');
            
            } else if (filters.attendance === 'not_finished') {
                // 'not_finished' means score doc exists AND status is 'not finished'
                // --- CORRECTED: Use 'not finished' ---
                finalStudentList = yearFilteredList.filter(s => s.attended && s.status === 'not finished');
            
            } else if (filters.attendance === 'not_attended') {
                // 'not_attended' means no score doc exists (s.attended is false)
                finalStudentList = yearFilteredList.filter(s => !s.attended);
            
            } else {
                // 'all'
                finalStudentList = yearFilteredList;
            }
            // --- ▲▲▲ END OF CORRECTED FILTER LOGIC ▲▲▲ ---
            
            updateAnalysis(finalStudentList);
            
            if (tableBody) {
                // --- Colspan is 13 ---
                tableBody.innerHTML = finalStudentList.length > 0
                    ? finalStudentList.map((s, index) => `
                        <tr>
                          <td>${index + 1}</td>
                          <td>${s.name || 'N/A'}</td>
                          <td>${s.rollNo || 'N/A'}</td>
                          <td>${s.year || 'N/A'}</td>
                          <td>${s.department || 'N/A'}</td>
                          <td>${s.section || 'N/A'}</td>
                          <td>${s.subjectCode}</td>
                          <td>${s.testName}</td>
                          <td>${s.score }</td>
                          <td>${s.rawScore ?? 'N/A'}</td>
                          <td>${s.totalMarks ?? 'N/A'}</td>
                          <td>${s.status || 'Not Attended'}</td>
                          
                          <td>
                            ${(s.status === 'not finished' && s.scoreDocId)
                              // This button ONLY appears if status is EXACTLY 'not finished'
                              ? `<button class="score-delete-btn" data-score-id="${s.scoreDocId}" title="Delete this '${s.status}' score entry">Delete</button>`
                              : ''}
                          </td>
                          </tr>`).join('')
                    : '<tr><td colspan="13" class="text-center">No students found for the selected criteria.</td></tr>';
            }
        } catch (error) {
            console.error("Error fetching scores: ", error);
            // --- Colspan is 13 ---
            if (tableBody) tableBody.innerHTML = `<tr><td colspan="13" class="text-center">An error occurred: ${error.message}</td></tr>`;
        }
    };

    initializePage();
}