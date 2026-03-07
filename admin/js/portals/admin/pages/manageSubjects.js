// File: /js/portals/admin/pages/manageSubjects.js
// --- MODIFICATION: Implements dependent dropdown for Subject Codes ---

import { db } from '../../../shared/firebase-config.js';
import { doc, getDoc, collection, writeBatch, arrayUnion, query, where, getDocs, deleteDoc, setDoc, FieldValue } from "https://www.gstatic.com/firebasejs/9.10.0/firebase-firestore.js"; // Import FieldValue if needed for delete

export function initManageSubjects() {
    const tableBody = document.getElementById('subjects-table-body');
    const listenerArea = document.getElementById('dynamic-content-area') || document.body;

    // --- HELPER: Converts Graduation Year (e.g., "2027") to Study Year (e.g., "3") ---
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
    
    const getSubjectFilters = () => ({
        year: (document.getElementById('filter-year') || {}).value || '',
        department: (document.getElementById('filter-department') || {}).value || '',
        subjectCode: (document.getElementById('filter-subject-code') || {}).value || '',
    });
    
    const applyFilters = () => {
        renderSubjects(getSubjectFilters());
    };

    // --- MODIFIED ---: Now also resets the subject code dropdown
    const clearFilters = () => {
        document.querySelectorAll('.filter-card input, .filter-card select').forEach(el => el.value = '');
        
        // --- NEW ---: Reset the subject code dropdown to its disabled state
        const subjectCodeSelect = document.getElementById('filter-subject-code');
        if (subjectCodeSelect) {
            subjectCodeSelect.innerHTML = '<option value="">Select Dept & Year</option>';
            subjectCodeSelect.disabled = true;
        }

        if (tableBody) tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Please use filters to view subjects.</td></tr>';
    };

    // --- Uploader for the Master Subject List ---
    // --- MODIFIED ---: Removed the master 'subjectCodes' array from metadata write
    const handleMasterUpload = () => {
        const fileInput = document.getElementById('master-subject-upload'); 
        if (typeof XLSX === 'undefined') return alert('XLSX library not loaded.');
        if (!fileInput || fileInput.files.length === 0) return alert('Please select a file.');
        
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                // ... (workbook and rows logic is the same) ...
                const data = new Uint8Array(event.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                const rows = XLSX.utils.sheet_to_json(worksheet);
                if (rows.length === 0) return alert("File is empty.");
                alert(`Found ${rows.length} subjects. Processing...`);
    
                const batch = writeBatch(db);
                const allDepts = new Set(), allStudyYears = new Set();
                const subjectsPerDoc = {}; 

                rows.forEach(row => {
                    // ... (logic for parsing rows is the same) ...
                    const subjectCode = String(row.subjectCode || '').trim();
                    const department = String(row.department || '').trim();
                    const studyYear = String(row.year || '').trim();
                    const subjectName = String(row.subjectName || '').trim();
                    if (!subjectCode || !department || !studyYear) return;
                    const docId = `${department}_${studyYear}`;

                    if (!subjectsPerDoc[docId]) {
                        subjectsPerDoc[docId] = {
                            department: department,
                            year: studyYear,
                            subjectMap: {},
                            subjectCodes: []
                        };
                    }
                    subjectsPerDoc[docId].subjectMap[subjectCode] = subjectName;
                    if (!subjectsPerDoc[docId].subjectCodes.includes(subjectCode)) {
                        subjectsPerDoc[docId].subjectCodes.push(subjectCode);
                    }
                    allDepts.add(department);
                    allStudyYears.add(studyYear);
                });
                
                // ... (Loop to write to batch is the same) ...
                for (const docId in subjectsPerDoc) {
                    const docData = subjectsPerDoc[docId];
                    const docRef = doc(db, 'subjects', docId);
                    batch.set(docRef, {
                        department: docData.department,
                        year: docData.year,
                        subjectMap: docData.subjectMap,
                        subjectCodes: arrayUnion(...docData.subjectCodes)
                    }, { merge: true });
                }
    
                // --- MODIFIED ---: We no longer save a master 'subjectCodes' array to metadata
                batch.set(doc(db, 'metadata', 'appData'), { 
                    departments: arrayUnion(...allDepts), 
                    years: arrayUnion(...allStudyYears)
                }, { merge: true });
                
                await batch.commit();
                alert(`Successfully uploaded/updated ${rows.length} subjects to the master list!`);
                fileInput.value = '';
                document.getElementById('master-upload-section').style.display = 'none';
                populateFilters();
                applyFilters();
            } catch (error) {
                console.error("Error processing master subject upload:", error);
                alert("An error occurred during upload. Check console for details.");
            }
        };
        reader.readAsArrayBuffer(fileInput.files[0]);
    };

    // --- NEW ---: Helper function to build the subject code dropdown options
    const populateSubjectCodeDropdown = (codes = [], selectElement, defaultText = "N/A") => {
        if (!selectElement) return;

        selectElement.innerHTML = ''; // Clear old options
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

    // --- NEW ---: Function to load codes when Dept or Year changes
    const loadSubjectCodesForFilter = async () => {
        const subjectCodeSelect = document.getElementById('filter-subject-code');
        const dept = (document.getElementById('filter-department') || {}).value;
        const year = (document.getElementById('filter-year') || {}).value;

        if (dept && year) {
            // Both filters are set, try to fetch the document
            try {
                const docId = `${dept}_${year}`;
                const docRef = doc(db, 'subjects', docId);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const codes = docSnap.data().subjectCodes || [];
                    if (codes.length > 0) {
                        populateSubjectCodeDropdown(codes, subjectCodeSelect);
                    } else {
                        populateSubjectCodeDropdown([], subjectCodeSelect, "No codes found");
                    }
                } else {
                    // Document for "ADS_3" doesn't exist
                    populateSubjectCodeDropdown([], subjectCodeSelect, "No codes found");
                }
            } catch (error) {
                console.error("Error fetching subject codes for filter:", error);
                populateSubjectCodeDropdown([], subjectCodeSelect, "Error loading");
            }
        } else {
            // One or both filters are not set, reset the dropdown
            populateSubjectCodeDropdown([], subjectCodeSelect, "Select Dept & Year");
        }
    };

    // --- MODIFIED ---: Now only populates Dept and Year, and sets up Subject Code dropdown
    const populateFilters = async () => {
        try {
            const metadataRef = doc(db, 'metadata', 'appData');
            const metadataSnap = await getDoc(metadataRef);
            if (metadataSnap.exists()) {
                const data = metadataSnap.data();
                const populateSelect = (elId, options, label) => {
                    const selectEl = document.getElementById(elId);
                    if (selectEl) {
                        selectEl.innerHTML = `<option value="">All ${label}</option>`;
                        (options?.sort() || []).forEach(opt => selectEl.innerHTML += `<option value="${opt}">${opt}</option>`);
                    }
                };
                populateSelect('filter-year', data.years, 'Years');
                populateSelect('filter-department', data.departments, 'Departments');

                // --- NEW ---: Set the initial state for the subject code dropdown
                const subjectCodeSelect = document.getElementById('filter-subject-code');
                if (subjectCodeSelect) {
                    subjectCodeSelect.innerHTML = '<option value="">Select Dept & Year</option>';
                    subjectCodeSelect.disabled = true;
                }
            }
        } catch (error) {
            console.error("Error populating subject filters:", error);
        }
    };

    // --- Renders the simple subject list ---
    // --- MODIFIED ---: Filter logic for subjectCode is now an exact match (===)
    const renderSubjects = async (filters = {}) => {
        try {
            if (tableBody) tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Loading...</td></tr>';
            
            let qConstraints = [];
            if (filters.department) qConstraints.push(where('department', '==', filters.department));
            if (filters.year) qConstraints.push(where('year', '==', filters.year));
            
            // --- MODIFIED ---
            // If user also selected a subjectCode, we can add it to the query
            // This is more efficient as Firestore filters the data
            if (filters.subjectCode) {
                qConstraints.push(where('subjectCodes', 'array-contains', filters.subjectCode));
            }

            const q = query(collection(db, 'subjects'), ...qConstraints);
            const snapshot = await getDocs(q);
            
            let subjectDocs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            let allSubjects = [];
            
            subjectDocs.forEach(docData => {
                const { department, year, subjectMap, id } = docData;
                if (subjectMap) {
                    for (const code in subjectMap) {
                        allSubjects.push({
                            id: `${id}_${code}`,
                            docId: id,
                            department,
                            year,
                            subjectCode: code,
                            subjectName: subjectMap[code]
                        });
                    }
                }
            });

            // --- MODIFIED ---
            // If we didn't filter in the query, or if the query was broad,
            // we must filter the *results* again.
            // This ensures if the user selected "All Codes" (filters.subjectCode = ''), it still works.
            if (filters.subjectCode) {
                 allSubjects = allSubjects.filter(s => s.subjectCode === filters.subjectCode);
            }
            
            renderTable(allSubjects);
        } catch (error) { 
            console.error("Error fetching subjects: ", error); 
        }
    };
    
    // --- Renders the new table format (6 columns) ---
    const renderTable = (subjects) => {
        // ... (function remains the same)
        tableBody.innerHTML = '';
        if (subjects.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No subjects found for the selected criteria.</td></tr>';
        } else {
            subjects.forEach((sub, index) => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${index + 1}</td>
                    <td>${sub.year || 'N/A'}</td>
                    <td>${sub.department || 'N/A'}</td>
                    <td>${sub.subjectCode || 'N/A'}</td>
                    <td>${sub.subjectName || 'N/A'}</td>
                    <td>
                        <div class="table-actions">
                             <button class="btn-delete-secondary" data-doc-id="${sub.docId}" data-subject-code="${sub.subjectCode}">Delete</button>
                        </div>
                    </td>`;
                tableBody.appendChild(row);
            });
        }
    };

    // --- Event Listeners ---
    listenerArea.addEventListener('click', async (e) => {
        // ... (All click handlers like apply-filter, clear-filter, delete, upload, etc. remain the same) ...
        const target = e.target;

        if (target.id === 'subject-apply-filter-btn') {
            applyFilters();
        } 
        else if (target.id === 'subject-clear-filter-btn') {
            clearFilters();
        } 
        else if (target.classList.contains('btn-delete-secondary')) {
            const { docId, subjectCode } = target.dataset;
            if (confirm(`Are you sure you want to delete subject ${subjectCode} from the master list (${docId})?`)) {
                 alert(`Deletion of a single map key (${subjectCode} from ${docId}) and array element requires Firestore FieldValue operations, typically done via Cloud Functions for safety. Deletion via client-side is complex.`);
            }
        } 
        else if (target.id === 'show-master-upload-btn') {
            document.getElementById('master-upload-section').style.display = 'block';
        } 
        else if (target.id === 'download-master-template-btn') {
            const headers = [['department', 'year', 'subjectCode', 'subjectName']];
            const ws = XLSX.utils.aoa_to_sheet(headers);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Template');
            XLSX.writeFile(wb, 'master_subject_template.xlsx');
        } 
        else if (target.id === 'upload-master-list-btn') {
            handleMasterUpload();
        }
    });

    // --- NEW ---: Add 'change' event listeners for the dependent dropdowns
    const filterArea = document.getElementById('subject-filters') || listenerArea;
    filterArea.addEventListener('change', (e) => {
        const target = e.target;
        if (target.id === 'filter-year' || target.id === 'filter-department') {
            loadSubjectCodesForFilter();
        }
    });


    // Remove pagination event listeners
    document.getElementById('subject-page-size-select')?.addEventListener('change', () => { /* no-op */ });
    document.getElementById('subject-prev-btn')?.addEventListener('click', () => { /* no-op */ });
    document.getElementById('subject-next-btn')?.addEventListener('click', () => { /* no-op */ });

    // --- Initial Load ---
    populateFilters(); // This will now set up the disabled subject code dropdown
    if (tableBody) tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Please use filters to view subjects.</td></tr>';
}