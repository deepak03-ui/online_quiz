// Final, view-only code for coordinators to manage students.
import { db } from '../../../shared/firebase-config.js';
import { doc, getDoc, collection, query, where, orderBy, startAfter, limit, getDocs } from "https://www.gstatic.com/firebasejs/9.10.0/firebase-firestore.js";

export function initManageStudents(coordinator) {
    const tableBody = document.getElementById('students-table-body');
    let appDataCache = null;

    let currentPageSize = 50;
    let page = 1;
    let lastVisibleDoc = null;
    const prevButton = document.getElementById('student-prev-btn');
    const nextButton = document.getElementById('student-next-btn');
    const pageInfo = document.getElementById('student-page-info');
    const pageSizeSelect = document.getElementById('student-page-size-select');

    const getStudentFilters = () => ({
        name: (document.getElementById('student-filter-name') || {}).value?.trim().toLowerCase() || '',
        rollNo: (document.getElementById('student-filter-rollno') || {}).value?.trim().toLowerCase() || '',
        regNo: (document.getElementById('student-filter-regno') || {}).value?.trim().toLowerCase() || '',
        email: (document.getElementById('student-filter-email') || {}).value?.trim().toLowerCase() || '',
        year: (document.getElementById('student-filter-year') || {}).value || '',
        department: (document.getElementById('student-filter-department') || {}).value || '',
        section: (document.getElementById('student-filter-section') || {}).value || '',
    });
    
    const applyFilters = () => {
        page = 1; 
        lastVisibleDoc = null;
        renderStudents(getStudentFilters(), 'first');
    };

    const clearFilters = () => {
        // Clear only the non-fixed filters for coordinators
        document.getElementById('student-filter-name').value = '';
        document.getElementById('student-filter-rollno').value = '';
        document.getElementById('student-filter-regno').value = '';
        document.getElementById('student-filter-email').value = '';
        document.getElementById('student-filter-section').value = '';

        if(pageSizeSelect) pageSizeSelect.value = 50;
        currentPageSize = 50;
        if (tableBody) {
            tableBody.innerHTML = '<tr><td colspan="8" style="text-align:center;">Please click "Apply" to view students.</td></tr>';
        }
    };
    
    const populateStudentFilters = async () => {
        const deptSelect = document.getElementById('student-filter-department');
        const yearSelect = document.getElementById('student-filter-year');
        
        try {
            // Pre-fill and disable the coordinator's assigned department and year
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
            
            const metadataRef = doc(db, 'metadata', 'appData');
            const metadataSnap = await getDoc(metadataRef);
            if (metadataSnap.exists()) {
                appDataCache = metadataSnap.data();
                updateSectionFilter();
            }
        } catch (error) {
            console.error("Error populating student filters:", error);
        }
    };
    
    const updateSectionFilter = () => {
        const dept = document.getElementById('student-filter-department').value;
        const year = document.getElementById('student-filter-year').value;
        const sectionSelect = document.getElementById('student-filter-section');
        if (!sectionSelect) return;

        sectionSelect.innerHTML = `<option value="">All Sections</option>`;
        if (dept && year && appDataCache) {
            const key = `${dept}_${year}`;
            const sections = appDataCache[key]?.sections;
            if (sections) {
                (sections.sort() || []).forEach(opt => sectionSelect.innerHTML += `<option value="${opt}">${opt}</option>`);
            }
        }
    };

    const renderStudents = async (filters = {}, direction = 'first') => {
        try {
            if (tableBody) tableBody.innerHTML = '<tr><td colspan="8" style="text-align:center;">Loading...</td></tr>';
            if (direction === 'first') { page = 1; lastVisibleDoc = null; }

            let qConstraints = [where('role', '==', 'student')];
            if (filters.year) qConstraints.push(where('year', '==', filters.year));
            if (filters.department) qConstraints.push(where('department', '==', filters.department));
            if (filters.section) qConstraints.push(where('section', '==', filters.section));
            qConstraints.push(orderBy('email'));
            if (direction === 'next' && lastVisibleDoc) qConstraints.push(startAfter(lastVisibleDoc));
            qConstraints.push(limit(currentPageSize));

            const finalQuery = query(collection(db, 'users'), ...qConstraints);
            const snapshot = await getDocs(finalQuery);

            lastVisibleDoc = snapshot.docs[snapshot.docs.length - 1] || null;
            let students = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            students = students.filter(student => 
                (!filters.name || (student.name && student.name.toLowerCase().includes(filters.name))) &&
                (!filters.rollNo || (student.rollNo && String(student.rollNo).toLowerCase().includes(filters.rollNo))) &&
                (!filters.regNo || (student.regNo && String(student.regNo).toLowerCase().includes(filters.regNo))) &&
                (!filters.email || (student.email && student.email.toLowerCase().includes(filters.email)))
            );
            
            renderTable(students);
            updatePaginationUI(snapshot.size >= currentPageSize);
        } catch (error) { console.error("Error fetching students: ", error); }
    };
    
    // REMOVED: Delete button is gone from the table row.
    const renderTable = (students) => {
        tableBody.innerHTML = '';
        if (students.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="8" style="text-align:center;">No students found for the selected criteria.</td></tr>';
        } else {
            students.forEach((student, index) => {
                const row = document.createElement('tr');
                const sno = (page - 1) * currentPageSize + index + 1;
                row.innerHTML = `
                    <td>${sno}</td>
                    <td>${student.name || 'N/A'}</td>
                    <td>${student.rollNo || 'N/A'}</td>
                    <td>${student.regNo || 'N/A'}</td>
                    <td>${student.email || 'N/A'}</td>
                    <td>${student.year || 'N/A'}</td>
                    <td>${student.department || 'N/A'}</td>
                    <td>${student.section || 'N/A'}</td>`;
                tableBody.appendChild(row);
            });
        }
    };
    
    const updatePaginationUI = (hasNextPage) => {
        if (pageInfo) pageInfo.textContent = `Page ${page}`;
        if (prevButton) prevButton.disabled = (page === 1);
        if (nextButton) nextButton.disabled = !hasNextPage;
    };

    document.getElementById('student-apply-filter-btn')?.addEventListener('click', applyFilters);
    document.getElementById('student-clear-filter-btn')?.addEventListener('click', clearFilters);
    pageSizeSelect?.addEventListener('change', (e) => { currentPageSize = parseInt(e.target.value, 10); applyFilters(); });
    prevButton?.addEventListener('click', () => { if(page > 1) { page--; renderStudents(getStudentFilters(), 'prev'); } });
    nextButton?.addEventListener('click', () => { page++; renderStudents(getStudentFilters(), 'next'); });
    
    // REMOVED: Bulk upload buttons and delete listener are gone.

    populateStudentFilters();
    if (tableBody) {
        tableBody.innerHTML = '<tr><td colspan="8" style="text-align:center;">Please click "Apply" to view students.</td></tr>';
    }
}