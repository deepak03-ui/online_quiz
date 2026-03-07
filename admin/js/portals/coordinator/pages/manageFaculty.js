// Final, fully updated code for viewing faculty. Fixes the 'array-contains' query error.
import { db } from '../../../shared/firebase-config.js';
import { doc, getDoc, collection, query, where, orderBy, startAfter, limit, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/9.10.0/firebase-firestore.js";

export function initManageFaculty(coordinator) {
    const tableBody = document.getElementById('faculty-table-body');
    const contentArea = document.getElementById('dynamic-content-area');

    let currentPageSize = 50;
    let page = 1;
    let lastVisibleDoc = null;
    const prevButton = document.getElementById('faculty-prev-btn');
    const nextButton = document.getElementById('faculty-next-btn');
    const pageInfo = document.getElementById('faculty-page-info');
    const pageSizeSelect = document.getElementById('faculty-page-size-select');

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
        document.getElementById('faculty-filter-name').value = '';
        document.getElementById('faculty-filter-subject').value = '';
        if (pageSizeSelect) pageSizeSelect.value = 50;
        currentPageSize = 50;
        if (tableBody) {
            tableBody.innerHTML = '<tr><td colspan="9" style="text-align:center;">Please click "Apply" to view faculty assignments.</td></tr>';
        }
    };

    const populateFacultyFilters = async () => {
        const deptSelect = document.getElementById('faculty-filter-department');
        const yearSelect = document.getElementById('faculty-filter-year');
        try {
            if (deptSelect && coordinator.department) {
                deptSelect.innerHTML = `<option value="${coordinator.department}">${coordinator.department}</option>`;
                deptSelect.value = coordinator.department;
                deptSelect.disabled = true;
            }
            if (yearSelect && coordinator.year) {
                yearSelect.innerHTML = `<option value="${coordinator.year}">${coordinator.year}</option>`;
                yearSelect.value = coordinator.year;
                yearSelect.disabled = true;
            }
        } catch (err) {
            console.error('[faculty] populateFacultyFilters error', err);
        }
    };

    // CORRECTED: This function now only uses one 'array-contains' filter.
    const renderFaculty = async (filters = {}, direction = 'first') => {
        try {
            if (tableBody) tableBody.innerHTML = '<tr><td colspan="9" style="text-align:center;">Loading...</td></tr>';
            if (direction === 'first') { page = 1; lastVisibleDoc = null; }

            let qConstraints = [where('role', '==', 'faculty')];
            
            // Only use ONE 'array-contains' in the database query.
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

            // Perform the second filter (for year) on the client side.
            if (filters.year) {
                facultyList = facultyList.filter(item => item.years && item.years.includes(filters.year));
            }

            // Perform other text-based filters on the client side.
            facultyList = facultyList.filter(item => {
                const nameMatch = !filters.name || (item.name && item.name.toLowerCase().includes(filters.name));
                const subjectMatch = !filters.subject || (item.subjectCodes && item.subjectCodes.some(sc => sc.toLowerCase().includes(filters.subject)));
                return nameMatch && subjectMatch;
            });

            renderTable(facultyList);
            updatePaginationUI(snapshot.size >= currentPageSize);
        } catch (error) {
            console.error("[faculty] Error fetching faculty assignments: ", error);
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
            row.innerHTML = `
                <td>${sno}</td>
                <td>${item.name || 'N/A'}</td>
                <td>${displayArray(item.departments)}</td>
                <td>${displayArray(item.years)}</td>
                <td>${displayArray(item.sections)}</td>
                <td>${displayArray(item.subjectCodes)}</td>
                <td>${displayArray(item.subjectName)}</td>
                <td>${item.email || 'N/A'}</td>
                `;
            tableBody.appendChild(row);
        });
    };

    const updatePaginationUI = (hasNextPage) => {
        if (pageInfo) pageInfo.textContent = `Page ${page}`;
        if (prevButton) prevButton.disabled = page === 1;
        if (nextButton) nextButton.disabled = !hasNextPage;
    };

    document.getElementById('faculty-apply-filter-btn')?.addEventListener('click', applyFilters);
    document.getElementById('faculty-clear-filter-btn')?.addEventListener('click', clearFilters);
    prevButton?.addEventListener('click', () => { if (page > 1) { page--; renderFaculty(getFacultyFilters(), 'prev'); } });
    nextButton?.addEventListener('click', () => { page++; renderFaculty(getFacultyFilters(), 'next'); });
    pageSizeSelect?.addEventListener('change', (e) => {
        currentPageSize = parseInt(e.target.value, 10);
        applyFilters();
    });
    
    populateFacultyFilters();
    if (tableBody) {
        tableBody.innerHTML = '<tr><td colspan="9" style="text-align:center;">Please click "Apply" to view faculty assignments.</td></tr>';
    }
}