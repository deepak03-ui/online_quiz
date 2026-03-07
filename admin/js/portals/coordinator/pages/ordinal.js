import { db } from '../../../shared/firebase-config.js';


export function initManageTests(coordinator) {
    const contentArea = document.getElementById('dynamic-content-area');

    // Get references to the form's select elements
    const departmentSelect = document.getElementById('test-department');
    const yearSelect = document.getElementById('test-year');
    const sectionSelect = document.getElementById('test-section');
    const subjectSelect = document.getElementById('test-subject-code');

    // This will store all faculty assignment data from Firestore
    let allFacultyAssignments = [];

    /**
     * This is the main function that updates the dependent dropdowns.
     * The dependency chain is: Section -> Subject.
     * Department and Year are fixed based on the logged-in coordinator.
     */
    const updateDropdowns = () => {
        // Get the current values to preserve them after re-populating
        const selectedSection = sectionSelect.value;
        const selectedSubject = subjectSelect.value;

        // The coordinator's department and year are fixed.
      // The coordinator's department and year are fixed.
    const coordinatorDept = coordinator.department; // Changed
    const coordinatorYear = coordinator.year;       // Changed

    // 1. Set and disable Department and Year based on coordinator's data
    departmentSelect.innerHTML = `<option value="${coordinatorDept}">${coordinatorDept}</option>`;
    departmentSelect.value = coordinatorDept;
    departmentSelect.disabled = true;

    yearSelect.innerHTML = `<option value="${coordinatorYear}">${coordinatorYear}</option>`;
    yearSelect.value = coordinatorYear;
    yearSelect.disabled = true;

        // 2. Populate Sections (filtered by the coordinator's department and year)
        const sections = [...new Set(
            allFacultyAssignments
                .filter(a => a.department === coordinatorDept && a.year === coordinatorYear)
                .map(a => a.section)
        )].sort();

        sectionSelect.innerHTML = '<option value="">-- Select Section --</option>';
        sections.forEach(section => {
            sectionSelect.innerHTML += `<option value="${section}">${section}</option>`;
        });
        sectionSelect.disabled = sections.length === 0;
        if (sections.length === 0) {
            sectionSelect.innerHTML = '<option value="">-- No Sections Found --</option>';
        }
        sectionSelect.value = selectedSection;


        // 3. Populate Subjects (filtered by department, year, and selected section)
        if (selectedSection) {
            const subjects = [...new Set(
                allFacultyAssignments
                    .filter(a => a.department === coordinatorDept && a.year === coordinatorYear && a.section === selectedSection)
                    .map(a => a.subjectCode)
            )].sort();
            
            subjectSelect.innerHTML = '<option value="">-- Select Subject --</option>';
            subjects.forEach(subject => {
                subjectSelect.innerHTML += `<option value="${subject}">${subject}</option>`;
            });
            subjectSelect.disabled = false;
        } else {
            subjectSelect.innerHTML = '<option value="">-- Select Section First --</option>';
            subjectSelect.disabled = true;
        }
        subjectSelect.value = selectedSubject;
    };

    /**
     * Fetches all faculty data from Firestore once and initializes the filters.
     */
    async function initializeFilters() {
        try {
            // Fetch all 'faculty' users to get all possible sections and subjects
            const snapshot = await db.collection('users').where('role', '==', 'faculty').get();
            allFacultyAssignments = snapshot.docs.map(doc => doc.data());
            
            // Initial call to populate dropdowns based on coordinator's fixed data
            updateDropdowns();
        } catch (error) {
            console.error("Failed to fetch faculty assignment data:", error);
            departmentSelect.innerHTML = '<option value="">Error loading data</option>';
        }
    }

    // --- EVENT LISTENERS ---

    contentArea.addEventListener('change', (e) => {
        // When the section dropdown changes, re-run the update logic for subjects
        if (e.target.id === 'test-section') {
            subjectSelect.value = ''; // Reset child dropdown
            updateDropdowns();
        }

        // Logic for Test Type -> Sub-Type dropdown
        if (e.target.id === 'test-type-select') {
            const selectedType = e.target.value;
            const subtypeContainer = document.getElementById('test-subtype-container');
            const subtypeSelect = document.getElementById('test-subtype-select');
            
            const subTypeOptions = {
                monthly: ['Unit 1', 'Unit 2', 'Unit 3', 'Unit 4', 'Unit 5'],
                tsp: ['Compiler Test', 'Aptitude Test', 'Technical Skills Test'],
                internal: ['Internal 1', 'Internal 2', 'Internal 3']
            };

            if (selectedType && subTypeOptions[selectedType]) {
                const options = subTypeOptions[selectedType]
                    .map(opt => `<option value="${opt}">${opt}</option>`)
                    .join('');
                subtypeSelect.innerHTML = options;
                subtypeContainer.classList.remove('hidden-section');
            } else {
                subtypeContainer.classList.add('hidden-section');
            }
        }

        // Logic for showing/hiding question upload sections
        if (e.target.classList.contains('qt-checkbox')) {
            const type = e.target.value;
            const section = document.getElementById(`${type}-upload-section`);
            if (section) {
                section.classList.toggle('hidden-section', !e.target.checked);
            }
        }
    });

    contentArea.addEventListener('click', async (e) => {
        if (e.target.id === 'create-test-btn') {
            const testDetails = {
                testid: document.getElementById('test-id').value.trim(),
                testname: document.getElementById('test-name').value.trim(),
                subjectCode: subjectSelect.value,
                testType: document.getElementById('test-type-select').value,
                testSubType: document.getElementById('test-subtype-select').value,
                department: departmentSelect.value, // Will be coordinator's department
                year: yearSelect.value,             // Will be coordinator's year
                section: sectionSelect.value,
                startDate: new Date(document.getElementById('start-date').value),
                endDate: new Date(document.getElementById('end-date').value),
                timePerQuestion: parseInt(document.getElementById('time-per-question').value, 10) || 60,
                questionsToAttend: parseInt(document.getElementById('questions-to-attend').value, 10),
                createdBy: coordinator.email // Use coordinator's email
            };

            if (!testDetails.testid || !testDetails.testname || !testDetails.subjectCode || !testDetails.section || !testDetails.testType) {
                return alert('Error: Please fill out all required test detail fields.');
            }

            const fileInputs = Array.from(document.querySelectorAll('#upload-sections-container input[type="file"]'))
                .filter(input => !input.closest('.hidden-section') && input.files.length > 0);

            if (fileInputs.length === 0) {
                return alert('Error: Please select at least one question type and upload its corresponding file.');
            }
            
            e.target.disabled = true; // Prevent multiple clicks
            e.target.textContent = 'Creating...';

            try {
                // Set the main test document
                await db.collection('tests').doc(testDetails.testid).set(testDetails);

                // Read all files and prepare questions for batch upload
                const fileReadPromises = fileInputs.map(input => new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        try {
                            const data = new Uint8Array(event.target.result);
                            const workbook = XLSX.read(data, { type: 'array' });
                            const sheetName = workbook.SheetNames[0];
                            const json = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
                            resolve(json.map(q => ({ ...q, type: input.dataset.type })));
                        } catch (readError) {
                            reject(readError);
                        }
                    };
                    reader.onerror = reject;
                    reader.readAsArrayBuffer(input.files[0]);
                }));
                
                const allQuestionArrays = await Promise.all(fileReadPromises);
                const allQuestions = allQuestionArrays.flat();

                if (allQuestions.length > 0) {
                    const batch = db.batch();
                    const questionsCollectionRef = db.collection('tests').doc(testDetails.testid).collection('questions');
                    allQuestions.forEach(question => {
                        const questionRef = questionsCollectionRef.doc(); // Auto-generate ID
                        batch.set(questionRef, question);
                    });
                    await batch.commit();
                }

                alert(`Test '${testDetails.testname}' created successfully with ${allQuestions.length} questions.`);
                document.getElementById('test-form').reset();
                document.querySelectorAll('.q-upload-section, #test-subtype-container').forEach(s => s.classList.add('hidden-section'));
                initializeFilters(); // Re-initialize dropdowns for the next test
            } catch (error) {
                console.error("Error creating test:", error);
                alert("An error occurred while creating the test. Please check the console for details.");
            } finally {
                e.target.disabled = false;
                e.target.textContent = 'Create Test';
            }
        }
    });

    // Start the entire process when the page loads
    initializeFilters();
}