import { db } from '../../../shared/firebase-config.js';
import { getDocs, collection, query, where, doc, setDoc, writeBatch, serverTimestamp, arrayUnion, getDoc } from "https://www.gstatic.com/firebasejs/9.10.0/firebase-firestore.js";

export function initManageTests(faculty) {
    const contentArea = document.getElementById('dynamic-content-area');
    const departmentSelect = document.getElementById('test-department');
    const yearSelect = document.getElementById('test-year');
    const subjectSelect = document.getElementById('test-subject-code');
    
    // ===================================================================
    // INITIALIZATION & FILTER POPULATION
    // This section is corrected to work with the `subjects` array structure.
    // ===================================================================

    function initializeFacultyFilters() {
        // 1. Validate that the 'faculty.subjects' array exists and is not empty.
        if (!faculty || !faculty.subjects || !Array.isArray(faculty.subjects) || faculty.subjects.length === 0) {
            console.error("ERROR: The 'faculty.subjects' array is missing, not an array, or empty.", faculty);

            // Display an error message to the user
            departmentSelect.innerHTML = '<option>Assignment Error</option>';
            yearSelect.innerHTML = '<option>Assignment Error</option>';
            subjectSelect.innerHTML = '<option>Assignment Error</option>';
            const container = document.getElementById('section-multiselect-container');
            if (container) container.querySelector('.custom-multiselect-trigger').textContent = 'Assignment Error';
            
            // Disable the form
            const form = contentArea.querySelector('form');
            if (form) {
                form.style.pointerEvents = 'none';
                form.style.opacity = '0.6';
            }
            return; // Stop execution
        }

        // 2. Populate dropdowns by mapping over the 'subjects' array to get unique values.
        const uniqueDepartments = [...new Set(faculty.subjects.map(s => s.department))];
        const uniqueYears = [...new Set(faculty.subjects.map(s => s.year))];
        const uniqueSections = [...new Set(faculty.subjects.map(s => s.section))];
        const uniqueSubjects = [...new Set(faculty.subjects.map(s => s.subjectCode))];

        // 3. Set the innerHTML of the select elements with the unique values.
        departmentSelect.innerHTML = uniqueDepartments.map(d => `<option value="${d}">${d}</option>`).join('');
        yearSelect.innerHTML = uniqueYears.map(y => `<option value="${y}">${y}</option>`).join('');
        subjectSelect.innerHTML = uniqueSubjects.map(s => `<option value="${s}">${s}</option>`).join('');

        // Populate the custom multi-select dropdown for sections
        populateMultiSelectSections(uniqueSections);

        // Re-enable the dropdowns
        departmentSelect.disabled = false;
        yearSelect.disabled = false;
        subjectSelect.disabled = false;
        
        // If there's only one choice, optionally disable it.
        if (uniqueDepartments.length === 1) departmentSelect.disabled = true;
        if (uniqueYears.length === 1) yearSelect.disabled = true;
    }
    
    // ===================================================================
    // CUSTOM MULTI-SELECT DROPDOWN LOGIC
    // ===================================================================

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
        } else {
            const selectedValues = Array.from(sectionCheckboxes).map(cb => cb.value);
            trigger.textContent = selectedValues.join(', ');
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
        allOption.innerHTML = `<input type="checkbox" value="ALL" id="section-all"> <span>All Sections</span>`;
        panel.appendChild(allOption);

        sections.sort().forEach(section => {
            const option = document.createElement('label');
            option.className = 'custom-multiselect-option';
            option.innerHTML = `<input type="checkbox" value="${section}" class="section-checkbox"> <span>${section}</span>`;
            panel.appendChild(option);
        });

        trigger.textContent = '-- Select Sections --';
        container.style.pointerEvents = 'auto';
        container.style.opacity = '1';

        const allCheckbox = panel.querySelector('#section-all');
        const sectionCheckboxes = panel.querySelectorAll('.section-checkbox');

        allCheckbox.addEventListener('change', () => {
            sectionCheckboxes.forEach(cb => cb.checked = allCheckbox.checked);
            updateTriggerText();
        });

        sectionCheckboxes.forEach(cb => {
            cb.addEventListener('change', () => {
                allCheckbox.checked = Array.from(sectionCheckboxes).every(checkbox => checkbox.checked);
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
            return Array.from(sectionCheckboxes).map(cb => cb.value);
        }
        return Array.from(sectionCheckboxes).filter(cb => cb.checked).map(cb => cb.value);
    }
    
    // ===================================================================
    // EVENT LISTENERS
    // ===================================================================

    contentArea.addEventListener('change', (e) => {
        const target = e.target;
        
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
            const yearValue = yearSelect.value;
            const subjectValue = subjectSelect.value;
            const questionsToAttend = parseInt(document.getElementById('questions-to-attend').value, 10);
            const timePerQuestionInMinutes = parseInt(document.getElementById('time-per-question').value, 10);
            // --- ADDED ---
            const isProctoredValue = document.getElementById('test-is-proctored').value;
            
            const sectionValues = getSelectedSections();

            // --- UPDATED VALIDATION ---
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

                    let totalMarks = 0;
                    const transformedQuestions = excelData.map(row => {
                        const marks = parseInt(row.marks, 10) || 0;
                        totalMarks += marks;
                        
                        const questionData = {
                            text: String(row.question || row.text || ''),
                            marks: marks,
                            answerKey: String(row.answerkey || '').toLowerCase().trim(),
                            type: String(row.type || fileInput.dataset.type),
                            order: parseInt(row.order || row.questionNumber, 10),
                            questionNumber: parseInt(row.order || row.questionNumber, 10)
                        };
                        
                       const options = [row.option1, row.option2, row.option3, row.option4]
                            .filter(opt => opt != null && opt !== '') // First, remove empty options
                            .map(opt => String(opt));                // Then, convert every remaining option to a string

                        if (options.length > 0) {
                            questionData.options = options;
                        }
                        return questionData;
                    });

                    // --- UPDATED testDocData ---
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
                        totalDurationInSeconds: questionsToAttend * timePerQuestionInMinutes ,
                        departments: [deptValue], 
                        years: [yearValue], 
                        sections: sectionValues, 
                        subjectCodes: [subjectValue],
                        isProctored: isProctoredValue === 'true', // --- ADDED ---
                        allowRetake: false, 
                        createdAt: serverTimestamp(),
                        createdBy: faculty.info.email || 'unknown'
                    };

                    const batch = writeBatch(db);
                    const newTestRef = doc(db, 'tests', title);
                    batch.set(newTestRef, testDocData);

                    transformedQuestions.forEach(q => {
                        const questionDocRef = doc(collection(newTestRef, 'questions'), String(q.order));
                        batch.set(questionDocRef, q);
                    });
                    
                     const assignmentDocId = `${subjectValue}_${yearValue}`;
                    const assignmentRef = doc(db, 'assignments', assignmentDocId);

                    batch.set(assignmentRef, {
                        subjectCode: subjectValue,
                        testIds: arrayUnion(title),
                        sections: arrayUnion(...sectionValues)
                    }, { merge: true });

                    const metadataRef = doc(db, 'metadata', 'appData');
                    batch.update(metadataRef, { all_subjects: arrayUnion(subjectValue) });

                    await batch.commit();
                    alert(`Test '${title}' created successfully for ${deptValue} - Year ${yearValue}, Sections: ${sectionValues.join(', ')}`);
                    
                    document.getElementById('test-form').reset();
                    initializeFacultyFilters(); // Re-initialize filters after reset
                    // We also need to re-init the multiselect logic after reset
                    initMultiSelect();

                } catch (err) {
                    console.error("Error creating test:", err);
                    alert("An error occurred while creating the test. Check the browser console for details.");
                }
            };
            reader.readAsArrayBuffer(fileInput.files[0]);
        }
    });

    // ===================================================================
    // INITIAL EXECUTION
    // ===================================================================
    initializeFacultyFilters();
    initMultiSelect();
}