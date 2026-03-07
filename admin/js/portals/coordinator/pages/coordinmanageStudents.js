// --- THIS IS THE COORDINATOR 'manageStudents.js' ---
// --- FIX: Filter dropdowns are now locked based on coordinator role ---

import { db } from '../../../shared/firebase-config.js';
import { 
    doc, getDoc, collection, writeBatch, arrayUnion, query, where, orderBy, 
    startAfter, limit, getDocs, deleteDoc, setDoc, updateDoc, increment 
} from "https://www.gstatic.com/firebasejs/9.10.0/firebase-firestore.js";

export function initManageStudents(coordinator) { // <-- ACCEPTS COORDINATOR
    const tableBody = document.getElementById('students-table-body');
    const contentArea = document.getElementById('dynamic-content-area');
    let appDataCache = null; 

    let currentPageSize = 50;
    let page = 1;
    let lastVisibleDoc = null;
    const prevButton = document.getElementById('student-prev-btn');
    const nextButton = document.getElementById('student-next-btn');
    const pageInfo = document.getElementById('student-page-info');
    const pageSizeSelect = document.getElementById('student-page-size-select');
    
    let currentlyRenderedStudents = []; 

    // --- Modal Helper Functions ---

    const createAndAppendModal = () => {
        if (document.getElementById('student-manage-modal')) return;

        const modalHTML = `
            <div id="student-manage-modal" class="modal-backdrop" style="display:none;">
                <div class="modal-content">
                    <button type="button" class="modal-close-btn">&times;</button>
                    <h3 id="student-modal-title">Manage Student</h3>
                    <form id="student-modal-form">
                        <input type="hidden" id="student-modal-original-email" />
                        <input type="hidden" id="student-modal-original-year" />
                        <input type="hidden" id="student-modal-original-department" />
                        <input type="hidden" id="student-modal-original-section" />
                        
                        <label for="student-modal-name">Name:</label>
                        <input type="text" id="student-modal-name" required />
                        
                        <label for="student-modal-email">Email:</label>
                        <input type="email" id="student-modal-email" required />
                        
                        <label for="student-modal-rollno">Roll No:</label>
                        <input type="text" id="student-modal-rollno" />
                        
                        <label for="student-modal-regno">Reg No:</label>
                        <input type="text" id="student-modal-regno" />

                        <label for="student-modal-year">Year:</label>
                        <select id="student-modal-year" required></select>
                        
                        <label for="student-modal-department">Department:</label>
                        <select id="student-modal-department" required></select>
                        
                        <label for="student-modal-section">Section:</label>
                        <select id="student-modal-section" required></select>
                        <input type="text" id="student-modal-new-section" placeholder="Or add new section" style="display:none;" />

                        <div class="modal-actions">
                            <button type="button" id="student-modal-save-btn" class="btn-primary">Save</button>
                            <button type="button" id="student-modal-cancel-btn" class="btn-secondary">Cancel</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        contentArea.insertAdjacentHTML('beforeend', modalHTML);
    };

    const populateModalDropdowns = () => {
        if (!appDataCache) return;
        
        const deptSelect = document.getElementById('student-modal-department');
        const yearSelect = document.getElementById('student-modal-year');

        // --- Coordinator-aware logic for MODAL dropdowns ---
        
        // 1. Department
        if (deptSelect) {
            let deptOptions = [];
            if (coordinator && coordinator.department) {
                // Use coordinator's assigned departments
                deptOptions = Array.isArray(coordinator.department) ? coordinator.department : [coordinator.department];
            } else if (appDataCache.departments) {
                // Fallback to all departments (admin-like)
                deptOptions = appDataCache.departments;
            }
            deptSelect.innerHTML = `<option value="">Select...</option>`;
            (deptOptions.sort() || []).forEach(opt => {
                deptSelect.innerHTML += `<option value="${opt}">${opt}</option>`;
            });
        }
        
        // 2. Year
        if (yearSelect) {
            let yearOptions = [];
            if (coordinator && coordinator.year) {
                // Use coordinator's assigned years
                yearOptions = Array.isArray(coordinator.year) ? coordinator.year : [coordinator.year];
            } else if (appDataCache.years) {
                // Fallback to all years (admin-like)
                yearOptions = appDataCache.years;
            }
            yearSelect.innerHTML = `<option value="">Select...</option>`;
            (yearOptions.sort() || []).forEach(opt => {
                yearSelect.innerHTML += `<option value="${opt}">${opt}</option>`;
            });
        }
    };


    const updateModalSectionFilter = () => {
        const dept = document.getElementById('student-modal-department').value;
        const year = document.getElementById('student-modal-year').value;
        const sectionSelect = document.getElementById('student-modal-section');

        if (!sectionSelect) return;
        sectionSelect.innerHTML = `<option value="">Select...</option>`;
        document.getElementById('student-modal-new-section').style.display = 'none';

        if (dept && year && appDataCache) {
            const key = `${dept}_${year}`;
            // Use appDataCache (from metadata) to find sections
            const sections = appDataCache[key]?.sections;
            if (sections) {
                (sections.sort() || []).forEach(opt => {
                    sectionSelect.innerHTML += `<option value="${opt}">${opt}</option>`;
                });
            }
        }
        sectionSelect.innerHTML += `<option value="__NEW__">Add New...</option>`;
    };
    
    const showAddStudentModal = () => {
        document.getElementById('student-modal-form').reset();
        document.getElementById('student-modal-title').textContent = 'Add New Student';
        document.getElementById('student-modal-email').disabled = false;
        
        populateModalDropdowns();
        
        // --- Pre-fill if coordinator is locked to one ---
        if (coordinator) {
            const deptSelect = document.getElementById('student-modal-department');
            if (coordinator.department && (!Array.isArray(coordinator.department) || coordinator.department.length === 1)) {
                deptSelect.value = Array.isArray(coordinator.department) ? coordinator.department[0] : coordinator.department;
            }
            
            const yearSelect = document.getElementById('student-modal-year');
             if (coordinator.year && (!Array.isArray(coordinator.year) || coordinator.year.length === 1)) {
                yearSelect.value = Array.isArray(coordinator.year) ? coordinator.year[0] : coordinator.year;
            }
        }

        updateModalSectionFilter(); 
        
        document.getElementById('student-manage-modal').style.display = 'flex'; 
    };

    const showEditStudentModal = (data) => {
        document.getElementById('student-modal-form').reset();
        document.getElementById('student-modal-title').textContent = 'Edit Student';
        
        document.getElementById('student-modal-original-email').value = data.id;
        document.getElementById('student-modal-original-year').value = data.year;
        document.getElementById('student-modal-original-department').value = data.department;
        document.getElementById('student-modal-original-section').value = data.section;
        
        document.getElementById('student-modal-name').value = data.name || '';
        document.getElementById('student-modal-email').value = data.email || '';
        document.getElementById('student-modal-email').disabled = true; 
        document.getElementById('student-modal-rollno').value = data.rollno || '';
        document.getElementById('student-modal-regno').value = data.regno || '';

        populateModalDropdowns();
        
        document.getElementById('student-modal-year').value = data.year || '';
        document.getElementById('student-modal-department').value = data.department || '';
        
        updateModalSectionFilter();
        document.getElementById('student-modal-section').value = data.section || '';

        document.getElementById('student-manage-modal').style.display = 'flex';
    };

    const hideStudentModal = () => {
        document.getElementById('student-manage-modal').style.display = 'none';
        document.getElementById('student-modal-form').reset();
    };

    const saveStudent = async () => {
        const originalEmail = document.getElementById('student-modal-original-email').value;
        const email = document.getElementById('student-modal-email').value.toLowerCase().trim();
        
        if (!email) {
            alert('Email is required.');
            return;
        }

        const docId = originalEmail || email; 
        
        const name = document.getElementById('student-modal-name').value.trim();
        const rollNo = document.getElementById('student-modal-rollno').value.trim();
        const regNo = document.getElementById('student-modal-regno').value.trim();
        const year = document.getElementById('student-modal-year').value;
        const department = document.getElementById('student-modal-department').value;
        
        let section = document.getElementById('student-modal-section').value;
        if (section === '__NEW__') {
            section = document.getElementById('student-modal-new-section').value.trim();
        }

        if (!year || !department || !section) {
            alert('Year, Department, and Section are required.');
            return;
        }

        const studentData = {
            name, email, rollNo, regNo, year, department, section,
            role: 'student'
        };

        try {
            const batch = writeBatch(db);
            
            batch.set(doc(db, 'users', docId), studentData, { merge: true });

            const metadataRef = doc(db, 'metadata', 'appData');
            const key = `${department}_${year}`;
            const metadataPayload = {
                departments: arrayUnion(department),
                years: arrayUnion(year),
                [key]: { sections: arrayUnion(section) }
            };
            batch.set(metadataRef, metadataPayload, { merge: true });
            
            const newCountKey = `${department}_${year}_${section}`;
            const newAssignmentDocId = `${department}_${year}`;
            const newAssignmentDocRef = doc(db, 'assignments', newAssignmentDocId);

            if (originalEmail) {
                const oldYear = document.getElementById('student-modal-original-year').value;
                const oldDept = document.getElementById('student-modal-original-department').value;
                const oldSection = document.getElementById('student-modal-original-section').value;
                
                const oldAssignmentDocId = `${oldDept}_${oldYear}`;
                const oldKey = `${oldDept}_${oldYear}_${oldSection}`;

                if (oldKey !== newCountKey && oldDept && oldYear && oldSection) {
                    const oldAssignmentDocRef = doc(db, 'assignments', oldAssignmentDocId);
                    batch.update(oldAssignmentDocRef, { [`studentcount.${oldKey}`]: increment(-1) });
                    
                    batch.set(newAssignmentDocRef, { studentcount: { [newCountKey]: increment(1) } }, { merge: true });
                }
            } else {
                batch.set(newAssignmentDocRef, { studentcount: { [newCountKey]: increment(1) } }, { merge: true });
            }

            await batch.commit();
            
            // Update cache if a new section was added
            if (section === document.getElementById('student-modal-new-section').value.trim()) {
                 if(appDataCache && appDataCache[key] && appDataCache[key].sections) {
                     appDataCache[key].sections.push(section);
                 }
            }

            alert('Student saved successfully!');
            hideStudentModal();
            applyFilters(); 
        } catch (error) {
            console.error('Error saving student:', error);
            alert('An error occurred while saving. Check the console.');
        }
    };

    // --- End of Modal Functions ---


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
        // --- UPDATED: Respect locked filters ---
        const deptSelect = document.getElementById('student-filter-department');
        const yearSelect = document.getElementById('student-filter-year');
        
        if (deptSelect && !deptSelect.disabled) deptSelect.value = '';
        if (yearSelect && !yearSelect.disabled) yearSelect.value = '';

        document.getElementById('student-filter-name').value = '';
        document.getElementById('student-filter-rollno').value = '';
        document.getElementById('student-filter-regno').value = '';
        document.getElementById('student-filter-email').value = '';
        document.getElementById('student-filter-section').value = '';
        
        if(pageSizeSelect) pageSizeSelect.value = 50;
        currentPageSize = 50;
        
        if (tableBody) {
            tableBody.innerHTML = '<tr><td colspan="9" style="text-align:center;">Please select filters and click "Apply" to view students.</td></tr>';
        }
        updatePaginationUI(false, false);
    };

    const handleBulkUpload = async () => {
        // This function is identical to the admin one and is fine
        // ... (omitted for brevity, it's the same as your provided file) ...
    };

    const handleBulkDelete = async () => {
        // This function is identical to the admin one and is fine
        // ... (omitted for brevity, it's the same as your provided file) ...
    };

    // --- **** THIS FUNCTION IS FULLY UPDATED **** ---
    const populateStudentFilters = async () => {
        const deptSelect = document.getElementById('student-filter-department');
        const yearSelect = document.getElementById('student-filter-year');

        try {
            // 1. Fetch metadata first, we always need it.
            if (!appDataCache) {
                const metadataRef = doc(db, 'metadata', 'appData');
                const metadataSnap = await getDoc(metadataRef);
                if (metadataSnap.exists()) {
                    appDataCache = metadataSnap.data();
                } else {
                    console.error("Metadata document not found!");
                    return;
                }
            }

            // Helper to populate a select (admin-style)
            const populateAdminSelect = (selectEl, options, label) => {
                if (selectEl) {
                    selectEl.innerHTML = `<option value="">All ${label}</option>`;
                    (options?.sort() || []).forEach(opt => selectEl.innerHTML += `<option value="${opt}">${opt}</option>`);
                    selectEl.disabled = false;
                }
            };
            
            // Helper to populate a select (coordinator multi-select-style)
            const populateCoordinatorSelect = (selectEl, options, label) => {
                if (selectEl) {
                    selectEl.innerHTML = `<option value="">All Assigned ${label}</option>`;
                    (options?.sort() || []).forEach(opt => selectEl.innerHTML += `<option value="${opt}">${opt}</option>`);
                    selectEl.disabled = false;
                }
            };

            let isDeptHandled = false;
            let isYearHandled = false;
            let isDeptLocked = false;
            let isYearLocked = false;

            if (coordinator) {
                // --- Department Handling ---
                if (deptSelect && coordinator.department) {
                    isDeptHandled = true;
                    if (Array.isArray(coordinator.department)) {
                        if (coordinator.department.length === 1) {
                            const dept = coordinator.department[0];
                            deptSelect.innerHTML = `<option value="${dept}">${dept}</option>`;
                            deptSelect.value = dept;
                            deptSelect.disabled = true;
                            isDeptLocked = true;
                        } else if (coordinator.department.length > 1) {
                            populateCoordinatorSelect(deptSelect, coordinator.department, 'Departments');
                        }
                    } else { // It's a string
                        deptSelect.innerHTML = `<option value="${coordinator.department}">${coordinator.department}</option>`;
                        deptSelect.value = coordinator.department;
                        deptSelect.disabled = true;
                        isDeptLocked = true;
                    }
                }

                // --- Year Handling ---
                if (yearSelect && coordinator.year) {
                    isYearHandled = true;
                    if (Array.isArray(coordinator.year)) {
                        if (coordinator.year.length === 1) {
                            const year = coordinator.year[0];
                            yearSelect.innerHTML = `<option value="${year}">${year}</option>`;
                            yearSelect.value = year;
                            yearSelect.disabled = true;
                            isYearLocked = true;
                        } else if (coordinator.year.length > 1) {
                            populateCoordinatorSelect(yearSelect, coordinator.year, 'Years');
                        }
                    } else { // It's a string
                        yearSelect.innerHTML = `<option value="${coordinator.year}">${coordinator.year}</option>`;
                        yearSelect.value = coordinator.year;
                        yearSelect.disabled = true;
                        isYearLocked = true;
                    }
                }
            }

            // --- Admin Fallback ---
            if (!isDeptHandled) {
                populateAdminSelect(deptSelect, appDataCache.departments, 'Departments');
            }
            if (!isYearHandled) {
                populateAdminSelect(yearSelect, appDataCache.years, 'Years');
            }

            // --- Final Setup ---
            if (isDeptLocked && isYearLocked) {
                await updateSectionFilter(); 
            } else {
                updateSectionFilter(); 
            }

        } catch (error) {
            console.error("Error populating student filters:", error);
        }
    };
    
    // --- THIS FUNCTION IS UPDATED ---
    const updateSectionFilter = () => {
        const dept = document.getElementById('student-filter-department').value;
        const year = document.getElementById('student-filter-year').value;
        const sectionSelect = document.getElementById('student-filter-section');

        if (!sectionSelect) return;
        
        const currentVal = sectionSelect.value; 
        sectionSelect.innerHTML = `<option value="">All Sections</option>`; 

        if (dept && year && appDataCache) {
            const key = `${dept}_${year}`;
            // --- UPDATED: Reads from appDataCache ---
            const sections = appDataCache[key]?.sections;
            if (sections) {
                (sections.sort() || []).forEach(opt => {
                    sectionSelect.innerHTML += `<option value="${opt}">${opt}</option>`;
                });
            }
        }
        sectionSelect.value = currentVal; 
    };

    // This is the admin renderStudents function, which is fine
    // ... (omitted for brevity, it's the same as your provided file) ...
    const renderStudents = async (filters = {}, direction = 'first') => {
        currentlyRenderedStudents = []; 
        
        try {
            if (tableBody) tableBody.innerHTML = '<tr><td colspan="9" style="text-align:center;">Loading...</td></tr>';
            
            const hasClientFilters = filters.name || filters.rollNo || filters.regNo || filters.email;

            if (direction === 'first') { page = 1; lastVisibleDoc = null; }

            let qConstraints = [where('role', '==', 'student')];
            if (filters.year) qConstraints.push(where('year', '==', filters.year));
            if (filters.department) qConstraints.push(where('department', '==', filters.department));
            if (filters.section) qConstraints.push(where('section', '==', filters.section));
            qConstraints.push(orderBy('email'));

            let snapshot;
            let students;

            if (hasClientFilters) {
                page = 1;
                const q = query(collection(db, 'users'), ...qConstraints);
                snapshot = await getDocs(q);
                students = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                students = students.filter(student => 
                    (!filters.name || (student.name && student.name.toLowerCase().includes(filters.name))) &&
                    (!filters.rollNo || (student.rollNo && String(student.rollNo).toLowerCase().includes(filters.rollNo))) &&
                    (!filters.regNo || (student.regNo && String(student.regNo).toLowerCase().includes(filters.regNo))) &&
                    (!filters.email || (student.email && student.email.toLowerCase().includes(filters.email)))
                );
                
                currentlyRenderedStudents = students; 
                renderTable(students, true); 
                updatePaginationUI(false, true); 

            } else {
                if (direction === 'next' && lastVisibleDoc) {
                    qConstraints.push(startAfter(lastVisibleDoc));
                }
                qConstraints.push(limit(currentPageSize));
                
                const q = query(collection(db, 'users'), ...qConstraints);
                snapshot = await getDocs(q);

                lastVisibleDoc = snapshot.docs.length === currentPageSize ? snapshot.docs[snapshot.docs.length - 1] : null;
                students = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                
                currentlyRenderedStudents = students; 
                renderTable(students, false); 
                updatePaginationUI(!!lastVisibleDoc, false); 
            }
            
        } catch (error) { 
            console.error("Error fetching students: ", error); 
            if (tableBody && error.code === 'failed-precondition') {
                 tableBody.innerHTML = '<tr><td colspan="9" style="text-align:center; color: red;"><b>Query Error:</b> A database index is required. Please check the browser console for a link to create it.</td></tr>';
            }
        }
    };
    
    // This is the admin renderTable function, which is fine
    // ... (omitted for brevity, it's the same as your provided file) ...
    const renderTable = (students, isFilteredList = false) => {
        tableBody.innerHTML = '';

        if (students.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="9" style="text-align:center;">No students found for the selected criteria.</td></tr>';
            currentlyRenderedStudents = []; 
        } else {
            students.forEach((student, index) => {
                const row = document.createElement('tr');
                const sno = isFilteredList ? (index + 1) : ((page - 1) * currentPageSize + index + 1);
                
                row.innerHTML = `
                    <td>${sno}</td>
                    <td>${student.name || 'N/A'}</td>
                    <td>${student.rollNo || 'N/A'}</td>
                    <td>${student.regNo || 'N/A'}</td>
                    <td>${student.email || 'N/A'}</td>
                    <td>${student.year || 'N/A'}</td>
                    <td>${student.department || 'N/A'}</td>
                    <td>${student.section || 'N/A'}</td>
                    <td>
                        <div class="table-actions">
                            <button class="btn-edit-secondary" 
                                data-id="${student.id}" 
                                data-name="${student.name || ''}" 
                                data-email="${student.email || ''}" 
                                data-rollno="${student.rollNo || ''}" 
                                data-regno="${student.regNo || ''}" 
                                data-year="${student.year || ''}" 
                                data-department="${student.department || ''}" 
                                data-section="${student.section || ''}">
                                Edit
                            </button>
                            <button class="btn-delete-secondary" 
                                data-id="${student.id}" 
                                data-name="${student.name || 'N/A'}"
                                data-year="${student.year || ''}" 
                                data-department="${student.department || ''}" 
                                data-section="${student.section || ''}">
                                Delete
                            </button>
                        </div>
                    </td>`;
                tableBody.appendChild(row);
            });
        }
    };
    
    // This is the admin updatePaginationUI function, which is fine
    // ... (omitted for brevity, it's the same as your provided file) ...
    const updatePaginationUI = (hasNextPage, hide = false) => {
        const controls = [prevButton, nextButton, pageSizeSelect, pageInfo];
        
        if (hide) {
            controls.forEach(el => { if (el) el.style.display = 'none'; });
            
            if (pageInfo) {
                pageInfo.style.display = ''; 
                pageInfo.textContent = `Displaying all ${currentlyRenderedStudents.length} filtered results`;
            }
        } else {
            controls.forEach(el => { if (el) el.style.display = ''; }); 
            
            if (pageInfo) {
                pageInfo.textContent = `Page ${page}`;
            }
            if (prevButton) prevButton.disabled = (page === 1);
            if (nextButton) nextButton.disabled = !hasNextPage;
        }
    };
    
    // --- Event Listeners ---
    document.getElementById('student-apply-filter-btn')?.addEventListener('click', applyFilters);
    document.getElementById('student-clear-filter-btn')?.addEventListener('click', clearFilters);
    pageSizeSelect?.addEventListener('change', (e) => { currentPageSize = parseInt(e.target.value, 10); applyFilters(); });
    prevButton?.addEventListener('click', () => { if(page > 1) { page = 1; lastVisibleDoc = null; renderStudents(getStudentFilters(), 'first'); } });
    nextButton?.addEventListener('click', () => { if (lastVisibleDoc) { page++; renderStudents(getStudentFilters(), 'next'); } });
    
    document.getElementById('student-filter-department')?.addEventListener('change', updateSectionFilter);
    document.getElementById('student-filter-year')?.addEventListener('change', updateSectionFilter);

    // This is the admin contentArea event listener, which is fine
    // ... (omitted for brevity, it's the same as your provided file) ...
    contentArea?.addEventListener('click', async (e) => {
        const target = e.target.closest('button');
        if (!target) return; 
        
        if (target.classList.contains('btn-edit-secondary')) {
            showEditStudentModal(target.dataset);
        }

        else if (target.classList.contains('btn-delete-secondary')) {
            if (confirm(`Are you sure you want to delete ${target.dataset.name}?`)) {
                const { id, year, department, section } = target.dataset;

                if (!id) return;

                try {
                    const batch = writeBatch(db);
                    batch.delete(doc(db, 'users', id));

                    if (year && department && section) {
                        const assignmentDocId = `${department}_${year}`;
                        const countKey = `${department}_${year}_${section}`;
                        const assignmentDocRef = doc(db, 'assignments', assignmentDocId);
                        batch.update(assignmentDocRef, { [`studentcount.${countKey}`]: increment(-1) });
                    }
                    
                    await batch.commit();
                    alert('Student deleted successfully.');
                    applyFilters(); 
                } catch (error) {
                    console.error("Error deleting student:", error);
                    alert('An error occurred while deleting. Check the console.');
                }
            }
        } 
        
        else if (target.id === 'add-student-btn') {
            showAddStudentModal();
        } 

        else if (target.id === 'student-delete-filtered-btn') {
            await handleBulkDelete();
        }
        
        else if (target.id === 'student-modal-save-btn') {
            await saveStudent();
        } 
        else if (target.id === 'student-modal-cancel-btn' || 
                   target.classList.contains('modal-close-btn') || 
                   e.target.id === 'student-manage-modal') 
        {
            hideStudentModal();
        }
        
        else if (target.id === 'show-student-upload-section-btn') {
            document.getElementById('student-bulk-upload-section').style.display = 'block';
        } else if (target.id === 'download-student-template-btn') {
            const headers = [['Name', 'Email', 'RollNo', 'RegNo', 'Year', 'Section', 'Department']];
            const ws = XLSX.utils.aoa_to_sheet(headers);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Template');
            XLSX.writeFile(wb, 'student_upload_template.xlsx');
        } else if (target.id === 'student-upload-button') {
            handleBulkUpload();
        }
    });

    contentArea?.addEventListener('change', (e) => {
        if (e.target.id === 'student-modal-department' || e.target.id === 'student-modal-year') {
            updateModalSectionFilter();
        }
        if (e.target.id === 'student-modal-section') {
            document.getElementById('student-modal-new-section').style.display = 
                (e.target.value === '__NEW__') ? 'block' : 'none';
        }
    });
    
    // --- Final Initialization ---
    populateStudentFilters(); // <-- This is the new coordinator-aware function
    createAndAppendModal(); 

    if (tableBody) {
        tableBody.innerHTML = '<tr><td colspan="9" style="text-align:center;">Please select filters and click "Apply" to view students.</td></tr>';
    }
}