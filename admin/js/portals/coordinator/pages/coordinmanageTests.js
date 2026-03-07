import { db } from '../../../shared/firebase-config.js';
import { getDocs, collection, query, where, doc, setDoc, writeBatch, serverTimestamp, arrayUnion, getDoc } from "https://www.gstatic.com/firebasejs/9.10.0/firebase-firestore.js";

export function initManageTests(coordinator) {
    const contentArea = document.getElementById('dynamic-content-area');
    const departmentSelect = document.getElementById('test-department');
    const yearSelect = document.getElementById('test-year');
    // const sectionSelect = document.getElementById('test-section'); // This element doesn't seem to be used, replaced by multi-select
    const subjectSelect = document.getElementById('test-subject-code');

    // --- (HELPER FUNCTION: Added from adminmanageTests.js) ---
    // Converts Study Year (e.g., "3") to Graduation Year (e.g., "2027")
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
        return gradYear.toString(); // Return as string
    };

    const resetSelect = (selectEl, label) => {
        if (selectEl) {
            selectEl.innerHTML = `<option value="">-- ${label} --</option>`;
            selectEl.disabled = true;
        }
    };

    // --- (Your original multi-select functions: UNCHANGED) ---
    function initMultiSelect() {
        const container = document.getElementById('section-multiselect-container');
        if (!container) return;

        const trigger = container.querySelector('.custom-multiselect-trigger');
        const panel = container.querySelector('.custom-multiselect-panel');
        
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            container.classList.toggle('open');
        });

        document.addEventListener('click', (e) => {
            if (!container.contains(e.target)) {
                container.classList.remove('open');
            }
        });

        panel.addEventListener('change', (e) => {
            if (e.target.type === 'checkbox') {
                updateTriggerText();
            }
        });
    }

    function updateTriggerText() {
        const container = document.getElementById('section-multiselect-container');
        if (!container) return;

        const trigger = container.querySelector('.custom-multiselect-trigger');
        const allCheckbox = container.querySelector('#section-all');
        const sectionCheckboxes = container.querySelectorAll('.section-checkbox:checked');
        
        if (sectionCheckboxes.length === 0) {
            trigger.textContent = '-- Select Sections --';
        } else if (allCheckbox && allCheckbox.checked) {
            trigger.textContent = 'All Sections';
        } else if (sectionCheckboxes.length === 1) {
            trigger.textContent = Array.from(sectionCheckboxes).map(cb => cb.value)[0];
        } else {
            trigger.textContent = `${sectionCheckboxes.length} sections selected`;
        }
    }

    function populateMultiSelectSections(sections) {
        const container = document.getElementById('section-multiselect-container');
        if (!container) return;

        const panel = container.querySelector('.custom-multiselect-panel');
        const trigger = container.querySelector('.custom-multiselect-trigger');

        panel.innerHTML = ''; // Clear existing options

        const allOption = document.createElement('label');
        allOption.className = 'custom-multiselect-option';
        allOption.innerHTML = `
            <input type="checkbox" value="ALL" id="section-all">
            <span>All Sections</span>
        `;
        panel.appendChild(allOption);

        sections.sort().forEach(section => {
            const option = document.createElement('label');
            option.className = 'custom-multiselect-option';
            option.innerHTML = `
                <input type="checkbox" value="${section}" class="section-checkbox">
                <span>${section}</span>
            `;
            panel.appendChild(option);
        });

        trigger.textContent = '-- Select Sections --';
        container.style.pointerEvents = 'auto';
        container.style.opacity = '1';

        const allCheckbox = panel.querySelector('#section-all');
        const sectionCheckboxes = panel.querySelectorAll('.section-checkbox');

        allCheckbox.addEventListener('change', () => {
            sectionCheckboxes.forEach(cb => {
                cb.checked = allCheckbox.checked;
            });
            updateTriggerText();
        });

        sectionCheckboxes.forEach(cb => {
            cb.addEventListener('change', () => {
                if (!cb.checked) {
                    allCheckbox.checked = false;
                } else {
                    const allChecked = Array.from(sectionCheckboxes).every(checkbox => checkbox.checked);
                    allCheckbox.checked = allChecked;
                }
                updateTriggerText();
            });
        });
    }

    function getSelectedSections() {
        const container = document.getElementById('section-multiselect-container');
        if (!container) return [];

        const allCheckbox = container.querySelector('#section-all');
        const sectionCheckboxes = container.querySelectorAll('.section-checkbox');

        if (allCheckbox && allCheckbox.checked) {
            // If "All" is checked, return all individual section values
            return Array.from(sectionCheckboxes).map(cb => cb.value);
        }

        // Otherwise, return only the checked ones
        return Array.from(sectionCheckboxes)
            .filter(cb => cb.checked)
            .map(cb => cb.value);
    }
    // --- (End of your original multi-select functions) ---


    // --- (Your original initializeFilters: UNCHANGED) ---
    // This logic is correct for the coordinator, as it locks the fields.
   async function initializeFilters() {
        try {
            if (!coordinator) {
                return alert("Error: Unable to load coordinator information.");
            }

            const getAsArray = (prop) => {
                if (Array.isArray(prop)) return prop;
                if (prop) return [String(prop)];
                return [];
            };

            const depts = getAsArray(coordinator.departments || coordinator.department);
            const years = getAsArray(coordinator.years || coordinator.year); // These are Study Years

            let isDeptLocked = false;
            let isYearLocked = false;

            // --- Handle Department ---
            if (departmentSelect) {
                if (depts.length > 1) {
                    // More than one dept: Create a dropdown
                    departmentSelect.innerHTML = `<option value="">-- Choose Department --</option>`;
                    depts.forEach(dept => {
                        departmentSelect.innerHTML += `<option value="${dept}">${dept}</option>`;
                    });
                    departmentSelect.disabled = false;
                    departmentSelect.style.backgroundColor = '';
                    departmentSelect.style.cursor = '';
                    isDeptLocked = false;
                } else if (depts.length === 1) {
                    // Exactly one dept: Lock it
                    const coordinatorDept = depts[0];
                    departmentSelect.innerHTML = `<option value="${coordinatorDept}" selected>${coordinatorDept}</option>`;
                    departmentSelect.disabled = true;
                    departmentSelect.style.backgroundColor = 'var(--off-white)';
                    departmentSelect.style.cursor = 'not-allowed';
                    isDeptLocked = true;
                } else {
                    return alert("Error: Coordinator has no assigned department.");
                }
            }

            // --- Handle Year ---
            if (yearSelect) {
                if (years.length > 1) {
                    // More than one year: Create a dropdown
                    yearSelect.innerHTML = `<option value="">-- Choose Year --</option>`;
                    years.forEach(year => {
                        yearSelect.innerHTML += `<option value="${year}">${year}</option>`;
                    });
                    yearSelect.disabled = false;
                    yearSelect.style.backgroundColor = '';
                    yearSelect.style.cursor = '';
                    isYearLocked = false;
                } else if (years.length === 1) {
                    // Exactly one year: Lock it
                    const coordinatorYear = years[0];
                    yearSelect.innerHTML = `<option value="${coordinatorYear}" selected>${coordinatorYear}</option>`;
                    yearSelect.disabled = true;
                    yearSelect.style.backgroundColor = 'var(--off-white)';
                    yearSelect.style.cursor = 'not-allowed';
                    isYearLocked = true;
                } else {
                    return alert("Error: Coordinator has no assigned year.");
                }
            }
            
            // Reset dependent filters
            resetSelect(subjectSelect, 'Select Dept & Year');
            const container = document.getElementById('section-multiselect-container');
            if (container) {
                const panel = container.querySelector('.custom-multiselect-panel');
                const trigger = container.querySelector('.custom-multiselect-trigger');
                panel.innerHTML = '';
                trigger.textContent = 'Select Dept & Year';
                container.style.pointerEvents = 'none';
                container.style.opacity = '0.5';
            }

            // If both are locked, load dependents immediately
            if (isDeptLocked && isYearLocked) {
                 await updateDependentFilters();
            }

        } catch (error) {
            console.error("Failed to initialize filters:", error);
            alert("Error loading coordinator information. Please try again.");
        }
    }

    // --- (MODIFIED: `updateDependentFilters` now matches admin file's logic) ---
    async function updateDependentFilters() {
        // Get values from the fixed department and year
        const selectedDept = departmentSelect.value;
        const selectedStudyYear = yearSelect.value; // This is Study Year (e.g., "3")
        
        resetSelect(subjectSelect, 'Loading...');
        
        // Reset multi-select
        const container = document.getElementById('section-multiselect-container');
        if (container) {
            const panel = container.querySelector('.custom-multiselect-panel');
            const trigger = container.querySelector('.custom-multiselect-trigger');
            panel.innerHTML = '';
            trigger.textContent = 'Loading...';
            container.style.pointerEvents = 'none';
            container.style.opacity = '0.5';
        }

        if (!selectedDept || !selectedStudyYear) return;
        
        // --- DYNAMIC KEYS (from admin file) ---
        const graduationYear = getGraduationYearFromStudyYear(selectedStudyYear); // "2027"
        if (!graduationYear) {
            console.error("Could not calculate graduation year from study year:", selectedStudyYear);
            return;
        }
        
        const assignmentKey = `${selectedDept}_${graduationYear}`; // "ADS_2027"
        const subjectKey = `${selectedDept}_${selectedStudyYear}`;  // "ADS_3"

        try {
            // 1. Fetch from two locations (from admin file)
            const assignmentRef = doc(db, 'assignments', assignmentKey);
            const subjectRef = doc(db, 'subjects', subjectKey);
            
            const [assignmentSnap, subjectSnap] = await Promise.all([
                getDoc(assignmentRef),
                getDoc(subjectRef)
            ]);

            // 2. Populate Sections (from assignmentSnap)
            if (assignmentSnap.exists()) {
                const assignmentData = assignmentSnap.data();
                if (assignmentData.sections && assignmentData.sections.length > 0) {
                    populateMultiSelectSections(assignmentData.sections); // Uses your function
                } else {
                    if (container) {
                        container.querySelector('.custom-multiselect-trigger').textContent = '-- No Sections Found --';
                    }
                }
            } else {
                console.log(`No metadata found in 'assignments' for key: ${assignmentKey}`);
                if (container) {
                    container.querySelector('.custom-multiselect-trigger').textContent = '-- No Sections Found --';
                }
            }

            // 3. Populate Subjects with names (from subjectSnap)
            if (subjectSnap.exists()) {
                const subjectData = subjectSnap.data();
                const subjectMap = subjectData.subjectMap || {};
                const subjectCodes = subjectData.subjectCodes || [];

                if (subjectCodes.length > 0) {
                    let optionsHTML = `<option value="">-- Choose Subject --</option>`;
                    
                    const optionList = subjectCodes.sort().map(subjectCode => {
                        const subjectName = subjectMap[subjectCode] || 'Unknown Subject';
                        return `<option value="${subjectCode}">${subjectCode} - ${subjectName}</option>`;
                    });
                    
                    optionsHTML += optionList.join('');
                    subjectSelect.innerHTML = optionsHTML;
                    subjectSelect.disabled = false;
                } else {
                    resetSelect(subjectSelect, 'No Subjects Found');
                }
            } else {
                console.log(`No metadata found in 'subjects' for key: ${subjectKey}`);
                resetSelect(subjectSelect, 'No Subjects Found');
            }

        } catch (error) {
            console.error("Error updating dependent filters:", error);
            alert("Error loading sections and subjects. Please refresh the page.");
        }
    }


    // --- (Event Listeners: UNCHANGED) ---
    contentArea.addEventListener('change', (e) => {
        const target = e.target;

        // --- THIS BLOCK IS NEW ---
        // Listen for changes on the (now possibly enabled) dept/year dropdowns
        if (target.id === 'test-department' || target.id === 'test-year') {
            updateDependentFilters();
        }
        // --- END OF NEW BLOCK ---
        
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
            XLSX.writeFile(wb, `questions_template.xlsx`);
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

            // Get selected sections from multi-select
            const sectionValues = getSelectedSections();

            if (!title || !testType || !subType || !deptValue || !yearValue || !subjectValue || isNaN(questionsToAttend) || isNaN(timePerQuestionInMinutes) || isProctoredValue === "") {
                return alert('Error: Please fill out all required test details, including proctoring status.');
            }

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
                    
                    console.log("Excel Column Headers Found:", Object.keys(excelData[0]));

                    let totalMarks = 0;
                    const transformedQuestions = excelData.map(row => {
                        const marks = parseInt(row.marks, 10) || 0;
                        totalMarks += marks;
                        const answerKey = String(row.answerkey || '').toLowerCase().trim();
                        const questionData = {
                            text: String(row.question || row.text || ''),
                            marks: marks,
                            answerKey: answerKey,
                            type: String(row.type || fileInput.dataset.type),
                            order: parseInt(row.order || row.questionNumber, 10),
                            questionNumber: parseInt(row.order || row.questionNumber, 10)
                        };
                        
                       const options = [row.option1, row.option2, row.option3, row.option4]
                            .filter(opt => opt != null && opt !== '') 
                            .map(opt => String(opt));

                        if (options.length > 0) {
                            questionData.options = options;
                        }
                        return questionData;
                    });

                    // testDocData is correct, stores Study Year (e.g., "3")
                    const testDocData = {
                        title, 
                        type: testType, 
                        subType,
                        questionCount: transformedQuestions.length, 
                        totalMarks,
                        start: new Date(document.getElementById('start-date').value),
                        end: new Date(document.getElementById('end-date').value),
                        questionsToAttend, 
                        timePerQuestion: timePerQuestionInMinutes,
                        totalDurationInSeconds: questionsToAttend * timePerQuestionInMinutes, // Fixed from admin
                        departments: [deptValue], 
                        years: [yearValue], // Saves Study Year
                        sections: sectionValues, 
                        subjectCodes: [subjectValue],
                        isProctored: isProctoredValue === 'true',
                        allowRetake: false, 
                        createdAt: serverTimestamp(),
                        createdBy: coordinator.email || 'unknown'
                    };

                    const batch = writeBatch(db);
                    
                    const newTestRef = doc(db, 'tests', title);
                    batch.set(newTestRef, testDocData);

                    transformedQuestions.forEach(q => {
                        const questionDocRef = doc(collection(newTestRef, 'questions'), String(q.order));
                        batch.set(questionDocRef, q);
                    });

                    // --- (MODIFIED: Batch write logic now matches admin file's paths) ---

                    // 1. Calculate graduation year
                    const graduationYear = getGraduationYearFromStudyYear(yearValue);
                    if (!graduationYear) {
                         throw new Error("Could not calculate graduation year.");
                    }
                    
                    // 2. Get correct assignment doc path (e.g., "ADS_2027")
                    const assignmentDocId = `${deptValue}_${graduationYear}`; 
                    const assignmentRef = doc(db, 'assignments', assignmentDocId);

                    // 3. Set data in 'assignments' doc
                    batch.set(assignmentRef, {
                        testIds: arrayUnion(title),
                        subjects: arrayUnion(subjectValue), // Uses 'subjects' (plural)
                        sections: arrayUnion(...sectionValues)
                    }, { merge: true });

                    // 4. Get correct subject doc path (e.g., "ADS_3")
                    const subjectDocId = `${deptValue}_${yearValue}`;
                    const subjectRef = doc(db, 'subjects', subjectDocId);
                    
                    // 5. Set data in 'subjects' doc
                    batch.set(subjectRef, {
                        department: deptValue,
                        year: yearValue,
                        // This merge ensures we don't overwrite existing subjectMap/subjectCodes
                    }, { merge: true });
                    
                    // --- (End of modifications) ---

                    await batch.commit();
                    alert(`Test '${title}' created successfully for ${deptValue} - Year ${yearValue}, Sections: ${sectionValues.join(', ')}`);
                    
                    document.getElementById('test-form').reset();
                    initializeFilters(); // Re-locks fields and re-loads dependents
                    initMultiSelect(); // Re-attach listeners to multi-select

                } catch (err) {
                    console.error("Error creating test:", err);
                    alert("An error occurred while creating the test. Check the browser console for details.");
                }
            };
            reader.readAsArrayBuffer(fileInput.files[0]);
        }
    });

    // Initial setup
    initializeFilters();
    initMultiSelect();
}