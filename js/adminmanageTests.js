// File: /js/portals/admin/pages/adminmanageTests.js

// 1. CRITICAL PATH CHECK: Assumes 'firebase-config.js' is three folders up in 'shared'.
import { db } from '../../../shared/firebase-config.js'; 
import { getDocs, collection, query, where, doc, writeBatch, serverTimestamp, arrayUnion, getDoc } from "https://www.gstatic.com/firebasejs/9.10.0/firebase-firestore.js";

// NOTE: XLSX is accessed globally as 'XLSX' because it's loaded via a global script tag in HTML

const QUESTION_HEADERS = {
    'mcq': ['question', 'optionA', 'optionB', 'optionC', 'optionD', 'correctAnswer', 'marks'],
    'tf': ['question', 'correctAnswer', 'marks'], 
    'fill': ['question', 'correctAnswer', 'marks'],
    'match': ['question', 'marks', 'columnA_1', 'columnB_1', 'columnA_2', 'columnB_2', 'columnA_3', 'columnB_3', 'columnA_4', 'columnB_4'],
    'compiler': ['question', 'language', 'stdin', 'expectedOutput', 'marks'],
};

export function initManageTests(admin) {
    console.log("initManageTests started.");
    
    // --- ELEMENT REFERENCES ---
    const departmentSelect = document.getElementById('test-department');
    const yearSelect = document.getElementById('test-year');
    const subjectSelect = document.getElementById('test-subject-code');
    const testForm = document.getElementById('test-form');
    
    const sectionContainer = document.getElementById('section-multiselect-container');
    const sectionTrigger = sectionContainer?.querySelector('.custom-multiselect-trigger');
    const sectionPanel = sectionContainer?.querySelector('.custom-multiselect-panel');
    
    // --- UTILITY FUNCTIONS (omitted for brevity, assume they are correct) ---
    const getGraduationYearFromStudyYear = (studyYear) => {
        const yearNum = parseInt(studyYear, 10);
        if (!yearNum || isNaN(yearNum) || yearNum <= 0 || yearNum > 4) return null;
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();
        const currentAcademicYearStart = currentMonth < 8 ? currentYear - 1 : currentYear; 
        const gradYear = currentAcademicYearStart + (5 - yearNum);
        return String(gradYear);
    };

    const resetSelect = (selectEl, label) => {
        if (selectEl) {
            selectEl.innerHTML = `<option value="">-- ${label} --</option>`;
            selectEl.disabled = true;
        }
    };
    
    const populateSelect = (selectEl, options, label) => {
        if (selectEl) {
            selectEl.innerHTML = `<option value="">-- Choose ${label} --</option>`;
            (options?.sort() || []).forEach(opt => selectEl.innerHTML += `<option value="${opt}">${opt}</option>`);
            selectEl.disabled = false;
        }
    };
    
    const resetSectionMultiselect = (label) => {
        if (!sectionContainer || !sectionTrigger || !sectionPanel) return;
        sectionContainer.dataset.disabled = 'true';
        sectionContainer.style.opacity = '0.5';
        sectionTrigger.textContent = label;
        sectionPanel.innerHTML = '';
        sectionContainer.classList.remove('open');
    };

    const enableSectionMultiselect = (sections) => {
        if (!sectionContainer || !sectionTrigger || !sectionPanel) return;
        sectionContainer.dataset.disabled = 'false';
        sectionContainer.style.opacity = '1';
        
        sectionPanel.innerHTML = '';
        sections.sort().forEach(sec => {
            const option = document.createElement('div');
            option.className = 'custom-multiselect-option';
            option.innerHTML = `<input type="checkbox" value="${sec}"> <span>${sec}</span>`;
            sectionPanel.appendChild(option);
        });
        sectionTrigger.textContent = sections.length > 0 ? '-- Select Sections --' : 'No Sections Found';
    };

    const getSelectedSections = () => {
        return Array.from(sectionPanel?.querySelectorAll('input[type="checkbox"]'))
            .filter(cb => cb.checked)
            .map(cb => cb.value) || [];
    };
    // --- END UTILITY FUNCTIONS ---


    // --- CRITICAL: FETCH DEPARTMENTS/YEARS (Initial Load) ---
    async function initializeFilters() {
        if (!db) {
            console.error("CRITICAL ERROR: 'db' object is null. Firebase config or path is broken.");
            resetSelect(departmentSelect, 'DB Error');
            resetSelect(yearSelect, 'DB Error');
            return;
        }
        
        try {
            const appDataRef = doc(db, 'metadata', 'appData');
            const appDataSnap = await getDoc(appDataRef);
            
            if (appDataSnap.exists()) {
                const metadata = appDataSnap.data();
                populateSelect(departmentSelect, metadata.departments, 'Department');
                populateSelect(yearSelect, metadata.years, 'Year'); 
                console.log("SUCCESS: Filters loaded from metadata/appData.");
            } else {
                console.warn("WARNING: Document 'metadata/appData' not found. Filters will not populate.");
                resetSelect(departmentSelect, 'Config Missing');
                resetSelect(yearSelect, 'Config Missing');
            }

            resetSectionMultiselect('-- Select Dept & Year First --');
            resetSelect(subjectSelect, 'Select Dept & Year');
        } catch (error) {
            console.error("FETCH ERROR: Failed to initialize filters from Firestore:", error);
            resetSelect(departmentSelect, 'FETCH ERROR');
            resetSelect(yearSelect, 'FETCH ERROR');
        }
        
        // Default to 'tf' for initial question type visibility
        document.querySelectorAll('.q-upload-section').forEach(section => section.classList.add('hidden-section'));
        document.querySelectorAll('input[name="questionType"]').forEach(radio => radio.checked = false);
        
        const defaultRadio = document.querySelector('input[value="tf"]');
        if (defaultRadio) {
            defaultRadio.checked = true;
            document.getElementById('tf-upload-section')?.classList.remove('hidden-section');
            document.getElementById('tf-file').disabled = false;
        }
    }

    // --- DEPENDENT FILTER UPDATE (Dept/Year change) ---
    async function updateDependentFilters() {
        // ... (Same logic as provided) ...
        const selectedDept = departmentSelect.value;
        const selectedStudyYear = yearSelect.value;
        
        resetSectionMultiselect('-- Loading... --');
        resetSelect(subjectSelect, 'Loading...');
        
        if (!selectedDept || !selectedStudyYear) {
             resetSectionMultiselect('-- Select Dept & Year --');
             resetSelect(subjectSelect, 'Select Dept & Year');
             return;
        }

        const graduationYear = getGraduationYearFromStudyYear(selectedStudyYear);
        if (!graduationYear) return;
        
        const assignmentKey = `${selectedDept}_${graduationYear}`;
        const subjectKey = `${selectedDept}_${selectedStudyYear}`;

        try {
            const [subjectSnap, assignmentSnap] = await Promise.all([
                getDoc(doc(db, 'subjects', subjectKey)),
                getDoc(doc(db, 'assignments', assignmentKey))
            ]);

            // 1. Subjects
            let subjectCodes = subjectSnap.exists() ? subjectSnap.data().subjectCodes || [] : [];
            let subjectMap = subjectSnap.exists() ? subjectSnap.data().subjectMap || {} : {};
            
            if (subjectCodes.length > 0) {
                let optionsHTML = `<option value="">-- Choose Subject --</option>`;
                (subjectCodes.sort() || []).forEach(subjectCode => {
                    const subjectName = subjectMap[subjectCode] || 'Unknown Subject';
                    optionsHTML += `<option value="${subjectCode}">${subjectCode} - ${subjectName}</option>`;
                });
                subjectSelect.innerHTML = optionsHTML;
                subjectSelect.disabled = false;
            } else {
                resetSelect(subjectSelect, 'No Subjects Found');
            }
            
            // 2. Sections
            let sections = assignmentSnap.exists() ? assignmentSnap.data().sections || [] : [];
            enableSectionMultiselect(sections);
            
        } catch (error) {
            console.error("Error updating dependent filters:", error);
            resetSelect(subjectSelect, 'Loading Error');
            resetSectionMultiselect('Loading Error');
        }
    }

    // --- EVENT LISTENERS ---
    
    testForm.addEventListener('change', (e) => {
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
                populateSelect(subtypeSelect, subTypeOptions[selectedType], 'Sub-Type');
                subtypeContainer.classList.remove('hidden-section');
            } else {
                subtypeContainer.classList.add('hidden-section');
            }
        }
        
        // Question Type radio buttons
        if (target.classList.contains('qt-checkbox') && target.type === 'radio') {
            const type = target.value;
            
            document.querySelectorAll('.q-upload-section').forEach(s => s.classList.add('hidden-section'));
            document.querySelectorAll('#upload-sections-container input[type="file"]').forEach(input => input.disabled = true);
            
            const targetSection = document.getElementById(`${type}-upload-section`);
            const targetFileInput = document.getElementById(`${type}-file`);

            if (targetSection && targetFileInput) {
                targetSection.classList.remove('hidden-section');
                targetFileInput.disabled = false;
            }
        }
    });

    // Multiselect toggle and selection
    sectionTrigger?.addEventListener('click', (e) => {
        if (sectionContainer.dataset.disabled === 'true') return;
        e.stopPropagation();
        sectionContainer.classList.toggle('open');
    });

    sectionPanel?.addEventListener('change', (e) => {
        if (e.target.type === 'checkbox') {
            const checkedCount = getSelectedSections().length;
            sectionTrigger.textContent = checkedCount > 0 ? `${checkedCount} sections selected` : '-- Select Sections --';
        }
    });
    
    document.addEventListener('click', (e) => {
        if (sectionContainer && !sectionContainer.contains(e.target)) {
            sectionContainer.classList.remove('open');
        }
    });


    // Create Test Button and Template Download Logic
    testForm.addEventListener('click', async (e) => {
        const target = e.target;
        
        // Template Download (Logic confirmed correct)
        if (target.classList.contains('download-template-btn')) {
            const templateType = target.dataset.templateType;
            const headers = QUESTION_HEADERS[templateType];
            
            if (typeof XLSX === 'undefined') {
                alert("XLSX library not loaded. Check the <script> tag in your HTML.");
                return;
            }
            
            let exampleData = [];
            if (templateType === 'mcq') exampleData = [['Question 1', 'Opt A', 'Opt B', 'Opt C', 'Opt D', 'Opt A', 2]];
            else if (templateType === 'tf') exampleData = [['Question 1 (True/False)', 'True', 1]];
            else if (templateType === 'fill') exampleData = [['The capital of India is', 'New Delhi', 1]];
            
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([headers, ...exampleData]), 'Questions');
            XLSX.writeFile(wb, `${templateType}_template.xlsx`);
            return;
        }

        // Create Test Submission (Logic confirmed correct)
        if (target.id === 'create-test-btn') {
            e.preventDefault();
            
            if (!db) {
                alert("FATAL ERROR: Database connection is not established. Cannot save test.");
                return;
            }

            const questionType = document.querySelector('input[name="questionType"]:checked')?.value;
            const fileInput = document.getElementById(`${questionType}-file`);

            if (!questionType || !fileInput || fileInput.files.length === 0) {
                return alert('Validation Error: Please select a question type and upload a file.');
            }

            const title = document.getElementById('test-name').value.trim();
            const testId = document.getElementById('test-id').value.trim();
            const subjectValue = subjectSelect.value;
            const deptValue = departmentSelect.value;
            const yearValue = yearSelect.value;
            const sectionValues = getSelectedSections();
            
            if (!testId || !title || !subjectValue || sectionValues.length === 0 || !deptValue || !yearValue) {
                 return alert('Validation Error: Please fill in Test ID, Name, Subject, Department, Year, and select Sections.');
            }
            
            const file = fileInput.files[0];
            const reader = new FileReader();

            reader.onload = async (event) => {
                 try {
                    const data = event.target.result;
                    const workbook = XLSX.read(data, { type: 'array' });
                    const sheetName = workbook.SheetNames[0];
                    const questionData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });
                    
                    const totalQuestions = questionData.length > 1 ? questionData.length - 1 : 0; 
                    if (totalQuestions === 0) { alert("File is empty or only contains headers."); return; }
                    
                    const newTest = {
                        title: title,
                        testId: testId,
                        subject: subjectValue,
                        sections: sectionValues,
                        departments: [deptValue],
                        years: [yearValue],
                        totalQuestions: totalQuestions,
                        totalMarks: 100, // Placeholder
                        start: new Date(document.getElementById('start-date').value),
                        end: new Date(document.getElementById('end-date').value),
                        createdBy: admin?.email || 'Admin Portal',
                        createdAt: serverTimestamp(),
                    };

                    const batch = writeBatch(db);
                    const testRef = doc(db, 'tests', testId);
                    batch.set(testRef, newTest);

                    const graduationYear = getGraduationYearFromStudyYear(yearValue);
                    const assignmentDocId = `${deptValue}_${graduationYear}`;
                    const assignmentRef = doc(db, 'assignments', assignmentDocId);
                    
                    batch.set(assignmentRef, {
                        testIds: arrayUnion(testId),
                        subjects: arrayUnion(subjectValue),
                        sections: arrayUnion(...sectionValues)
                    }, { merge: true });
                    
                    await batch.commit();

                    alert(`Test '${title}' created successfully! Questions: ${totalQuestions}.`);
                    testForm.reset();
                    initializeFilters();

                } catch (err) {
                    console.error("FATAL ERROR during test creation/file processing:", err);
                    alert(`An unexpected error occurred. Check the browser console. Error: ${err.message}`);
                }
            };
            
            reader.readAsArrayBuffer(file);
        }
    });

    // --- FINAL INITIALIZATION ---
    initializeFilters();
}