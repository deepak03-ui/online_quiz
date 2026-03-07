// File: /js/portals/admin/pages/manageCoordinators.js
// --- This file is already correct and matches the new schema ---

import { db } from '../../../shared/firebase-config.js';
import {
    doc, getDoc, collection, writeBatch, arrayUnion, query, where, orderBy,
    startAfter, limit, getDocs, deleteDoc, setDoc
} from "https://www.gstatic.com/firebasejs/9.10.0/firebase-firestore.js";

export function initManageCoordinators() {
    const tableBody = document.getElementById('coordinators-table-body');
    const contentArea = document.getElementById('dynamic-content-area') || document.body; // Use body as fallback

    let currentPageSize = 50;
    let page = 1;
    let lastVisibleDoc = null;
    const prevButton = document.getElementById('coord-prev-btn');
    const nextButton = document.getElementById('coord-next-btn');
    const pageInfo = document.getElementById('coord-page-info');
    const pageSizeSelect = document.getElementById('coord-page-size-select');
    let appDataCache = {};

    // --- Modal Helper Functions ---

    const createAndAppendModal = () => {
        if (document.getElementById('coord-manage-modal')) return;
        const modalHTML = `
            <div id="coord-manage-modal" class="modal-backdrop" style="display:none;">
                <div class="modal-content">
                    <button type="button" class="modal-close-btn">&times;</button>
                    <h3 id="coord-modal-title">Manage Coordinator</h3>
                    <form id="coord-modal-form">
                        <input type="hidden" id="coord-modal-original-email" />
                        <label for="coord-modal-name">Name:</label>
                        <input type="text" id="coord-modal-name" required />
                        <label for="coord-modal-email">Email:</label>
                        <input type="email" id="coord-modal-email" required />
                        <label for="coord-modal-department">Department:</label>
                        <select id="coord-modal-department" required></select>
                        <input type="text" id="coord-modal-new-department" placeholder="Or add new department" style="display:none;" />
                        <label for="coord-modal-year">Year(s):</label>
                        <div id="coord-modal-year-container" class="custom-multiselect-container">
                            <div class="custom-multiselect-trigger" tabindex="0">
                                <span id="coord-modal-year-display">Select years...</span>
                            </div>
                            <div class="custom-multiselect-panel">
                                <div class="custom-multiselect-option">
                                    <input type="checkbox" id="coord-year-select-all" />
                                    <span>Select All</span>
                                </div>
                            </div>
                        </div>
                        <input type="hidden" id="coord-modal-year" required />
                        <div class="modal-actions">
                            <button type="button" id="coord-modal-save-btn" class="btn-primary">Save</button>
                            <button type="button" id="coord-modal-cancel-btn" class="btn-secondary">Cancel</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        contentArea.insertAdjacentHTML('beforeend', modalHTML);
    };

    const populateModalDropdowns = () => {
        const deptSelect = document.getElementById('coord-modal-department');
        if (deptSelect) {
            deptSelect.innerHTML = `<option value="">Select...</option>`;
            (appDataCache.departments?.sort() || []).forEach(dept => {
                deptSelect.innerHTML += `<option value="${dept}">${dept}</option>`;
            });
            deptSelect.innerHTML += `<option value="__NEW__">Add New...</option>`;
        }
        const yearPanel = document.querySelector('#coord-modal-year-container .custom-multiselect-panel');
        if (yearPanel) {
            const selectAllOption = yearPanel.querySelector('.custom-multiselect-option');
            yearPanel.innerHTML = '';
            yearPanel.appendChild(selectAllOption);
            (appDataCache.years?.sort() || []).forEach(year => {
                const optionDiv = document.createElement('div');
                optionDiv.className = 'custom-multiselect-option';
                optionDiv.innerHTML = `
                    <input type="checkbox" id="coord-year-${year}" value="${year}" />
                    <span>${year}</span>
                `;
                yearPanel.appendChild(optionDiv);
            });
        }
    };

    const updateYearDisplay = () => {
        const checkedBoxes = document.querySelectorAll('#coord-modal-year-container input[type="checkbox"]:checked:not(#coord-year-select-all)');
        const selectedYears = Array.from(checkedBoxes).map(cb => cb.value);
        const displayEl = document.getElementById('coord-modal-year-display');
        const hiddenInput = document.getElementById('coord-modal-year');

        if (selectedYears.length === 0) {
            displayEl.textContent = 'Select years...';
            hiddenInput.value = '';
        } else {
            displayEl.textContent = selectedYears.join(', ');
            hiddenInput.value = selectedYears.join(',');
        }
        const selectAllCb = document.getElementById('coord-year-select-all');
        const allCheckboxes = document.querySelectorAll('#coord-modal-year-container input[type="checkbox"]:not(#coord-year-select-all)');
        if (selectAllCb && allCheckboxes.length > 0) {
            selectAllCb.checked = (checkedBoxes.length === allCheckboxes.length);
             selectAllCb.indeterminate = checkedBoxes.length > 0 && checkedBoxes.length < allCheckboxes.length;
        } else if (selectAllCb) {
             selectAllCb.indeterminate = false;
        }
    };

    const showAddCoordinatorModal = () => {
        document.getElementById('coord-modal-form').reset();
        document.getElementById('coord-modal-title').textContent = 'Add New Coordinator';
        document.getElementById('coord-modal-original-email').value = '';
        document.getElementById('coord-modal-email').disabled = false;
        document.getElementById('coord-modal-new-department').style.display = 'none';
        populateModalDropdowns();
        const yearCheckboxes = document.querySelectorAll('#coord-modal-year-container input[type="checkbox"]');
        yearCheckboxes.forEach(cb => {
            cb.checked = false;
            cb.indeterminate = false;
        });
        document.getElementById('coord-modal-year-display').textContent = 'Select years...';
        document.getElementById('coord-modal-year').value = '';
        document.getElementById('coord-manage-modal').style.display = 'flex';
    };

    const showEditCoordinatorModal = (data) => {
        document.getElementById('coord-modal-form').reset();
        document.getElementById('coord-modal-title').textContent = 'Edit Coordinator';
        document.getElementById('coord-modal-original-email').value = data.id;
        document.getElementById('coord-modal-name').value = data.name || '';
        document.getElementById('coord-modal-email').value = data.email || '';
        document.getElementById('coord-modal-email').disabled = true;
        document.getElementById('coord-modal-new-department').style.display = 'none';
        populateModalDropdowns();
        document.getElementById('coord-modal-department').value = data.department || '';
        const yearArray = (data.year || '').split(',').filter(Boolean);
        const yearCheckboxes = document.querySelectorAll('#coord-modal-year-container input[type="checkbox"]:not(#coord-year-select-all)');
        yearCheckboxes.forEach(cb => {
            cb.checked = yearArray.includes(cb.value);
        });
        updateYearDisplay();
        document.getElementById('coord-manage-modal').style.display = 'flex';
    };

    const hideCoordinatorModal = () => {
        document.getElementById('coord-manage-modal').style.display = 'none';
        document.getElementById('coord-modal-form').reset();
        const yearContainer = document.getElementById('coord-modal-year-container');
        if (yearContainer) yearContainer.classList.remove('open');
    };

    const saveCoordinator = async () => {
        const originalEmail = document.getElementById('coord-modal-original-email').value;
        const emailInput = document.getElementById('coord-modal-email');
        const email = emailInput.value.toLowerCase().trim();
        if (!email) {
            alert('Email is required.');
            return;
        }
        const docId = emailInput.disabled ? originalEmail : email;
        if (!originalEmail || originalEmail !== email) {
            if (!emailInput.disabled) {
                const docSnap = await getDoc(doc(db, 'users', email));
                if (docSnap.exists()) {
                    alert('Error: A user with this email already exists.');
                    return;
                }
            }
        }
        let department = document.getElementById('coord-modal-department').value;
        if (department === '__NEW__') {
            department = document.getElementById('coord-modal-new-department').value.trim();
        }
        const hiddenYearInput = document.getElementById('coord-modal-year');
        const newYears = hiddenYearInput.value.split(',').filter(Boolean);
        if (!department || newYears.length === 0) {
            alert("Department and at least one Year are required.");
            return;
        }
        const coordinatorData = {
            name: document.getElementById('coord-modal-name').value.trim(),
            email: email,
            department: department || null,
            year: newYears, // Saves as ["3", "4"]
            role: 'coordinator'
        };
        try {
            const batch = writeBatch(db);
            batch.set(doc(db, 'users', docId), coordinatorData, { merge: true });
            const metadataRef = doc(db, 'metadata', 'appData');
            const metadataPayload = {};
            if (department) metadataPayload.departments = arrayUnion(department);
            if (newYears.length > 0) metadataPayload.years = arrayUnion(...newYears);
            if (Object.keys(metadataPayload).length > 0) {
                batch.set(metadataRef, metadataPayload, { merge: true });
                if (department && !(appDataCache.departments || []).includes(department)) {
                    appDataCache.departments = [...(appDataCache.departments || []), department];
                }
                newYears.forEach(year => {
                    if (year && !(appDataCache.years || []).includes(year)) {
                        appDataCache.years = [...(appDataCache.years || []), year];
                    }
                });
            }
            if (originalEmail && originalEmail !== email && !emailInput.disabled) {
                 batch.delete(doc(db, 'users', originalEmail));
            }
            await batch.commit();
            alert('Coordinator saved successfully!');
            hideCoordinatorModal();
            await populateCoordFilters();
            applyFilters();
        } catch (error) {
            console.error('Error saving coordinator:', error);
            alert('An error occurred while saving. Check the console.');
        }
    };

    const getCoordFilters = () => ({
        name: (document.getElementById('coord-filter-name') || {}).value?.trim().toLowerCase() || '',
        email: (document.getElementById('coord-filter-email') || {}).value?.trim().toLowerCase() || '',
        department: (document.getElementById('coord-filter-department') || {}).value || '',
        year: (document.getElementById('coord-filter-year') || {}).value || '',
    });

    const applyFilters = () => {
        page = 1;
        lastVisibleDoc = null;
        renderCoordinators(getCoordFilters(), 'first');
    };

    const clearFilters = () => {
        document.querySelectorAll('.filter-card input, .filter-card select').forEach(el => el.value = '');
        if (pageSizeSelect) pageSizeSelect.value = 50;
        currentPageSize = 50;
        if (tableBody) {
            tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Please select filters and click "Apply" to view coordinators.</td></tr>';
        }
        updatePaginationUI(false);
    };

    const handleBulkUpload = async () => {
        const fileInput = document.getElementById('coord-file-upload');
        if (typeof XLSX === 'undefined') return alert('XLSX library not loaded.');
        if (!fileInput || fileInput.files.length === 0) return alert('Please select a file to upload.');
        const file = fileInput.files[0];
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const data = new Uint8Array(event.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                const rows = XLSX.utils.sheet_to_json(worksheet);
                if (rows.length === 0) return alert("File is empty.");
                alert(`Found ${rows.length} records. Uploading...`);
                const batch = writeBatch(db);
                const uniqueDepartments = new Set();
                const uniqueYears = new Set();
                const parseArrayField = (field) => {
                    if (!field) return [];
                    return String(field).split(',')
                                        .map(s => s.trim())
                                        .filter(Boolean);
                };
                rows.forEach(row => {
                    const email = (row.email || '').toLowerCase().trim();
                    if (!email) return;
                    const department = String(row.department || '').trim();
                    const yearsArray = parseArrayField(row.year); // Correctly parses "3, 4"
                    if (department) uniqueDepartments.add(department);
                    yearsArray.forEach(y => uniqueYears.add(y));
                    const coordinatorData = {
                        name: String(row.name || ''),
                        email: email,
                        department: department || null,
                        year: yearsArray, // Saves as ["3", "4"]
                        role: 'coordinator'
                    };
                    batch.set(doc(db, 'users', email), coordinatorData, { merge: true });
                });
                const metadataRef = doc(db, 'metadata', 'appData');
                batch.set(metadataRef, {
                    departments: arrayUnion(...uniqueDepartments),
                    years: arrayUnion(...uniqueYears),
                }, { merge: true });
                await batch.commit();
                alert(`${rows.length} coordinators uploaded successfully!`);
                fileInput.value = '';
                document.getElementById('coord-bulk-upload-section').style.display = 'none';
                await populateCoordFilters();
                applyFilters();
            } catch(err) {
                alert("An error occurred during upload. Check console for details.");
                console.error("Bulk upload error:", err);
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const populateCoordFilters = async () => {
        try {
            const metadataRef = doc(db, 'metadata', 'appData');
            const metadataSnap = await getDoc(metadataRef);
            if (metadataSnap.exists()) {
                appDataCache = metadataSnap.data();
                const data = appDataCache;
                const populateSelect = (elId, options, label) => {
                    const selectEl = document.getElementById(elId);
                    if (selectEl) {
                        selectEl.innerHTML = `<option value="">All ${label}</option>`;
                        (options?.sort() || []).forEach(opt => selectEl.innerHTML += `<option value="${opt}">${opt}</option>`);
                    }
                };
                populateSelect('coord-filter-department', data.departments, 'Departments');
                populateSelect('coord-filter-year', data.years, 'Years');
            }
        } catch (error) {
            console.error("Error populating coordinator filters:", error);
        }
    };

    const renderCoordinators = async (filters = {}, direction = 'first') => {
        try {
            if (tableBody) tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Loading...</td></tr>';
            if (direction === 'first') { page = 1; lastVisibleDoc = null; }
            let qConstraints = [where('role', '==', 'coordinator')];
            if (filters.department) qConstraints.push(where('department', '==', filters.department));
            if (filters.year) qConstraints.push(where('year', 'array-contains', filters.year));
            qConstraints.push(orderBy('email'));
            if (direction === 'next' && lastVisibleDoc) {
                qConstraints.push(startAfter(lastVisibleDoc));
            }
            qConstraints.push(limit(currentPageSize));
            const q = query(collection(db, 'users'), ...qConstraints);
            const snapshot = await getDocs(q);
            lastVisibleDoc = snapshot.docs.length === currentPageSize ? snapshot.docs[snapshot.docs.length - 1] : null;
            let coords = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            coords = coords.filter(c =>
                (!filters.name || (c.name && c.name.toLowerCase().includes(filters.name))) &&
                (!filters.email || (c.email && c.email.toLowerCase().includes(filters.email)))
            );
            renderTable(coords);
            updatePaginationUI(!!lastVisibleDoc);
        } catch (error) {
            console.error("Error fetching coordinators: ", error);
            if (tableBody) {
                if (error.code === 'failed-precondition') {
                    tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; color: red;"><b>Query Error:</b> A database index is required.</td></tr>';
                } else {
                    tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; color: red;">Error: ${error.message}</td></tr>`;
                }
            }
        }
    };

    const renderTable = (coords) => {
        tableBody.innerHTML = '';
        if (coords.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No coordinators found.</td></tr>';
        } else {
            coords.forEach((coord, index) => {
                const row = document.createElement('tr');
                const sno = (page - 1) * currentPageSize + index + 1;
                const yearDisplay = Array.isArray(coord.year) ? coord.year.join(', ') : (coord.year || 'N/A');
                const yearData = Array.isArray(coord.year) ? coord.year.join(',') : (coord.year || '');
                row.innerHTML = `
                    <td>${sno}</td>
                    <td>${coord.name || 'N/A'}</td>
                    <td>${coord.email || 'N/A'}</td>
                    <td>${coord.department || 'N/A'}</td>
                    <td>${yearDisplay}</td>
                    <td>
                        <div class="table-actions">
                            <button class="btn-edit-secondary"
                                data-id="${coord.id}"
                                data-name="${coord.name || ''}"
                                data-email="${coord.email || ''}"
                                data-department="${coord.department || ''}"
                                data-year="${yearData}">
                                Edit
                            </button>
                            <button class="btn-delete-secondary"
                                data-id="${coord.id}"
                                data-name="${coord.name || 'N/A'}">
                                Delete
                            </button>
                        </div>
                    </td>`;
                tableBody.appendChild(row);
            });
        }
    };

    const updatePaginationUI = (hasNextPage) => {
        const controls = [prevButton, nextButton, pageSizeSelect, pageInfo];
        controls.forEach(el => { if (el) el.style.display = ''; });
        if (pageInfo) pageInfo.textContent = `Page ${page}`;
        if (prevButton) prevButton.disabled = (page === 1);
        if (nextButton) nextButton.disabled = !hasNextPage;
    };

    // --- Event Listeners ---
    document.getElementById('coord-apply-filter-btn')?.addEventListener('click', applyFilters);
    document.getElementById('coord-clear-filter-btn')?.addEventListener('click', clearFilters);
    pageSizeSelect?.addEventListener('change', (e) => { currentPageSize = parseInt(e.target.value, 10); applyFilters(); });
    prevButton?.addEventListener('click', () => {
        if(page > 1) {
            // This is a simplified pagination for 'prev'. A full cursor-based 'prev' is more complex.
            page = 1;
            lastVisibleDoc = null;
            renderCoordinators(getCoordFilters(), 'first');
        }
    });
    nextButton?.addEventListener('click', () => {
        if (lastVisibleDoc) {
            page++;
            renderCoordinators(getCoordFilters(), 'next');
        }
    });
    contentArea?.addEventListener('change', (e) => {
        if (e.target.id === 'coord-modal-department') {
            const newDeptInput = document.getElementById('coord-modal-new-department');
            if (newDeptInput) newDeptInput.style.display = (e.target.value === '__NEW__') ? 'block' : 'none';
        }
        if (e.target.type === 'checkbox' && e.target.closest('#coord-modal-year-container')) {
            if (e.target.id === 'coord-year-select-all') {
                const allCheckboxes = document.querySelectorAll('#coord-modal-year-container input[type="checkbox"]:not(#coord-year-select-all)');
                allCheckboxes.forEach(cb => cb.checked = e.target.checked);
            }
             updateYearDisplay();
        }
    });
    contentArea?.addEventListener('click', (e) => {
        const yearContainer = document.getElementById('coord-modal-year-container');
        const yearTrigger = yearContainer?.querySelector('.custom-multiselect-trigger');
        if (yearTrigger && (e.target === yearTrigger || yearTrigger.contains(e.target))) {
            e.stopPropagation();
            yearContainer.classList.toggle('open');
        } else if (yearContainer?.classList.contains('open') && !yearContainer.contains(e.target)) {
            yearContainer.classList.remove('open');
        }
        const target = e.target.closest('button');
        if (!target) return;
        if (target.classList.contains('btn-edit-secondary')) {
            showEditCoordinatorModal(target.dataset);
        }
        else if (target.classList.contains('btn-delete-secondary')) {
            if(confirm(`Are you sure you want to delete coordinator ${target.dataset.name}?`)) {
                (async () => {
                    try {
                        await deleteDoc(doc(db, 'users', target.dataset.id));
                        alert('Coordinator deleted.');
                        applyFilters();
                    } catch (error) {
                        console.error("Error deleting coordinator:", error);
                        alert("Error deleting coordinator.");
                    }
                })();
            }
        }
        else if (target.id === 'add-coord-btn') {
            showAddCoordinatorModal();
        }
        else if (target.id === 'coord-modal-save-btn') {
            e.preventDefault();
            saveCoordinator();
        }
        else if (target.id === 'coord-modal-cancel-btn' ||
                   target.classList.contains('modal-close-btn'))
        {
            hideCoordinatorModal();
        }
        else if (target.id === 'show-coord-upload-section-btn') {
            const section = document.getElementById('coord-bulk-upload-section');
            if (section) section.style.display = 'block';
        }
        else if (target.id === 'download-coord-template-btn') {
            if (typeof XLSX === 'undefined') {
                alert('XLSX library not loaded. Please wait and try again.');
                return;
            }
            const data = [
                ['name', 'email', 'department', 'year'],
                ['Example Coordinator', 'example@email.com', 'ADS', '3, 4']
            ];
            const ws = XLSX.utils.aoa_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Template');
            XLSX.writeFile(wb, 'coordinator_upload_template.xlsx');
        }
        else if (target.id === 'coord-upload-button') {
            handleBulkUpload();
        }
    });
    contentArea?.addEventListener('click', (e) => {
        if (e.target.id === 'coord-manage-modal') {
            hideCoordinatorModal();
        }
    });

    // --- Final Initialization ---
    (async () => {
        await populateCoordFilters();
        createAndAppendModal();
        if (tableBody) {
            tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Please select filters and click "Apply" to view coordinators.</td></tr>';
        }
    })();
}