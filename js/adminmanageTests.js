// File: /js/portals/admin/pages/adminmanageTests.js
// --- FIXED: 'subjectData is not defined' ReferenceError ---
// --- FIXED: Uses 'subjects' doc for subject codes, not 'assignments' ---

import { db } from '../../../shared/firebase-config.js';
import { getDocs, collection, query, where, doc, setDoc, writeBatch, serverTimestamp, arrayUnion, getDoc } from "https://www.gstatic.com/firebasejs/9.10.0/firebase-firestore.js";

export function initManageTests(admin) {
    const contentArea = document.getElementById('dynamic-content-area');
    const departmentSelect = document.getElementById('test-department');
    const yearSelect = document.getElementById('test-year');
    const subjectSelect = document.getElementById('test-subject-code');
    
    const sectionContainer = document.getElementById('section-multiselect-container');
    const sectionTrigger = sectionContainer?.querySelector('.custom-multiselect-trigger');
    const sectionPanel = sectionContainer?.querySelector('.custom-multiselect-panel');
    let selectedSections = [];

    // --- HELPER: Converts Study Year (e.g., "3") to Graduation Year (e.g., "2027") ---
    const getGraduationYearFromStudyYear = (studyYear) => {
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


    // --- (All multiselect functions... remain the same) ---
    if (sectionTrigger) {
        sectionTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            if (sectionContainer.style.pointerEvents === 'none') return;
            sectionContainer.classList.toggle('open');
        });
    }
    document.addEventListener('click', (e) => {
        if (sectionContainer && !sectionContainer.contains(e.target)) {
            sectionContainer.classList.remove('open');
        }
    });
    if (sectionPanel) {
        sectionPanel.addEventListener('change', (e) => {
            if (e.target.type === 'checkbox') {
                const checkboxes = sectionPanel.querySelectorAll('input[type="checkbox"]');
                const allCheckbox = checkboxes[0];
                if (e.target === allCheckbox) {
                    checkboxes.forEach(cb => cb.checked = allCheckbox.checked);
                } else {
                    if (!e.target.checked) allCheckbox.checked = false;
                    else {
                        const individualCheckboxes = Array.from(checkboxes).slice(1);
                        if (individualCheckboxes.every(cb => cb.checked)) allCheckbox.checked = true;
                    }
                }
                updateSectionDisplay();
            }
        });
    }
    function updateSectionDisplay() {
        if (!sectionPanel || !sectionTrigger) return;
        const checkboxes = Array.from(sectionPanel.querySelectorAll('input[type="checkbox"]'));
        const allCheckbox = checkboxes[0];
        selectedSections = checkboxes.slice(1).filter(cb => cb.checked).map(cb => cb.value);
        if (selectedSections.length === 0) sectionTrigger.textContent = '-- Select Sections --';
        else if (allCheckbox.checked || selectedSections.length === checkboxes.length - 1) sectionTrigger.textContent = 'All Sections';
        else if (selectedSections.length === 1) sectionTrigger.textContent = selectedSections[0];
        else sectionTrigger.textContent = `${selectedSections.length} sections selected`;
    }
    function getSelectedSections() { return selectedSections; }
    const resetSelect = (selectEl, label) => {
        if (selectEl) {
            selectEl.innerHTML = `<option value="">-- ${label} --</option>`;
            selectEl.disabled = true;
        }
    };
    function resetSectionMultiselect(label) {
        if (!sectionContainer || !sectionTrigger || !sectionPanel) return;
        sectionContainer.style.pointerEvents = 'none';
        sectionContainer.style.opacity = '0.5';
        sectionContainer.classList.remove('open');
        sectionTrigger.textContent = label;
        sectionPanel.innerHTML = '';
        selectedSections = [];
    }
    function enableSectionMultiselect(sections) {
        if (!sectionContainer || !sectionTrigger || !sectionPanel) return;
        sectionContainer.style.pointerEvents = '';
        sectionContainer.style.opacity = '1';
        sectionPanel.innerHTML = '';
        const allOption = document.createElement('div');
        allOption.className = 'custom-multiselect-option';
        allOption.innerHTML = `<input type="checkbox" id="section-all" value="ALL"> <span>All Sections</span>`;
        sectionPanel.appendChild(allOption);
        sections.sort().forEach(sec => {
            const option = document.createElement('div');
            option.className = 'custom-multiselect-option';
            option.innerHTML = `<input type="checkbox" id="section-${sec}" value="${sec}"> <span>${sec}</span>`;
            sectionPanel.appendChild(option);
        });
        sectionTrigger.textContent = '-- Select Sections --';
        selectedSections = [];
    }
    // --- (End of multiselect functions) ---


    async function initializeFilters() {
        // ... (this function is correct, no changes needed) ...
        try {
            const appDataRef = doc(db, 'metadata', 'appData');
            const appDataSnap = await getDoc(appDataRef);
            if (!appDataSnap.exists()) return console.error("appData metadata document not found.");
            const metadata = appDataSnap.data();
            
            const populateSelect = (selectEl, options, label) => {
                if (selectEl) {
                    selectEl.innerHTML = `<option value="">-- Choose ${label} --</option>`;
                    (options?.sort() || []).forEach(opt => selectEl.innerHTML += `<option value="${opt}">${opt}</option>`);
                    selectEl.disabled = false;
                }
            };
            
            populateSelect(departmentSelect, metadata.departments, 'Department');
            populateSelect(yearSelect, metadata.years, 'Year'); // Populates "1", "2", "3"
            resetSectionMultiselect('-- Select Dept & Year First --');
            resetSelect(subjectSelect, 'Select Dept & Year');
        } catch (error) {
            console.error("Failed to initialize filters from metadata:", error);
        }
    }

    // --- MODIFIED: Fixed the 'subjectData is not defined' error ---
    async function updateDependentFilters() {
        const selectedDept = departmentSelect.value;
        const selectedStudyYear = yearSelect.value; // This is "3"
        
        resetSectionMultiselect('-- Select Dept & Year --');
        resetSelect(subjectSelect, 'Select Dept & Year');
        
        if (!selectedDept || !selectedStudyYear) return;

        // --- DYNAMIC KEYS ---
        const graduationYear = getGraduationYearFromStudyYear(selectedStudyYear); // "2027"
        if (!graduationYear) return;
        
        const assignmentKey = `${selectedDept}_${graduationYear}`; // "ADS_2027"
        const subjectKey = `${selectedDept}_${selectedStudyYear}`;  // "ADS_3"

        try {
            // 1. Fetch from two locations
            const assignmentRef = doc(db, 'assignments', assignmentKey);
            const subjectRef = doc(db, 'subjects', subjectKey);
            
            const [assignmentSnap, subjectSnap] = await Promise.all([
                getDoc(assignmentRef),
                getDoc(subjectRef)
            ]);

            // --- THIS IS THE FIX ---
            // 2. Get the master list of names and codes from 'subjects' doc
            let subjectMap = {};
            let subjectCodes = [];

            if (subjectSnap.exists()) {
                // Define 'subjectData' *here* by calling .data()
                const subjectData = subjectSnap.data(); 
                subjectMap = subjectData.subjectMap || {};
                subjectCodes = subjectData.subjectCodes || []; // Get codes from here
            }
            // --- END OF FIX ---


            if (assignmentSnap.exists()) {
                const metaInfo = assignmentSnap.data();
                
                // 3. Populate Sections
                if (metaInfo.sections && metaInfo.sections.length > 0) {
                    enableSectionMultiselect(metaInfo.sections);
                } else {
                    resetSectionMultiselect('No Sections Found');
                }
                
                // 4. Populate Subjects with names
                // Now use the 'subjectCodes' variable defined above
                if (subjectCodes.length > 0) {
                    
                    // Start with the default option
                    let optionsHTML = `<option value="">-- Choose Subject --</option>`;
                    
                    // Create an array of all the <option> strings
                    const optionList = (subjectCodes.sort() || []).map(subjectCode => {
                        const subjectName = subjectMap[subjectCode] || 'Unknown Subject';
                        return `<option value="${subjectCode}">${subjectCode} - ${subjectName}</option>`;
                    });
                    
                    // Join the array into one big string
                    optionsHTML += optionList.join('');
                    
                    // Set innerHTML only ONCE
                    subjectSelect.innerHTML = optionsHTML;
                    subjectSelect.disabled = false;
                } else {
                    // Make sure to handle the case where no codes are found
                    resetSelect(subjectSelect, 'No Subjects Found');
                }

            } else {
                console.log(`No metadata found in 'assignments' for key: ${assignmentKey}`);
                resetSectionMultiselect('No Sections Found');
                resetSelect(subjectSelect, 'No Subjects Found');
            }
        } catch (error) {
            // This is where your error was caught (around line 204)
            console.error("Error updating dependent filters:", error);
        }
    }

    // --- (All event listeners and create-test logic... remain the same) ---
    contentArea.addEventListener('change', (e) => {
        const target = e.target;
        if (target.id === 'test-department' || target.id === 'test-year') {
            updateDependentFilters();
        }
        if (target.id === 'test-type-select') {
            const selectedType = target.value;
            const subtypeContainer = document.getElementById('test-subtype-container');
            const subtypeSelect = document.getElementById('test-subtype-select');
            const subTypeOptions = {
                monthly: ['Unit 1', 'Unit 2', 'Unit 3', 'Unit 4', 'Unit 5'],
                tsp: ['Compiler Test', 'Aptitude Test', 'Technical Skills Test'],
                internal: ['Internal 1', 'Internal 2', 'Internal 3']
            };
            if (selectedType && subTypeOptions[selectedType]) {
                subtypeSelect.innerHTML = subTypeOptions[selectedType].map(opt => `<option value="${opt}">${opt}</option>`).join('');
                subtypeContainer.classList.remove('hidden-section');
            } else {
                subtypeContainer.classList.add('hidden-section');
            }
        }
        if (target.classList.contains('qt-checkbox')) {
            const type = target.value;
            const section = document.getElementById(`${type}-upload-section`);
            if (section) {
                document.querySelectorAll('.qt-checkbox').forEach(box => {
                    if (box !== target) box.checked = false;
                });
                document.querySelectorAll('.q-upload-section').forEach(s => {
                    if (s !== section) s.classList.add('hidden-section');
                });
                section.classList.toggle('hidden-section', !target.checked);
                document.querySelectorAll('#upload-sections-container input[type="file"]').forEach(input => input.disabled = true);
                if (target.checked) {
                    section.querySelector('input[type="file"]').disabled = false;
                }
            }
        }
    });

    contentArea.addEventListener('click', async (e) => {
        const target = e.target;
        if (target.classList.contains('download-template-btn')) {
            const headers = [['questionNumber', 'text', 'question', 'marks', 'answerkey', 'option1', 'option2', 'option3', 'option4', 'type', 'order']];
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.aoa_to_sheet(headers);
            XLSX.utils.book_append_sheet(wb, ws, 'Template');
            XLSX.writeFile(wb, `MCQ_questions_template.xlsx`);
        }

        if (target.id === 'create-test-btn') {
            const fileInput = document.querySelector('#upload-sections-container input[type="file"]:not(:disabled)');
            if (!fileInput || fileInput.files.length === 0) {
                return alert('Error: Please select a question type and upload a file.');
            }
            
            const title = document.getElementById('test-name').value.trim();
            const testType = document.getElementById('test-type-select').value;
            const subType = document.getElementById('test-subtype-select').value;
            const deptValue = departmentSelect.value;
            const yearValue = yearSelect.value; // This is Study Year (e.g., "3")
            const subjectValue = subjectSelect.value;
            const questionsToAttend = parseInt(document.getElementById('questions-to-attend').value, 10);
            const timePerQuestionInMinutes = parseInt(document.getElementById('time-per-question').value, 10);
            const isProctoredValue = document.getElementById('test-is-proctored').value;

            if (!title || !testType || !subType || !deptValue || !yearValue || !subjectValue || isNaN(questionsToAttend) || isNaN(timePerQuestionInMinutes) || isProctoredValue === "") {
                return alert('Error: Please fill out all required test details, including proctoring status.');
            }

            const sectionValues = getSelectedSections();
            if (sectionValues.length === 0) {
                return alert('Error: Please select at least one section.');
            }

            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    const data = new Uint8Array(event.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const sheetName = workbook.SheetNames[0];
                    const excelData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
                    if (excelData.length === 0) return alert("The uploaded file is empty.");
                    
                    let totalMarks = 0;
                    const transformedQuestions = excelData.map(row => {
    const marks = parseInt(row.marks, 10) || 0;
    totalMarks += marks;

    const currentType = String(row.type || fileInput.dataset.type || '').toLowerCase().trim();

    const questionData = {
        text: String(row.question || row.text || '').trim(),
        marks: marks,
        type: currentType,
        order: parseInt(row.order || row.questionNumber, 10),
        questionNumber: parseInt(row.order || row.questionNumber, 10)
    };

    if (currentType === 'mcq') {
        questionData.answerKey = String(row.answerkey || row.correctAnswer || '')
            .toLowerCase()
            .trim();

        const options = [row.option1, row.option2, row.option3, row.option4]
            .filter(opt => opt != null && String(opt).trim() !== '')
            .map(opt => String(opt).trim());

        if (options.length > 0) {
            questionData.options = options;
        }
    } else if (currentType === 'tf') {
        questionData.answerKey = String(row.correctAnswer || row.answerkey || '')
            .toLowerCase()
            .trim();

        questionData.options = ["True", "False"];
    } else {
        questionData.answerKey = String(row.answerkey || row.correctAnswer || '')
            .toLowerCase()
            .trim();

        const options = [row.option1, row.option2, row.option3, row.option4]
            .filter(opt => opt != null && String(opt).trim() !== '')
            .map(opt => String(opt).trim());

        if (options.length > 0) {
            questionData.options = options;
        }
    }

    return questionData;
});
const validQuestions = transformedQuestions.filter(q => 
    q.text &&
    q.answerKey &&
    Array.isArray(q.options) &&
    q.options.length > 0
);


                    const testDocData = {
                        title,
                        type: testType,
                        subType,
                        questionCount: validQuestions.length,
                        totalMarks,
                        start: new Date(document.getElementById('start-date').value),
                        end: new Date(document.getElementById('end-date').value),
                        questionsToAttend,
                        timePerQuestion: timePerQuestionInMinutes,
                        totalDurationInSeconds: questionsToAttend * timePerQuestionInMinutes,
                        departments: [deptValue],
                        years: [yearValue], // Saves the Study Year (e.g., "3"), which is correct
                        sections: sectionValues,
                        subjectCodes: [subjectValue],
                        isProctored: isProctoredValue === 'true',
                        allowRetake: false,
                        createdAt: serverTimestamp(),
                        createdBy: admin?.email || admin?.info?.email || 'unknown'
                    };

                    const batch = writeBatch(db);
                    
                    const newTestRef = doc(db, 'tests', title);
                    batch.set(newTestRef, testDocData);

                    validQuestions.forEach(q => {
                        const questionDocRef = doc(collection(newTestRef, 'questions'), String(q.order));
                        batch.set(questionDocRef, q);
                    });
                    
                    const graduationYear = getGraduationYearFromStudyYear(yearValue);
                    if (!graduationYear) {
                         throw new Error("Could not calculate graduation year.");
                    }
                    
                    const assignmentDocId = `${deptValue}_${graduationYear}`; // e.g., "ADS_2027"
                    const assignmentRef = doc(db, 'assignments', assignmentDocId);

                    batch.set(assignmentRef, {
                        testIds: arrayUnion(title),
                        subjects: arrayUnion(subjectValue),
                        sections: arrayUnion(...sectionValues)
                    }, { merge: true });

                    const subjectDocId = `${deptValue}_${yearValue}`; // "ADS_3"
                    const subjectRef = doc(db, 'subjects', subjectDocId);
                    batch.set(subjectRef, {
                        department: deptValue,
                        year: yearValue,
                    }, { merge: true });


                    await batch.commit();
                    alert(`Test '${title}' created and assigned successfully.`);
                    document.getElementById('test-form').reset();
                    initializeFilters();
                    
                    resetSectionMultiselect('-- Select Dept & Year First --');
                    resetSelect(subjectSelect, 'Select Dept & Year');

                } catch (err) {
                    console.error("Error creating test:", err);
                    alert("An error occurred. Check the browser console for details.");
                }
            };
            reader.readAsArrayBuffer(fileInput.files[0]);
        }
    });

    initializeFilters();
}
