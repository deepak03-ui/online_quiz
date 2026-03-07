// Final, fully updated code for viewing faculty.
// --- NOW INCLUDES EDIT AND DELETE FUNCTIONALITY ---
import { db } from '../../../shared/firebase-config.js';
import {
    doc, getDoc, collection, query, where, orderBy,
    startAfter, limit, getDocs, deleteDoc, setDoc
} from "https://www.gstatic.com/firebasejs/9.10.0/firebase-firestore.js";

export function initManageFaculty(coordinator) {
    const tableBody = document.getElementById('faculty-table-body');
    const contentArea = document.getElementById('dynamic-content-area'); // Main content area

    let currentPageSize = 50;
    let page = 1;
    let lastVisibleDoc = null;
    const prevButton = document.getElementById('faculty-prev-btn');
    const nextButton = document.getElementById('faculty-next-btn');
    const pageInfo = document.getElementById('faculty-page-info');
    const pageSizeSelect = document.getElementById('faculty-page-size-select');

    // --- Modal Helper Functions ---

    /**
     * Creates and appends the faculty edit modal to the content area.
     */
    const createAndAppendModal = () => {
        if (document.getElementById('faculty-edit-modal')) return;

        const modalHTML = `
            <div id="faculty-edit-modal" class="modal-backdrop" style="display:none;">
                <div class="modal-content">
                    <button type="button" class="modal-close-btn">&times;</button>
                    <h3 id="faculty-modal-title">Edit Faculty Details</h3>
                    <form id="faculty-modal-form">
                        <input type="hidden" id="faculty-modal-original-email" />

                        <label for="faculty-modal-name">Name:</label>
                        <input type="text" id="faculty-modal-name" required />

                        <label for="faculty-modal-email-display">Email (Cannot be changed):</label>
                        <input type="text" id="faculty-modal-email-display" disabled style="background:#eee;" />

                        <label for="faculty-modal-departments">Departments (Comma-separated):</label>
                        <input type="text" id="faculty-modal-departments" />

                        <label for="faculty-modal-years">Years (Comma-separated):</label>
                        <input type="text" id="faculty-modal-years" />

                        <label for="faculty-modal-sections">Sections (Comma-separated):</label>
                        <input type="text" id="faculty-modal-sections" />

                        <label for="faculty-modal-subjectcodes">Subject Codes (Comma-separated):</label>
                        <input type="text" id="faculty-modal-subjectcodes" />

                        <label for="faculty-modal-subjectname">Subject Names (Comma-separated):</label>
                        <input type="text" id="faculty-modal-subjectname" />

                        <div class="modal-actions">
                            <button type="button" id="faculty-modal-save-btn" class="btn-primary">Save Changes</button>
                            <button type="button" id="faculty-modal-cancel-btn" class="btn-secondary">Cancel</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        contentArea.insertAdjacentHTML('beforeend', modalHTML);
    };

    /**
     * Shows the edit modal and populates it with faculty data.
     * @param {object} data - The dataset from the clicked edit button.
     */
    const showEditFacultyModal = (data) => {
        document.getElementById('faculty-modal-form').reset();
        
        // Helper to handle 'N/A' strings coming from data attributes
        const cleanData = (val) => (val === 'N/A' ? '' : val);

        document.getElementById('faculty-modal-original-email').value = data.id || '';
        document.getElementById('faculty-modal-name').value = cleanData(data.name);
        document.getElementById('faculty-modal-email-display').value = cleanData(data.email);
        document.getElementById('faculty-modal-departments').value = cleanData(data.departments);
        document.getElementById('faculty-modal-years').value = cleanData(data.years);
        document.getElementById('faculty-modal-sections').value = cleanData(data.sections);
        document.getElementById('faculty-modal-subjectcodes').value = cleanData(data.subjectcodes);
        document.getElementById('faculty-modal-subjectname').value = cleanData(data.subjectname);

        document.getElementById('faculty-edit-modal').style.display = 'flex';
    };

    /**
     * Hides and resets the edit modal.
     */
    const hideEditFacultyModal = () => {
        document.getElementById('faculty-edit-modal').style.display = 'none';
        document.getElementById('faculty-modal-form').reset();
    };

    /**
     * Saves the faculty data from the modal to Firestore.
     */
    const saveFaculty = async () => {
        const docId = document.getElementById('faculty-modal-original-email').value;
        if (!docId) {
            alert('Error: No faculty ID found.');
            return;
        }

        // Helper to split comma-separated strings into arrays, trimming whitespace and removing empty strings
        const splitAndTrim = (str) => {
            if (!str) return [];
            return str.split(',').map(s => s.trim()).filter(Boolean);
        };

        try {
            const facultyData = {
                name: document.getElementById('faculty-modal-name').value.trim(),
                departments: splitAndTrim(document.getElementById('faculty-modal-departments').value),
                years: splitAndTrim(document.getElementById('faculty-modal-years').value),
                sections: splitAndTrim(document.getElementById('faculty-modal-sections').value),
                subjectCodes: splitAndTrim(document.getElementById('faculty-modal-subjectcodes').value),
                subjectName: splitAndTrim(document.getElementById('faculty-modal-subjectname').value),
                // role and email are not changed
            };

            await setDoc(doc(db, 'users', docId), facultyData, { merge: true });

            alert('Faculty details updated successfully!');
            hideEditFacultyModal();
            applyFilters(); // Refresh the table to show changes

        } catch (error) {
            console.error('Error saving faculty:', error);
            alert('An error occurred while saving. Check the console.');
        }
    };

    // --- End of Modal Functions ---


    const getFacultyFilters = () => ({
        department: (document.getElementById('faculty-filter-department') || {}).value || '',
        name: (document.getElementById('faculty-filter-name') || {}).value?.trim().toLowerCase() || '',
        year: (document.getElementById('faculty-filter-year') || {}).value || '',
        subject: (document.getElementById('faculty-filter-subject') || {}).value?.trim().toLowerCase() || ''
    });

    const applyFilters = () => {
        page = 1;
        lastVisibleDoc = null;
        renderFaculty(getFacultyFilters(), 'first');
    };

    const clearFilters = () => {
        const deptSelect = document.getElementById('faculty-filter-department');
        const yearSelect = document.getElementById('faculty-filter-year');

        document.getElementById('faculty-filter-name').value = '';
        document.getElementById('faculty-filter-subject').value = '';
        
        // Do not clear/reset if they are disabled (locked)
        if (deptSelect && !deptSelect.disabled) deptSelect.value = '';
        if (yearSelect && !yearSelect.disabled) yearSelect.value = '';

        if (pageSizeSelect) pageSizeSelect.value = 50;
        currentPageSize = 50;
        if (tableBody) {
            // UPDATED: colspan is now 10
            tableBody.innerHTML = '<tr><td colspan="10" style="text-align:center;">Please click "Apply" to view faculty assignments.</td></tr>';
        }
    };

    const populateFacultyFilters = async () => {
        const deptSelect = document.getElementById('faculty-filter-department');
        const yearSelect = document.getElementById('faculty-filter-year');
        try {
            // --- NEW LOGIC: Handle Department ---
            if (deptSelect && coordinator.department) {
                if (Array.isArray(coordinator.department)) {
                    if (coordinator.department.length === 1) {
                        // Lock for single-item array
                        const dept = coordinator.department[0];
                        deptSelect.innerHTML = `<option value="${dept}">${dept}</option>`;
                        deptSelect.value = dept;
                        deptSelect.disabled = true;
                    } else if (coordinator.department.length > 1) {
                        // Populate with the coordinator's limited list
                        deptSelect.innerHTML = `<option value="">All Assigned</option>`;
                        coordinator.department.sort().forEach(opt => deptSelect.innerHTML += `<option value="${opt}">${opt}</option>`);
                        deptSelect.disabled = false;
                    }
                    // else (empty array) -> do nothing
                } else { // It's a string
                    // Lock for string
                    deptSelect.innerHTML = `<option value="${coordinator.department}">${coordinator.department}</option>`;
                    deptSelect.value = coordinator.department;
                    deptSelect.disabled = true;
                }
            }

            // --- NEW LOGIC: Handle Year ---
            if (yearSelect && coordinator.year) {
                if (Array.isArray(coordinator.year)) {
                    if (coordinator.year.length === 1) {
                        // Lock for single-item array
                        const year = coordinator.year[0];
                        yearSelect.innerHTML = `<option value="${year}">${year}</option>`;
                        yearSelect.value = year;
                        yearSelect.disabled = true;
                    } else if (coordinator.year.length > 1) {
                        // Populate with the coordinator's limited list
                        yearSelect.innerHTML = `<option value="">All Assigned</option>`;
                        coordinator.year.sort().forEach(opt => yearSelect.innerHTML += `<option value="${opt}">${opt}</option>`);
                        yearSelect.disabled = false;
                    }
                    // else (empty array) -> do nothing
                } else { // It's a string
                    // Lock for string
                    yearSelect.innerHTML = `<option value="${coordinator.year}">${coordinator.year}</option>`;
                    yearSelect.value = coordinator.year;
                    yearSelect.disabled = true;
                }
            }
        } catch (err) {
            console.error('[faculty] populateFacultyFilters error', err);
        }
    };

    const renderFaculty = async (filters = {}, direction = 'first') => {
        try {
            // UPDATED: colspan is now 10
            if (tableBody) tableBody.innerHTML = '<tr><td colspan="10" style="text-align:center;">Loading...</td></tr>';
            if (direction === 'first') { page = 1; lastVisibleDoc = null; }

            let qConstraints = [where('role', '==', 'faculty')];
            
            if (filters.department) {
                qConstraints.push(where('departments', 'array-contains', filters.department));
            }
            
            qConstraints.push(orderBy('email'));
            if (direction === 'next' && lastVisibleDoc) qConstraints.push(startAfter(lastVisibleDoc));
            qConstraints.push(limit(currentPageSize));

            const q = query(collection(db, 'users'), ...qConstraints);
            const snapshot = await getDocs(q);

            lastVisibleDoc = snapshot.docs[snapshot.docs.length - 1] || null;
            let facultyList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            if (filters.year) {
                facultyList = facultyList.filter(item => item.years && item.years.includes(filters.year));
            }

            facultyList = facultyList.filter(item => {
                const nameMatch = !filters.name || (item.name && item.name.toLowerCase().includes(filters.name));
                const subjectMatch = !filters.subject || (item.subjectCodes && item.subjectCodes.some(sc => sc.toLowerCase().includes(filters.subject)));
                return nameMatch && subjectMatch;
            });

            renderTable(facultyList);
            updatePaginationUI(snapshot.size >= currentPageSize);
        } catch (error) {
            console.error("[faculty] Error fetching faculty assignments: ", error);
             if (tableBody && error.code === 'failed-precondition') {
                 tableBody.innerHTML = '<tr><td colspan="10" style="text-align:center; color: red;"><b>Query Error:</b> A database index is required. Please check the browser console for a link to create it.</td></tr>';
            }
        }
    };

    const renderTable = (facultyList) => {
        if (!tableBody) return;
        tableBody.innerHTML = '';
        if (!facultyList || facultyList.length === 0) {
            // UPDATED: colspan is now 10
            tableBody.innerHTML = '<tr><td colspan="10" style="text-align:center;">No faculty assignments found.</td></tr>';
            return;
        }

        // This function is now also used to populate data attributes
        const displayArray = (field) => Array.isArray(field) ? field.join(', ') : (field || 'N/A');
        
        facultyList.forEach((item, index) => {
            const row = document.createElement('tr');
            const sno = (page - 1) * currentPageSize + index + 1;
            
            // Get string versions for data attributes, handling potential 'N/A' from displayArray
            const cleanStr = (val) => (val === 'N/A' ? '' : val);
            const departmentsStr = cleanStr(displayArray(item.departments));
            const yearsStr = cleanStr(displayArray(item.years));
            const sectionsStr = cleanStr(displayArray(item.sections));
            const subjectCodesStr = cleanStr(displayArray(item.subjectCodes));
            const subjectNameStr = cleanStr(displayArray(item.subjectName));

            // UPDATED: Added new <td> for actions
            row.innerHTML = `
                <td>${sno}</td>
                <td>${item.name || 'N/A'}</td>
                <td>${displayArray(item.departments)}</td>
                <td>${displayArray(item.years)}</td>
                <td>${displayArray(item.sections)}</td>
                <td>${displayArray(item.subjectCodes)}</td>
                <td>${displayArray(item.subjectName)}</td>
                <td>${item.email || 'N/A'}</td>
                <td>
                    <div class="table-actions">
                        <button class="btn-edit-secondary" 
                            data-id="${item.id}" 
                            data-name="${item.name || ''}" 
                            data-email="${item.email || ''}" 
                            data-departments="${departmentsStr}" 
                            data-years="${yearsStr}" 
                            data-sections="${sectionsStr}" 
                            data-subjectcodes="${subjectCodesStr}" 
                            data-subjectname="${subjectNameStr}">
                            Edit
                        </button>
                        <button class="btn-delete-secondary" 
                            data-id="${item.id}" 
                            data-name="${item.name || 'N/A'}">
                            Delete
                        </button>
                    </div>
                </td>
            `;
            tableBody.appendChild(row);
        });
    };

    const updatePaginationUI = (hasNextPage) => {
        if (pageInfo) pageInfo.textContent = `Page ${page}`;
        if (prevButton) prevButton.disabled = page === 1;
        if (nextButton) nextButton.disabled = !hasNextPage;
    };

    // --- Main Event Listeners ---

    // Central click listener for the content area
    contentArea?.addEventListener('click', async (e) => {
        const target = e.target.closest('button');
        if (!target) return; // Not a button click

        // Filter buttons
        if (target.id === 'faculty-apply-filter-btn') {
            applyFilters();
        } 
        else if (target.id === 'faculty-clear-filter-btn') {
            clearFilters();
        } 
        // Pagination buttons
        else if (target.id === 'faculty-prev-btn') {
            if (page > 1) { 
                // Note: 'prev' logic isn't fully supported by startAfter, so we reset to page 1
                // For true 'prev', you'd need to store 'firstVisibleDoc' of each page
                page = 1;
                lastVisibleDoc = null;
                renderFaculty(getFacultyFilters(), 'first');
            }
        } 
        else if (target.id === 'faculty-next-btn') {
            page++;
            renderFaculty(getFacultyFilters(), 'next');
        } 
        // Table action buttons
        else if (target.classList.contains('btn-edit-secondary')) {
            showEditFacultyModal(target.dataset);
        } 
        else if (target.classList.contains('btn-delete-secondary')) {
            const { id, name } = target.dataset;
            if (confirm(`Are you sure you want to delete faculty member: ${name} (${id})?`)) {
                try {
                    await deleteDoc(doc(db, 'users', id));
                    alert('Faculty member deleted successfully.');
                    applyFilters(); // Refresh the table
                } catch (error) {
                    console.error("Error deleting faculty:", error);
                    alert('An error occurred while deleting. Check the console.');
                }
            }
        } 
        // Modal buttons
        else if (target.id === 'faculty-modal-save-btn') {
            await saveFaculty();
        } 
        else if (target.id === 'faculty-modal-cancel-btn' || target.classList.contains('modal-close-btn')) {
            hideEditFacultyModal();
        }
    });

    // Separate listener for 'change' event on page size select
    pageSizeSelect?.addEventListener('change', (e) => {
        currentPageSize = parseInt(e.target.value, 10);
        applyFilters();
    });
    
    // --- Initial setup ---
    populateFacultyFilters();
    createAndAppendModal(); // Create the modal and add it to the DOM

    if (tableBody) {
        // UPDATED: colspan is now 10
        tableBody.innerHTML = '<tr><td colspan="10" style="text-align:center;">Please click "Apply" to view faculty assignments.</td></tr>';
    }
}