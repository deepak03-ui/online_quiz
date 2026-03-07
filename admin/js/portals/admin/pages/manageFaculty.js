// File: /js/portals/admin/pages/manageFaculty.js
// Final Combined Solution: Bulk Upload + Add/Edit Modal with Multi-selects AND Subjects/Sections
// --- FIX: Reads subjectCodes array AND subjectmap for names ---

import { db } from '../../../shared/firebase-config.js';
import { 
    doc, getDoc, collection, writeBatch, arrayUnion, query, where, orderBy, 
    startAfter, limit, getDocs, deleteDoc, setDoc, updateDoc 
} from "https://www.gstatic.com/firebasejs/9.10.0/firebase-firestore.js";

export function initManageFaculty() {
    const tableBody = document.getElementById('faculty-table-body');
    const contentArea = document.getElementById('dynamic-content-area') || document.body;

    let currentPageSize = 50; 
    let page = 1;
    let lastVisibleDoc = null;
    const prevButton = document.getElementById('faculty-prev-btn');
    const nextButton = document.getElementById('faculty-next-btn');
    const pageInfo = document.getElementById('faculty-page-info');
    const pageSizeSelect = document.getElementById('faculty-page-size-select');
    let appDataCache = null; // Cache for filters and modal
    let modalSubjectMapCache = {}; // Cache for the modal's subject map

    // --- (HELPER FUNCTIONS: From your original file) ---
    const calculateYearOfStudy = (graduationYear) => {
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

    /**
     * Helper to get values from a multiselect hidden input
     */
    const getValues = (id) => (document.getElementById(id)?.value || '').split(',').filter(Boolean);

    /**
     * Helper to disable/enable a custom multiselect dropdown
     */
    const setDropdownDisabled = (containerId, isDisabled, text = 'Select Dept/Year first') => {
        const container = document.getElementById(containerId);
        if (!container) return;
        const trigger = container.querySelector('.custom-multiselect-trigger');
        const displaySpan = container.querySelector('.custom-multiselect-trigger span');
        
        if (isDisabled) {
            container.classList.add('disabled');
            if(trigger) trigger.tabIndex = -1;
            if(displaySpan) {
                displaySpan.textContent = text;
                displaySpan.style.color = 'var(--text-secondary)';
            }
            resetMultiselect(containerId, text); // Also reset it
        } else {
            container.classList.remove('disabled');
            if(trigger) trigger.tabIndex = 0;
            // Don't reset text, let updateMultiselectDisplay handle it
        }
    };
    
    // --- (MODAL CREATION & MULTI-SELECT LOGIC) ---
    
    /**
     * Creates and appends the modal with multi-selects for Depts and Years.
     */
    const createAndAppendModal = () => {
        if (document.getElementById('faculty-manage-modal')) return;
        
        const modalHTML = `
            <div id="faculty-manage-modal" class="modal-backdrop" style="display:none;">
                <div class="modal-content">
                    <button type="button" class="modal-close-btn">&times;</button>
                    <h3 id="faculty-modal-title">Manage Faculty</h3>
                    <form id="faculty-modal-form">
                        <input type="hidden" id="faculty-modal-original-email" />
                        
                        <label for="faculty-modal-name">Name:</label>
                        <input type="text" id="faculty-modal-name" required />
                        
                        <label for="faculty-modal-email">Email:</label>
                        <input type="email" id="faculty-modal-email" required />
                        
                        <label for="faculty-modal-dept-display">Department(s):</label>
                        <div id="faculty-modal-dept-container" class="custom-multiselect-container">
                            <div class="custom-multiselect-trigger" tabindex="0">
                                <span id="faculty-modal-dept-display">Select departments...</span>
                            </div>
                            <div class="custom-multiselect-panel">
                                <div class="custom-multiselect-option" data-type="select-all-container">
                                    <input type="checkbox" class="faculty-select-all" />
                                    <span>Select All</span>
                                </div>
                            </div>
                        </div>
                        <input type="hidden" id="faculty-modal-departments" /> 
                        
                        <label for="faculty-modal-year-display">Year(s) (Study Year):</label>
                        <div id="faculty-modal-year-container" class="custom-multiselect-container">
                            <div class="custom-multiselect-trigger" tabindex="0">
                                <span id="faculty-modal-year-display">Select years...</span>
                            </div>
                            <div class="custom-multiselect-panel">
                                <div class="custom-multiselect-option" data-type="select-all-container">
                                    <input type="checkbox" class="faculty-select-all" />
                                    <span>Select All</span>
                                </div>
                            </div>
                        </div>
                        <input type="hidden" id="faculty-modal-years" /> 
                        
                        <hr style="border: none; border-top: 1px solid var(--border-color); margin: 1.5rem 0;">

                        <label for="faculty-modal-sections-display">Section(s):</label>
                        <div id="faculty-modal-sections-container" class="custom-multiselect-container disabled">
                            <div class="custom-multiselect-trigger" tabindex="-1">
                                <span id="faculty-modal-sections-display">Select Dept/Year first</span>
                            </div>
                            <div class="custom-multiselect-panel">
                                <div class="custom-multiselect-option" data-type="select-all-container">
                                    <input type="checkbox" class="faculty-select-all" />
                                    <span>Select All</span>
                                </div>
                            </div>
                        </div>
                        <input type="hidden" id="faculty-modal-sections" /> 

                        <label for="faculty-modal-subject-codes-display">Subject(s):</label>
                        <div id="faculty-modal-subject-codes-container" class="custom-multiselect-container disabled">
                            <div class="custom-multiselect-trigger" tabindex="-1">
                                <span id="faculty-modal-subject-codes-display">Select Dept/Year first</span>
                            </div>
                            <div class="custom-multiselect-panel">
                                <div class="custom-multiselect-option" data-type="select-all-container">
                                    <input type="checkbox" class="faculty-select-all" />
                                    <span>Select All</span>
                                </div>
                            </div>
                        </div>
                        <input type="hidden" id="faculty-modal-subject-codes" /> 

                        <input type="hidden" id="faculty-modal-subject-names" /> 
                        <p style="font-size: 0.9rem; color: #555; margin-top: 1rem; border-top: 1px solid var(--border-color); padding-top: 1rem;">
                            <strong>Note:</strong> Name, Email, Department, and Year are required.
                            Sections and Subjects can be added now or later.
                        </p>
                        
                        <div class="modal-actions">
                            <button type="button" id="faculty-modal-save-btn" class="btn-primary">Save</button>
                            <button type="button" id="faculty-modal-cancel-btn" class="btn-secondary">Cancel</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        contentArea.insertAdjacentHTML('beforeend', modalHTML);
    };

    /**
     * Populates a multiselect panel with checkbox options.
     */
    const populateMultiselectPanel = (containerId, options, labelPrefix = '') => {
        const panel = document.querySelector(`#${containerId} .custom-multiselect-panel`);
        if (!panel || !options) return;

        panel.querySelectorAll('.custom-multiselect-option:not([data-type="select-all-container"])').forEach(opt => opt.remove());

        (options.sort() || []).forEach(opt => {
            const optionId = `${containerId}-${opt.replace(/[^a-zA-Z0-9]/g, '')}`; 
            const optionHTML = `
                <div class="custom-multiselect-option">
                    <input type="checkbox" id="${optionId}" value="${opt}" data-type="option" />
                    <label for="${optionId}" style="flex: 1; cursor: pointer; margin-bottom: 0;">${labelPrefix}${opt}</label>
                </div>
            `;
            panel.insertAdjacentHTML('beforeend', optionHTML);
        });
    };

    /**
     * NEW: Populates the subject multiselect panel with "CODE - NAME".
     * This now accepts an array of codes and a map of names.
     */
    const populateSubjectMultiselectPanel = (containerId, codes, subjectMap) => {
        const panel = document.querySelector(`#${containerId} .custom-multiselect-panel`);
        if (!panel || !codes || !subjectMap) return;

        panel.querySelectorAll('.custom-multiselect-option:not([data-type="select-all-container"])').forEach(opt => opt.remove());
        
        const sortedCodes = codes.sort(); // Sort the codes array

        sortedCodes.forEach(code => {
            const name = subjectMap[code] || "Unknown Name"; // Find name in the map
            const optionId = `${containerId}-${code.replace(/[^a-zA-Z0-9]/g, '')}`; 
            // The VALUE is the code, the LABEL is "CODE - NAME"
            const optionHTML = `
                <div class="custom-multiselect-option">
                    <input type="checkbox" id="${optionId}" value="${code}" data-type="option" />
                    <label for="${optionId}" style="flex: 1; cursor: pointer; margin-bottom: 0;">${code} - ${name}</label>
                </div>
            `;
            panel.insertAdjacentHTML('beforeend', optionHTML);
        });
    };


    /**
     * Updates the display text and hidden input for a multiselect.
     */
    const updateMultiselectDisplay = (containerId, defaultText) => {
        const container = document.getElementById(containerId);
        if (!container) return;

        const allCheckboxes = container.querySelectorAll('input[data-type="option"]');
        const checkedCheckboxes = container.querySelectorAll('input[data-type="option"]:checked');
        const selectAllCheckbox = container.querySelector('.faculty-select-all');
        const displaySpan = container.querySelector('.custom-multiselect-trigger span');
        
        // --- This logic correctly finds the hidden input ID ---
        let hiddenInputId;
        if (containerId === 'faculty-modal-dept-container') {
            hiddenInputId = 'faculty-modal-departments';
        } else if (containerId === 'faculty-modal-year-container') {
            hiddenInputId = 'faculty-modal-years';
        } else {
            // This works for sections, subject-codes, and subject-names
            hiddenInputId = containerId.replace('-container', '');
        }
        
        const hiddenInput = document.getElementById(hiddenInputId);
        
        if (!hiddenInput || !displaySpan) {
            // Don't warn for subject-names, it's hidden and expected to fail
            if (hiddenInputId !== 'faculty-modal-subject-names') {
                console.warn("Could not find display/input for", containerId, "->", hiddenInputId);
            }
            return;
        }

        let selectedValues = [];
        let displayTexts = [];

        checkedCheckboxes.forEach(cb => {
            selectedValues.push(cb.value);
             // Add prefix for years display
            const prefix = containerId.includes('-year-') ? 'Year ' : '';
            
            // For subjects, find the full text from the label
            if (containerId.includes('-subject-codes-')) {
                 displayTexts.push(cb.nextElementSibling.textContent); // Get "CODE - NAME"
            } else {
                 displayTexts.push(prefix + cb.value); 
            }
        });

        if (displayTexts.length === 0) {
            displaySpan.textContent = defaultText;
            displaySpan.style.color = 'var(--text-secondary)';
        } else if (displayTexts.length > 2) { // Show count if more than 2 selected
             displaySpan.textContent = `${displayTexts.length} items selected`;
             displaySpan.style.color = 'var(--text-primary)';
        } else {
            displaySpan.textContent = displayTexts.join(', ');
            displaySpan.style.color = 'var(--text-primary)';
        }

        hiddenInput.value = selectedValues.join(',');

        if (checkedCheckboxes.length === allCheckboxes.length && allCheckboxes.length > 0) {
            selectAllCheckbox.checked = true;
            selectAllCheckbox.indeterminate = false;
        } else if (checkedCheckboxes.length > 0) {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = true;
        } else {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = false;
        }
    };

    /**
     * Resets a multiselect to its default state.
     */
    const resetMultiselect = (containerId, defaultText) => {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
        updateMultiselectDisplay(containerId, defaultText);
        container.classList.remove('open');
    };

    /**
     * Sets the checked state of a multiselect based on an array of values.
     */
    const setMultiselectValues = (containerId, values, defaultText) => {
        resetMultiselect(containerId, defaultText); 
        if (!Array.isArray(values)) return;
        
        values.forEach(val => {
            // Need to handle potential non-string values just in case
            const safeVal = String(val); 
            const checkbox = document.querySelector(`#${containerId} input[value="${safeVal}"]`);
            if (checkbox) checkbox.checked = true;
        });
        updateMultiselectDisplay(containerId, defaultText);
    };

    /**
     * Fetches and populates the dependent dropdowns (sections, codes, names)
     * based on selected departments and study years.
     */
    const fetchAndPopulateModalDropdowns = async (departments, studyYears) => {
        try {
            const sectionPromises = [];
            const subjectPromises = [];
            modalSubjectMapCache = {}; // Clear cache

            departments.forEach(dept => {
                studyYears.forEach(studyYear => {
                    // 1. Subject query (doc ID: DEPT_STUDYYEAR, e.g., "ADS_3")
                    subjectPromises.push(getDoc(doc(db, 'subjects', `${dept}_${studyYear}`)));

                    // 2. Section query (doc ID: DEPT_GRADYEAR, e.g., "ADS_2027")
                    const gradYear = getGraduationYearFromStudyYear(studyYear);
                    if (gradYear) {
                        sectionPromises.push(getDoc(doc(db, 'assignments', `${dept}_${gradYear}`)));
                    }
                });
            });

            const allSections = new Set();
            const combinedSubjectMap = {};
            const allSubjectCodes = new Set(); // <-- FIX: Create a Set for codes
            
            // Process Subjects
            const subjectSnapshots = await Promise.all(subjectPromises);
            subjectSnapshots.forEach(snap => {
                if (snap.exists()) {
                    const data = snap.data();
                    
                    // --- THIS IS THE FIX ---
                    // Your Firestore data has 'subjectMap' (uppercase 'M')
                    const subjectMap = data.subjectMap || {}; // <-- Use uppercase 'M'
                    // --- END OF FIX ---

                    const subjectCodes = data.subjectCodes || []; // <-- FIX: Get the codes array
                    
                    Object.assign(combinedSubjectMap, subjectMap); // Merge all found subject maps
                    subjectCodes.forEach(code => allSubjectCodes.add(code)); // <-- FIX: Add codes to the Set
                }
            });

            // Cache the combined map for saving later
            modalSubjectMapCache = combinedSubjectMap;

            // Process Sections
            const sectionSnapshots = await Promise.all(sectionPromises);
            sectionSnapshots.forEach(snap => {
                if (snap.exists()) {
                    const data = snap.data();
                    (data.sections || []).forEach(sec => allSections.add(sec));
                }
            });

            // Populate and enable Sections
            const sectionsArray = Array.from(allSections);
            populateMultiselectPanel('faculty-modal-sections-container', sectionsArray);
            setDropdownDisabled('faculty-modal-sections-container', false);
            updateMultiselectDisplay('faculty-modal-sections-container', sectionsArray.length > 0 ? 'Select sections...' : 'No sections found');
            
            // Populate and enable Subject Codes (now with names)
            const codesArray = Array.from(allSubjectCodes); // <-- FIX: Use the array of codes
            populateSubjectMultiselectPanel('faculty-modal-subject-codes-container', codesArray, modalSubjectMapCache); // <-- FIX: Pass codes AND map
            setDropdownDisabled('faculty-modal-subject-codes-container', false);
            updateMultiselectDisplay('faculty-modal-subject-codes-container', codesArray.length > 0 ? 'Select subjects...' : 'No subjects found');
            
            // Disable the old subject names container
            setDropdownDisabled('faculty-modal-subject-names-container', true, 'N/A');


        } catch (error) {
            console.error("Error loading modal dropdowns:", error);
            setDropdownDisabled('faculty-modal-sections-container', true, 'Error loading');
            setDropdownDisabled('faculty-modal-subject-codes-container', true, 'Error loading');
            setDropdownDisabled('faculty-modal-subject-names-container', true, 'Error loading');
        }
    };

    const showAddFacultyModal = () => {
        document.getElementById('faculty-modal-form').reset();
        document.getElementById('faculty-modal-title').textContent = 'Add New Faculty';
        document.getElementById('faculty-modal-email').disabled = false;
        document.getElementById('faculty-modal-original-email').value = '';
        modalSubjectMapCache = {}; // Clear cache
        
        // Populate all dropdowns
        populateMultiselectPanel('faculty-modal-dept-container', appDataCache.departments);
        populateMultiselectPanel('faculty-modal-year-container', appDataCache.years, 'Year '); // appDataCache.years holds Study Years
        
        // Reset all dropdowns
        resetMultiselect('faculty-modal-dept-container', 'Select departments...');
        resetMultiselect('faculty-modal-year-container', 'Select years...');

        // Disable dependent dropdowns
        setDropdownDisabled('faculty-modal-sections-container', true, 'Select Dept/Year first');
        setDropdownDisabled('faculty-modal-subject-codes-container', true, 'Select Dept/Year first');
        setDropdownDisabled('faculty-modal-subject-names-container', true, 'N/A');
        
        document.getElementById('faculty-manage-modal').style.display = 'flex';
    };

    const showEditFacultyModal = async (data) => {
        document.getElementById('faculty-modal-form').reset();
        document.getElementById('faculty-modal-title').textContent = 'Edit Faculty';
        modalSubjectMapCache = {}; // Clear cache
        
        document.getElementById('faculty-modal-original-email').value = data.id;
        document.getElementById('faculty-modal-name').value = data.name || '';
        document.getElementById('faculty-modal-email').value = data.id || '';
        
        // --- THIS IS THE FIX ---
        document.getElementById('faculty-modal-email').disabled = false; // Was true
        // --- END OF FIX ---

        // Populate all dropdowns first
        populateMultiselectPanel('faculty-modal-dept-container', appDataCache.departments);
        populateMultiselectPanel('faculty-modal-year-container', appDataCache.years, 'Year ');

        // Set the saved values
        const toArray = (val) => Array.isArray(val) ? val : (val ? String(val).split(',').map(s => s.trim()).filter(Boolean) : []);
        
        const depts = toArray(data.departments);
        const gradYears = toArray(data.years); // data-years should contain "2027, 2028"
        const studyYears = gradYears.map(calculateYearOfStudy).filter(y => y !== 'N/A'); // Convert to ["3", "4"]
        
        setMultiselectValues('faculty-modal-dept-container', depts, 'Select departments...');
        setMultiselectValues('faculty-modal-year-container', studyYears, 'Select years...');
        
        document.getElementById('faculty-manage-modal').style.display = 'flex';

        // --- NEW: Load dependent dropdowns and set their values ---
        setDropdownDisabled('faculty-modal-sections-container', true, 'Loading sections...');
        setDropdownDisabled('faculty-modal-subject-codes-container', true, 'Loading subjects...');
        setDropdownDisabled('faculty-modal-subject-names-container', true, 'N/A');

        if (depts.length > 0 && studyYears.length > 0) {
            // Load the options based on saved Depts/Years
            // This will populate modalSubjectMapCache
            await fetchAndPopulateModalDropdowns(depts, studyYears);

            // NOW set the saved values for the dependent dropdowns
            setMultiselectValues('faculty-modal-sections-container', toArray(data.sections), 'Select sections...');
            // Set selected subject codes. The names will display automatically.
            setMultiselectValues('faculty-modal-subject-codes-container', toArray(data.subjectCodes), 'Select subjects...');
        } else {
            // If no dept/year was saved, just leave them disabled
            setDropdownDisabled('faculty-modal-sections-container', true, 'Select Dept/Year first');
            setDropdownDisabled('faculty-modal-subject-codes-container', true, 'Select Dept/Year first');
        }
    };

    const hideFacultyModal = () => {
        const modal = document.getElementById('faculty-manage-modal');
         if (modal) {
             modal.style.display = 'none';
         }
        document.querySelectorAll('.custom-multiselect-container.open').forEach(c => c.classList.remove('open'));
    };

    const saveFaculty = async () => {
        const originalEmail = document.getElementById('faculty-modal-original-email').value;
        const email = document.getElementById('faculty-modal-email').value.toLowerCase().trim();
        const name = document.getElementById('faculty-modal-name').value.trim();
        
        // Note: getValues() is now a global helper
        const departments = getValues('faculty-modal-departments');
        const studyYears = getValues('faculty-modal-years'); // e.g., ["1", "2"]
        
        // Get new fields from their hidden inputs
        const sections = getValues('faculty-modal-sections');
        const subjectCodes = getValues('faculty-modal-subject-codes');
        
        // --- Automatically find names from the cached map ---
        const subjectNames = subjectCodes.map(code => {
            return modalSubjectMapCache[code] || null; // Find name from cache
        }).filter(Boolean); // Filter out any nulls


        if (!email || !name || departments.length === 0 || studyYears.length === 0) {
            alert('Name, Email, at least one Department, and at least one Year are required.');
            return;
        }

        // Convert Study Years to Graduation Years to store consistently
        const graduationYears = studyYears.map(getGraduationYearFromStudyYear).filter(Boolean);
        if (graduationYears.length !== studyYears.length) {
             alert('Invalid year selection detected. Could not convert all study years to graduation years.');
             return;
        }

        // Prepare data matching the bulk upload structure
        const facultyData = {
            name, email, role: 'faculty',
            departments, 
            years: graduationYears, // Saves Graduation Years, e.g., ["2027", "2028"]
            sections,
            subjectCodes,
            subjectName: subjectNames // Firestore key is subjectName
        };

        const isEditing = !!originalEmail;
        const emailChanged = isEditing && (originalEmail !== email);
        
        try {
            // --- THIS IS THE FIX ---
            // If email changed, we must check if the new email already exists
            // This check must happen *before* the batch write
            if (emailChanged) {
                const newDocRef = doc(db, 'users', email);
                const newDocSnap = await getDoc(newDocRef);
                if (newDocSnap.exists()) {
                    alert(`Error: A user with the new email "${email}" already exists. Cannot update.`);
                    return;
                }
            }
            
            const batch = writeBatch(db);

            if (emailChanged) {
                // Email has changed: Delete old doc, create new one
                const oldDocRef = doc(db, 'users', originalEmail);
                const newDocRef = doc(db, 'users', email);
                
                batch.delete(oldDocRef);
                batch.set(newDocRef, facultyData); // It's a new doc, so no merge needed
            } else {
                // Email is the same (or it's a new user): Set/merge on the docId
                const docId = isEditing ? originalEmail : email;
                batch.set(doc(db, 'users', docId), facultyData, { merge: true }); 
            }
            // --- END OF FIX ---

            // Update metadata
            const metadataRef = doc(db, 'metadata', 'appData');
            batch.set(metadataRef, {
                departments: arrayUnion(...departments),
                years: arrayUnion(...studyYears) // Save Study Years to metadata
            }, { merge: true });

            await batch.commit();
            
            alert(`Faculty ${isEditing ? 'updated' : 'added'} successfully!`);
            hideFacultyModal();
            await fetchAppData(); // Re-fetch cache
            await renderFaculty(getFacultyFilters()); // Refresh the table
        } catch (error) {
            console.error('Error saving faculty:', error);
            alert('An error occurred while saving. Check console.');
        }
    };

    /**
     * Fetches metadata (depts, years) from Firestore.
     */
    const fetchAppData = async () => {
        try {
            const metadataRef = doc(db, 'metadata', 'appData');
            const metadataSnap = await getDoc(metadataRef);
            if (metadataSnap.exists()) {
                appDataCache = metadataSnap.data();
                if (!appDataCache.departments) appDataCache.departments = [];
                if (!appDataCache.years) appDataCache.years = []; // These are Study Years
            } else {
                 appDataCache = { departments: [], years: [] };
            }
        } catch (err) {
            console.error("Error fetching app data:", err);
            appDataCache = { departments: [], years: [] };
        }
        // Always populate filters, even if cache is empty
        populateFacultyFilters(); 
    };
    

    // --- (BULK UPLOAD & FILTER LOGIC - From original file) ---

    // Reads from the faculty filter card
    const getFacultyFilters = () => ({
        department: (document.getElementById('faculty-filter-department') || {}).value || '',
        name: (document.getElementById('faculty-filter-name') || {}).value?.trim().toLowerCase() || '',
        year: (document.getElementById('faculty-filter-year') || {}).value || '',
        subject: (document.getElementById('faculty-filter-subject') || {}).value || ''
    });

    const applyFilters = () => {
        page = 1;
        lastVisibleDoc = null;
        renderFaculty(getFacultyFilters(), 'first');
    };

    const clearFilters = () => {
        document.querySelectorAll('.filter-card input, .filter-card select').forEach(el => el.value = '');
        
        const subjectCodeSelect = document.getElementById('faculty-filter-subject');
        if (subjectCodeSelect) {
            subjectCodeSelect.innerHTML = '<option value="">Select Dept & Year</option>';
            subjectCodeSelect.disabled = true;
        }
        
        if (pageSizeSelect) pageSizeSelect.value = 50;
        currentPageSize = 50;
        if (tableBody) {
            tableBody.innerHTML = '<tr><td colspan="9" style="text-align:center;">Please use filters to view faculty assignments.</td></tr>';
        }
    };

    /**
     * This is the BULK UPLOAD function from your original file.
     */
    const handleBulkUpload = () => {
        const fileInput = document.getElementById('faculty-file-upload'); 
        if (typeof XLSX === 'undefined') return alert('XLSX library not loaded.');
        if (!fileInput || fileInput.files.length === 0) return alert('Please select a file.');
        
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const data = new Uint8Array(event.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                const rows = XLSX.utils.sheet_to_json(worksheet);
                if (rows.length === 0) return alert("File is empty.");
                alert(`Found ${rows.length} records. Processing...`);
    
                const batch = writeBatch(db);
                const assignmentsData = {};
                const allDepts = new Set(), allYears = new Set(); // allYears stores Study Years
                
                const splitToArray = (value) => value ? String(value).split(',').map(s => s.trim()).filter(Boolean) : [];
                
                const facultyCounts = {};
    
                rows.forEach(row => {
                    const email = (row.email || '').toLowerCase().trim();
                    if (!email) return;
                    
                    const graduationYears = splitToArray(row.year); 
                    const departments = splitToArray(row.department);
                    const sections = splitToArray(row.section);
                    const subjectCodes = splitToArray(row.subjectCode);
                    const subjectNames = splitToArray(row.subjectName);
                    
                    // Validate data structure slightly
                    if(graduationYears.length === 0 || departments.length === 0) {
                         console.warn(`Skipping row for ${email}: Missing department or year.`);
                         return;
                    }

                    const facultyData = { 
                        role: 'faculty', 
                        name: row.name || null, 
                        email: email, 
                        departments, 
                        years: graduationYears, // Saves Graduation Years
                        sections, 
                        subjectCodes, 
                        subjectName: subjectNames 
                    };
                    batch.set(doc(db, 'users', email), facultyData, { merge: true });
    
                    // --- Update 'assignments' collection ---
                    departments.forEach(dept => {
                        graduationYears.forEach(gradYear => {
                            const key = `${dept}_${gradYear}`; 
                            if (!assignmentsData[key]) assignmentsData[key] = { sections: new Set(), subjects: new Set() };
                            sections.forEach(s => assignmentsData[key].sections.add(s));
                            subjectCodes.forEach(s => assignmentsData[key].subjects.add(s));
    
                            sections.forEach(section => {
                                const countKey = `${dept}_${gradYear}_${section}`;
                                facultyCounts[countKey] = (facultyCounts[countKey] || 0) + 1;
                            });
                            const studyYear = calculateYearOfStudy(gradYear);
                            if(studyYear !== 'N/A') allYears.add(studyYear);
                        });
                    });
                    departments.forEach(d => allDepts.add(d));
                });
    
                // Build payload for 'assignments' collection
                const finalAssignmentsPayload = {};
                for (const key in assignmentsData) {
                    if (!finalAssignmentsPayload[key]) finalAssignmentsPayload[key] = {};
                    finalAssignmentsPayload[key].sections = arrayUnion(...Array.from(assignmentsData[key].sections));
                    finalAssignmentsPayload[key].subjects = arrayUnion(...Array.from(assignmentsData[key].subjects));
                }
                for (const countKey in facultyCounts) {
                    const count = facultyCounts[countKey];
                    const parts = countKey.split('_');
                    const docId = `${parts[0]}_${parts[1]}`;
                    
                    if (!finalAssignmentsPayload[docId]) finalAssignmentsPayload[docId] = {};
                    if (!finalAssignmentsPayload[docId].facultycount) {
                        finalAssignmentsPayload[docId].facultycount = {};
                    }
                    finalAssignmentsPayload[docId].facultycount[countKey] = count;
                }
                for (const docId in finalAssignmentsPayload) {
                    const assignmentDocRef = doc(db, 'assignments', docId);
                    batch.set(assignmentDocRef, finalAssignmentsPayload[docId], { merge: true });
                }
    
                // Update metadata
                batch.set(doc(db, 'metadata', 'appData'), { 
                    departments: arrayUnion(...allDepts), 
                    years: arrayUnion(...allYears) // Saves Study Years
                }, { merge: true });
                
                await batch.commit();
                alert(`Successfully processed ${rows.length} faculty records!`);
                fileInput.value = '';
                document.getElementById('faculty-bulk-upload-section').style.display = 'none';
                await fetchAppData(); // Re-fetch cache
                applyFilters();
            } catch (error) {
                console.error("Error processing faculty bulk upload:", error);
                alert(`An error occurred during upload. ${error.message}. Check console for details.`);
            }
        };
        reader.readAsArrayBuffer(fileInput.files[0]);
    };

    const populateSubjectCodeDropdown = (codes = [], selectElement, defaultText = "N/A") => {
        if (!selectElement) return;
        selectElement.innerHTML = ''; 
        if (codes.length === 0) {
            selectElement.disabled = true;
            selectElement.innerHTML = `<option value="">${defaultText}</option>`;
        } else {
            selectElement.disabled = false;
            selectElement.innerHTML = `<option value="">All Codes</option>`;
            codes.sort().forEach(code => {
                selectElement.innerHTML += `<option value="${code}">${code}</option>`;
            });
        }
    };

    const loadSubjectCodesForFilter = async () => {
        const subjectCodeSelect = document.getElementById('faculty-filter-subject');
        const dept = (document.getElementById('faculty-filter-department') || {}).value;
        const studyYear = (document.getElementById('faculty-filter-year') || {}).value; // Filter uses Study Year

        if (dept && studyYear) {
            try {
                // Assumes subjects collection uses Study Year in ID (e.g., ADS_3)
                const docId = `${dept}_${studyYear}`;
                const docRef = doc(db, 'subjects', docId);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const data = docSnap.data();
                    // This is correct, filter only needs the codes
                    const codes = data.subjectCodes || []; 
                    populateSubjectCodeDropdown(codes, subjectCodeSelect, "No codes found");
                } else {
                    populateSubjectCodeDropdown([], subjectCodeSelect, "No codes found");
                }
            } catch (error) {
                console.error("Error fetching subject codes for filter:", error);
                populateSubjectCodeDropdown([], subjectCodeSelect, "Error loading");
            }
        } else {
            populateSubjectCodeDropdown([], subjectCodeSelect, "Select Dept & Year");
        }
    };

    const populateFacultyFilters = () => {
        if (!appDataCache) return;
        const populateSelect = (elId, options, label) => {
            const selectEl = document.getElementById(elId);
            if (selectEl) {
                selectEl.innerHTML = `<option value="">All ${label}</option>`;
                (options?.sort() || []).forEach(opt => selectEl.innerHTML += `<option value="${opt}">${opt}</option>`);
            }
        };
        populateSelect('faculty-filter-department', appDataCache.departments, 'Departments');
        populateSelect('faculty-filter-year', appDataCache.years, 'Years'); // Filter uses Study Years
        
        const subjectCodeSelect = document.getElementById('faculty-filter-subject');
        if (subjectCodeSelect) {
            subjectCodeSelect.innerHTML = '<option value="">Select Dept & Year</option>';
            subjectCodeSelect.disabled = true;
        }
    };

    const renderFaculty = async (filters = {}, direction = 'first') => {
        try {
            if (tableBody) tableBody.innerHTML = '<tr><td colspan="9" style="text-align:center;">Loading...</td></tr>';
            if (direction === 'first') { page = 1; lastVisibleDoc = null; }

            let qConstraints = [where('role', '==', 'faculty')];
            
            // Query using array-contains for compatibility with both systems
            if (filters.department) {
                qConstraints.push(where('departments', 'array-contains', filters.department));
            }
            if (filters.subject) {
                qConstraints.push(where('subjectCodes', 'array-contains', filters.subject));
            }
            
            // Filter by year requires converting Study Year to Graduation Year
            if (filters.year) { 
                const gradYear = getGraduationYearFromStudyYear(filters.year);
                if (gradYear) {
                    qConstraints.push(where('years', 'array-contains', gradYear));
                } else {
                     // Invalid year selected, show no results
                     console.warn("Invalid study year filter:", filters.year);
                     renderTable([]);
                     updatePaginationUI(false);
                     return; 
                }
            }
            
            qConstraints.push(orderBy('email'));
            if (direction === 'next' && lastVisibleDoc) qConstraints.push(startAfter(lastVisibleDoc));
            qConstraints.push(limit(currentPageSize));

            const q = query(collection(db, 'users'), ...qConstraints);
            const snapshot = await getDocs(q);

            lastVisibleDoc = snapshot.docs[snapshot.docs.length - 1] || null;
            let facultyList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // Client-side filtering for name
            facultyList = facultyList.filter(item => {
                const nameMatch = !filters.name || (item.name && item.name.toLowerCase().includes(filters.name));
                return nameMatch;
            });

            renderTable(facultyList);
            updatePaginationUI(snapshot.size >= currentPageSize);
        } catch (error) {
            console.error("[faculty] Error fetching faculty assignments: ", error);
             if (tableBody && error.code === 'failed-precondition') {
                 tableBody.innerHTML = '<tr><td colspan="9" class="text-center text-red-500" style="color: red; text-align: center;"><b>Query Error:</b> A database index is required. Please check the Firestore console for an index creation link.</td></tr>';
            } else if (tableBody) {
                 tableBody.innerHTML = `<tr><td colspan="9" style="text-align:center; color: red;">Error: ${error.message}</td></tr>`;
            }
        }
    };

    const renderTable = (facultyList) => {
        if (!tableBody) return;
        tableBody.innerHTML = '';
        if (!facultyList || facultyList.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="9" style="text-align:center;">No faculty assignments found.</td></tr>';
            return;
        }
        
        const displayArray = (field) => Array.isArray(field) ? field.join(', ') : (field || 'N/A');
        
        facultyList.forEach((item, index) => {
            const row = document.createElement('tr');
            const sno = (page - 1) * currentPageSize + index + 1;
            
            // Convert Graduation Years to Study Years for display
            const displayYears = Array.isArray(item.years) 
                ? item.years.map(y => calculateYearOfStudy(y)).filter(y => y !== 'N/A').join(', ') 
                : 'N/A';
            
            // Prepare data attributes for edit button
            const dataYears = Array.isArray(item.years) ? item.years.join(',') : '';
            const dataDepts = Array.isArray(item.departments) ? item.departments.join(',') : '';
            const dataSections = Array.isArray(item.sections) ? item.sections.join(',') : '';
            const dataSubjectCodes = Array.isArray(item.subjectCodes) ? item.subjectCodes.join(',') : '';
            const dataSubjectName = Array.isArray(item.subjectName) ? item.subjectName.join(',') : ''; // Firestore key is subjectName

            row.innerHTML = `
                <td>${sno}</td>
                <td>${item.name || 'N/A'}</td>
                <td>${displayArray(item.departments)}</td>
                <td>${displayYears}</td> 
                <td>${displayArray(item.sections)}</td>
                <td>${displayArray(item.subjectCodes)}</td>
                <td>${displayArray(item.subjectName)}</td>
                <td>${item.email || 'N/A'}</td>
                <td>
                    <div class="table-actions">
                        <button class="btn-edit-secondary" 
                            data-id="${item.id}" 
                            data-name="${item.name || ''}" 
                            data-departments="${dataDepts}" 
                            data-years="${dataYears}"
                            data-sections="${dataSections}"
                            data-subject-codes="${dataSubjectCodes}"
                            data-subject-name="${dataSubjectName}">
                            Edit
                        </button>
                        <button class="btn-delete-secondary" data-id="${item.id}" data-name="${item.name || 'N/A'}">Delete</button>
                    </div>
                </td>`;
            tableBody.appendChild(row);
        });
    };
    
    const updatePaginationUI = (hasNextPage) => {
        if (pageInfo) pageInfo.textContent = `Page ${page}`;
        if (prevButton) prevButton.disabled = page === 1;
        if (nextButton) nextButton.disabled = !hasNextPage;
    };


    // --- (EVENT LISTENERS) ---
    
    document.getElementById('faculty-apply-filter-btn')?.addEventListener('click', applyFilters);
    document.getElementById('faculty-clear-filter-btn')?.addEventListener('click', clearFilters);
    prevButton?.addEventListener('click', () => { if (page > 1) { page--; renderFaculty(getFacultyFilters(), 'prev'); } });
    nextButton?.addEventListener('click', () => { page++; renderFaculty(getFacultyFilters(), 'next'); });
    pageSizeSelect?.addEventListener('change', (e) => {
        currentPageSize = parseInt(e.target.value, 10);
        applyFilters();
    });

    const filterArea = document.querySelector('.filter-card'); 
    filterArea?.addEventListener('change', (e) => {
        const target = e.target;
        if (target.id === 'faculty-filter-year' || target.id === 'faculty-filter-department') {
            loadSubjectCodesForFilter();
        }
    });

    // Global listener to close multiselects when clicking outside
    document.addEventListener('click', (e) => {
        const openContainer = document.querySelector('#faculty-manage-modal .custom-multiselect-container.open');
        if (openContainer && !openContainer.contains(e.target) && !e.target.closest('button')) {
             openContainer.classList.remove('open');
        }
    });

    contentArea?.addEventListener('click', async (e) => {
        const target = e.target;
        const button = e.target.closest('button');

        // Close modal if backdrop clicked
        if (!button && target.id === 'faculty-manage-modal') {
             hideFacultyModal();
             return;
        }
        
        // Handle multiselect trigger clicks
        const trigger = target.closest('.custom-multiselect-trigger');
         if (trigger) {
             e.preventDefault();
             const container = trigger.closest('.custom-multiselect-container');
             if (container.classList.contains('disabled')) return; // Do nothing if disabled

             // Close other open dropdowns first
             const otherOpen = document.querySelector('#faculty-manage-modal .custom-multiselect-container.open');
             if(otherOpen && otherOpen !== container) {
                 otherOpen.classList.remove('open');
             }
             container.classList.toggle('open');
             return; // Don't process as a button click
         }

        if (!button) return; // Ignore clicks not on buttons or triggers

        // --- Button Click Logic ---
        switch (button.id) {
            case 'add-faculty-btn':
                showAddFacultyModal();
                break;
            case 'faculty-modal-save-btn':
                await saveFaculty();
                break;
            case 'faculty-modal-cancel-btn':
                 hideFacultyModal();
                 break;
            case 'show-faculty-upload-btn':
                document.getElementById('faculty-bulk-upload-section').style.display = 'block';
                break;
            case 'download-faculty-template-btn':
                { // Use block scope for const/let
                    const headers = [['name', 'email', 'department', 'year', 'section', 'subjectCode', 'subjectName']];
                    const ws = XLSX.utils.aoa_to_sheet(headers);
                    const wb = XLSX.utils.book_new();
                    XLSX.utils.book_append_sheet(wb, ws, 'Template');
                    XLSX.writeFile(wb, 'faculty_assignment_template.xlsx');
                }
                break;
            case 'faculty-upload-button':
                handleBulkUpload();
                break;
            case 'delete-filtered-faculty-btn':
                alert('This function is disabled for faculty data to prevent errors.\n\nFaculty members can teach in multiple departments. A bulk delete is unsafe.\n\nPlease delete faculty one-by-one using the "Delete" button in each row.');
                break;
        }
        
        // Check for specific button classes
        if (button.classList.contains('modal-close-btn')) {
             hideFacultyModal();
        }

        if (button.classList.contains('btn-edit-secondary')) {
            await showEditFacultyModal(button.dataset); // Must be awaited
        }
        
        if (button.classList.contains('btn-delete-secondary')) {
            const id = button.dataset.id;
            const name = button.dataset.name;
            if (confirm(`Are you sure you want to delete ${name}? This will remove all their assignments.`)) {
                try {
                    // TODO: Optionally decrement faculty counts in 'assignments' collection (complex)
                    await deleteDoc(doc(db, 'users', id));
                    alert('Faculty deleted successfully.');
                    applyFilters(); 
                } catch (err) {
                    console.error('[faculty] delete error', err);
                    alert('Failed to delete assignment.');
                }
            }
        }
    });
    
    // Change listener for modal checkboxes
    contentArea.addEventListener('change', (e) => {
        const target = e.target;
        
        // Handle checkbox changes in multiselect within the modal
        if (target.type === 'checkbox' && target.closest('#faculty-manage-modal .custom-multiselect-container')) {
            const container = target.closest('.custom-multiselect-container');
            const containerId = container.id;
            const selectAll = target.classList.contains('faculty-select-all');
            const allOptions = container.querySelectorAll('input[data-type="option"]');
            
            // Get default text from the span within the specific container's trigger
            let defaultText = 'Select items...'; // Generic default
            if (containerId.includes('-dept-')) defaultText = 'Select departments...';
            if (containerId.includes('-year-')) defaultText = 'Select years...';
            if (containerId.includes('-sections-')) defaultText = 'Select sections...';
            if (containerId.includes('-subject-codes-')) defaultText = 'Select subjects...';
            // (subject-names case removed)

            if (selectAll) {
                allOptions.forEach(opt => opt.checked = target.checked);
            }
            updateMultiselectDisplay(containerId, defaultText);

            // --- NEW: Trigger reload of dependent dropdowns ---
            if (containerId === 'faculty-modal-dept-container' || containerId === 'faculty-modal-year-container') {
                // Get selected values
                const selectedDepts = getValues('faculty-modal-departments');
                const selectedStudyYears = getValues('faculty-modal-years');
                
                // Reset dependent dropdowns to loading/disabled state
                setDropdownDisabled('faculty-modal-sections-container', true, 'Select Dept/Year first');
                setDropdownDisabled('faculty-modal-subject-codes-container', true, 'Select Dept/Year first');
                setDropdownDisabled('faculty-modal-subject-names-container', true, 'N/A');

                // Fetch new data if inputs are valid
                if (selectedDepts.length > 0 && selectedStudyYears.length > 0) {
                    // Set to loading
                    setDropdownDisabled('faculty-modal-sections-container', true, 'Loading sections...');
                    setDropdownDisabled('faculty-modal-subject-codes-container', true, 'Loading subjects...');
                    
                    // Call the actual fetch function
                    fetchAndPopulateModalDropdowns(selectedDepts, selectedStudyYears);
                }
            }
        }
    });

    // --- Initial Load ---
    createAndAppendModal();
    (async () => {
        await fetchAppData(); // Fetch data needed for filters and modal
        
        // --- MODIFICATION ---
        // Set the initial table message instead of fetching data
        if (tableBody) {
            tableBody.innerHTML = '<tr><td colspan="9" style="text-align:center;">Please use filters to view faculty assignments.</td></tr>';
        }
        updatePaginationUI(false); // Ensure pagination is disabled
        // renderFaculty(getFacultyFilters(), 'first'); // <-- This line was REMOVED to prevent initial load
        // --- END MODIFICATION ---
    })();
}