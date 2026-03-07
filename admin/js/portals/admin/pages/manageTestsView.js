// File: /js/portals/admin/pages/manageTestsView.js
// --- FIXED: Uses 'subjects' doc for subject codes, not 'assignments' ---

import { db } from '../../../shared/firebase-config.js';
import { getDocs, collection, query, where, doc, getDoc } from "https://www.gstatic.com/firebasejs/9.10.0/firebase-firestore.js";

export function initManageTestsView() {
    const departmentFilter = document.getElementById('filter-department');
    const yearFilter = document.getElementById('filter-year');
    const sectionFilter = document.getElementById('filter-section');
    const subjectFilter = document.getElementById('filter-subject');
    const applyFiltersBtn = document.getElementById('apply-filters-btn');
    const testsContainer = document.getElementById('tests-container');
    
    // --- (getGraduationYearFromStudyYear helper is correct) ---
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

    function populateSelect(selectElement, optionsArray, label) {
        if (!selectElement) return;
        selectElement.innerHTML = `<option value="">${label}</option>`;
        (optionsArray?.sort() || []).forEach(opt => {
            selectElement.innerHTML += `<option value="${opt}">${opt}</option>`;
        });
        selectElement.disabled = false;
    }

    // --- (populateSubjectSelect helper is correct) ---
    function populateSubjectSelect(selectElement, assignedCodes, subjectMap, label) {
        if (!selectElement) return;
        selectElement.innerHTML = `<option value="">${label}</option>`;
        (assignedCodes?.sort() || []).forEach(code => {
            const name = subjectMap[code] || 'Unknown Subject';
            selectElement.innerHTML += `<option value="${code}">${code} - ${name}</option>`;
        });
        selectElement.disabled = false;
    }

    // --- (populateMainFilters function is correct) ---
    async function populateMainFilters() {
        try {
            const appDataRef = doc(db, 'metadata', 'appData');
            const appDataSnap = await getDoc(appDataRef);
            if (appDataSnap.exists()) {
                const metadata = appDataSnap.data();
                populateSelect(departmentFilter, metadata.departments, '-- Select Department --');
                populateSelect(yearFilter, metadata.years, '-- Select Year --'); // Populates with "1", "2", "3", "4"
            } else {
                console.error("Metadata document ('metadata/appData') not found!");
            }
        } catch (error) {
            console.error("Error populating main filters:", error);
        }
    }

    // --- MODIFIED: Populates subjects from 'subjects' doc, not 'assignments' ---
    async function populateDependentFilters() {
        const selectedDept = departmentFilter.value;
        const selectedStudyYear = yearFilter.value; // This is Study Year (e.g., "3")
        
        populateSelect(sectionFilter, [], '-- Select Section --');
        sectionFilter.disabled = true;
        populateSelect(subjectFilter, [], '-- Select Subject --');
        subjectFilter.disabled = true;
        
        if (selectedDept && selectedStudyYear) {
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

                // 2. Get the master list of names and codes from 'subjects' doc
                const subjectMap = subjectSnap.exists() ? subjectSnap.data().subjectMap : {};
                const subjectCodes = subjectSnap.exists() ? subjectSnap.data().subjectCodes : []; // --- USE THIS ---

                // 3. Populate Sections (still from 'assignments' doc)
                if (assignmentSnap.exists()) {
                    const metaInfo = assignmentSnap.data();
                    populateSelect(sectionFilter, metaInfo.sections, '-- All Sections --');
                } else {
                    console.log(`No metadata found in 'assignments' for key: ${assignmentKey}`);
                }
                
                // 4. Populate Subjects using codes from 'subjects' doc
                // (This replaces the old logic that used metaInfo.subjects)
                populateSubjectSelect(subjectFilter, subjectCodes, subjectMap, '-- Select Subject --');

            } catch (error) {
                console.error("Error populating dependent filters:", error);
            }
        }
    }

    // --- (All functions from here down are correct, no changes needed) ---
    
    function applyFilters() {
        const filters = {
            department: departmentFilter.value || null,
            year: yearFilter.value || null, // This is Study Year (e.g., "3")
            section: sectionFilter.value || null,
            subject: subjectFilter.value || null,
        };
        renderTests(filters);
    }

    function displayTests(tests) {
        // ... (function remains the same) ...
        if (!testsContainer) return;
        testsContainer.innerHTML = '';
        if (tests.length === 0) {
            testsContainer.innerHTML = '<p>No tests found matching the selected criteria.</p>';
            return;
        }
        tests.forEach(test => {
            const testCard = document.createElement('div');
            testCard.className = 'test-card';
            const subjectCodesText = (test.subjectCodes ?? []).join(', ') || 'N/A';
            const sectionsText = (test.sections ?? []).join(', ') || 'N/A';
            testCard.innerHTML = `
                <h3>${test.title ?? 'Untitled Test'}</h3>
                <p><strong>Subject:</strong> ${subjectCodesText}</p>
                <p><strong>Type:</strong> ${test.type ?? 'N/A'} - ${test.subType ?? 'N/A'}</p>
                <p><strong>Sections:</strong> ${sectionsText}</p>
                <button class="view-results-btn" data-testid="${test.id}">View Results</button>
            `;
            testsContainer.appendChild(testCard);
        });
    }

    async function renderTests(filters) {
        // ... (function remains the same) ...
        if (testsContainer) {
            testsContainer.innerHTML = '<p>Loading tests...</p>';
        }
        try {
            let q = collection(db, 'tests');
            if (filters.department) {
                q = query(q, where('departments', 'array-contains', filters.department));
            }
            const querySnapshot = await getDocs(q);
            let tests = [];
            querySnapshot.forEach(doc => tests.push({ id: doc.id, ...doc.data() }));

            const filteredTests = tests.filter(test => {
                const yearMatch = filters.year ? test.years?.includes(filters.year) : true;
                const sectionMatch = filters.section ? test.sections?.includes(filters.section) : true;
                const subjectMatch = filters.subject ? test.subjectCodes?.includes(filters.subject) : true;
                return yearMatch && sectionMatch && subjectMatch;
            });
            displayTests(filteredTests);
        } catch (error) {
            console.error("Error fetching tests:", error);
            if (testsContainer) {
                testsContainer.innerHTML = '<p class="error">Failed to load tests. Please try again.</p>';
            }
        }
    }

    // Event Listeners
    if (applyFiltersBtn) {
        applyFiltersBtn.addEventListener('click', applyFilters);
    }
    if (departmentFilter) {
        departmentFilter.addEventListener('change', populateDependentFilters);
    }
    if (yearFilter) {
        yearFilter.addEventListener('change', populateDependentFilters);
    }
    
    if (testsContainer) {
        // ... (function remains the same) ...
        if (!testsContainer.dataset.listenerAttached) {
            testsContainer.dataset.listenerAttached = 'true';
            testsContainer.addEventListener('click', (e) => {
                if (e.target && e.target.classList.contains('view-results-btn')) {
                    const testId = e.target.dataset.testid;
                    if (testId) {
                        const filtersToPass = {
                            department: departmentFilter.value,
                            year: yearFilter.value, // Pass the Study Year (e.g., "3")
                            subject: subjectFilter.value,
                            testId: testId,
                        };
                        
                        sessionStorage.setItem('viewScoresFilter', JSON.stringify(filtersToPass));
                        window.loadPage('view_score');
                    }
                }
            });
        }
    }

    // Initial setup
    populateMainFilters();
}