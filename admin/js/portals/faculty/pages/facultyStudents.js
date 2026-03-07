// File: /js/portals/admin/pages/manageStudents.js
// --- This file is already correct and matches the new schema ---

import { db } from '../../../shared/firebase-config.js';
import { 
    doc, getDoc, collection, writeBatch, arrayUnion, query, where, orderBy, 
    startAfter, limit, getDocs, deleteDoc, setDoc, updateDoc, increment 
} from "https://www.gstatic.com/firebasejs/9.10.0/firebase-firestore.js";

export function initManageStudents() {
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

    // --- HELPER FUNCTION 1: Graduation Year (e.g., "2027") -> Study Year (e.g., "3") ---
    const calculateYearOfStudy = (graduationYear) => {
        const gradYearNum = parseInt(graduationYear, 10);
        if (!gradYearNum || isNaN(gradYearNum)) return 'N/A';
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth(); // 0 = Jan, 5 = June
        const admissionYear = gradYearNum - 4;
        const currentAcademicYearStart = currentMonth < 5 ? currentYear - 1 : currentYear;
        const yearOfStudy = currentAcademicYearStart - admissionYear + 1;
        if (yearOfStudy > 4) return 'Alumni';
        if (yearOfStudy <= 0) return 'Upcoming';
        return yearOfStudy.toString();
    };

    // --- HELPER FUNCTION 2: Study Year (e.g., "3") -> Graduation Year (e.g., "2027") ---
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
        return gradYear;
    };


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
        const populateSelect = (elId, options) => {
            const selectEl = document.getElementById(elId);
            if (!selectEl) return;
            selectEl.innerHTML = `<option value="">Select...</option>`;
            // We use 'appDataCache.years' which should be ["1", "2", "3", "4"]
            (options?.sort() || []).forEach(opt => {
                selectEl.innerHTML += `<option value="${opt}">${opt}</option>`;
            });
        };
        populateSelect('student-modal-year', appDataCache.years);
        populateSelect('student-modal-department', appDataCache.departments);
    };

    const updateModalSectionFilter = () => {
        const dept = document.getElementById('student-modal-department').value;
        const studyYear = document.getElementById('student-modal-year').value; // This is "1", "2", etc.
        const sectionSelect = document.getElementById('student-modal-section');

        if (!sectionSelect) return;
        sectionSelect.innerHTML = `<option value="">Select...</option>`;
        document.getElementById('student-modal-new-section').style.display = 'none';

        if (dept && studyYear && appDataCache) {
            // Convert to graduation year to find the sections
            const gradYear = getGraduationYearFromStudyYear(studyYear);
            if (!gradYear) return;
            
            // --- This part now correctly reads 'assignments' doc ---
            const key = `${dept}_${gradYear}`; // e.g., "ADS_2027"
            
            // We need to read sections from the 'assignments' doc, not appDataCache
            // Let's modify this to use the assignments collection
            (async () => {
                try {
                    const assignRef = doc(db, 'assignments', key);
                    const assignSnap = await getDoc(assignRef);
                    let sections = [];
                    if (assignSnap.exists()) {
                        sections = assignSnap.data().sections || [];
                    }
                    (sections.sort() || []).forEach(opt => {
                        sectionSelect.innerHTML += `<option value="${opt}">${opt}</option>`;
                    });
                } catch(e) {
                    console.error("Error fetching sections for modal: ", e);
                } finally {
                    sectionSelect.innerHTML += `<option value="__NEW__">Add New...</option>`;
                }
            })();
        } else {
             sectionSelect.innerHTML += `<option value="__NEW__">Add New...</option>`;
        }
    };
    
    const showAddStudentModal = () => {
        document.getElementById('student-modal-form').reset();
        document.getElementById('student-modal-title').textContent = 'Add New Student';
        document.getElementById('student-modal-email').disabled = false;
        
        populateModalDropdowns();
        updateModalSectionFilter();
        
        document.getElementById('student-manage-modal').style.display = 'flex';
    };

    const showEditStudentModal = (data) => {
        document.getElementById('student-modal-form').reset();
        document.getElementById('student-modal-title').textContent = 'Edit Student';
        
        const studyYear = calculateYearOfStudy(data.year); 
        
        document.getElementById('student-modal-original-email').value = data.id;
        document.getElementById('student-modal-original-year').value = data.year; // Stores "2027"
        document.getElementById('student-modal-original-department').value = data.department;
        document.getElementById('student-modal-original-section').value = data.section;
        
        document.getElementById('student-modal-name').value = data.name || '';
        document.getElementById('student-modal-email').value = data.email || '';
        document.getElementById('student-modal-email').disabled = false;
        document.getElementById('student-modal-rollno').value = data.rollno || '';
        document.getElementById('student-modal-regno').value = data.regno || '';

        populateModalDropdowns();
        
        document.getElementById('student-modal-year').value = studyYear || ''; // Sets dropdown to "3"
        document.getElementById('student-modal-department').value = data.department || '';
        
        updateModalSectionFilter();
        // Needs a slight delay for sections to populate
        setTimeout(() => {
            document.getElementById('student-modal-section').value = data.section || '';
        }, 100);

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
        const department = document.getElementById('student-modal-department').value;
        
        const studyYear = document.getElementById('student-modal-year').value; // This is "1", "2", etc.
        let section = document.getElementById('student-modal-section').value;
        if (section === '__NEW__') {
            section = document.getElementById('student-modal-new-section').value.trim();
        }

        if (!studyYear || !department || !section) {
            alert('Year, Department, and Section are required.');
            return;
        }
        
        const graduationYear = getGraduationYearFromStudyYear(studyYear);
        if (!graduationYear) {
            alert('Invalid study year selected.');
            return;
        }

        const studentData = {
            name, email, rollNo, regNo, 
            year: graduationYear.toString(), // <-- SAVES "2027"
            department, section,
            role: 'student'
        };

        try {
            const batch = writeBatch(db);
            
            batch.set(doc(db, 'users', docId), studentData, { merge: true });

            const metadataRef = doc(db, 'metadata', 'appData');
            const key = `${department}_${graduationYear}`;
            const metadataPayload = {
                departments: arrayUnion(department),
                years: arrayUnion(studyYear),
                // We no longer store sections in appDataCache, so we remove this
                // [key]: { sections: arrayUnion(section) } 
            };
            batch.set(metadataRef, metadataPayload, { merge: true });
            
            const newCountKey = `${department}_${graduationYear}_${section}`;
            const newAssignmentDocId = `${department}_${graduationYear}`;
            const newAssignmentDocRef = doc(db, 'assignments', newAssignmentDocId);

            if (originalEmail) {
                const oldGraduationYear = document.getElementById('student-modal-original-year').value;
                const oldDept = document.getElementById('student-modal-original-department').value;
                const oldSection = document.getElementById('student-modal-original-section').value;
                
                const oldAssignmentDocId = `${oldDept}_${oldGraduationYear}`;
                const oldKey = `${oldDept}_${oldGraduationYear}_${oldSection}`;

                if (oldKey !== newCountKey && oldDept && oldGraduationYear && oldSection) {
                    const oldAssignmentDocRef = doc(db, 'assignments', oldAssignmentDocId);
                    batch.update(oldAssignmentDocRef, { [`studentcount.${oldKey}`]: increment(-1) });
                    
                    batch.set(newAssignmentDocRef, { 
                        studentcount: { [newCountKey]: increment(1) },
                        sections: arrayUnion(section)
                    }, { merge: true });
                }
            } else {
                batch.set(newAssignmentDocRef, { 
                    studentcount: { [newCountKey]: increment(1) },
                    sections: arrayUnion(section)
                }, { merge: true });
            }

            await batch.commit();
            
            alert('Student saved successfully!');
            hideStudentModal();
            await populateStudentFilters();
            applyFilters();
        } catch (error) {
            console.error('Error saving student:', error);
            alert('An error occurred while saving. Check the console.');
        }
    };


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
        document.querySelectorAll('.filter-card input, .filter-card select').forEach(el => el.value = '');
        if(pageSizeSelect) pageSizeSelect.value = 50;
        currentPageSize = 50;
        if (tableBody) {
            tableBody.innerHTML = '<tr><td colspan="9" style="text-align:center;">Please select filters and click "Apply" to view students.</td></tr>';
        }
    };

    const handleBulkUpload = async () => {
        const fileInput = document.getElementById('student-file-upload');
        if (typeof XLSX === 'undefined') return alert('XLSX library not loaded.');
        if (!fileInput || fileInput.files.length === 0) return alert('Please select a file.');

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
                const allDepts = new Set(), allYears = new Set();
                
                const studentCounts = {}; 
                const assignmentSections = {}; 

                rows.forEach(row => {
                    const email = (row.Email || row.email || '').toLowerCase().trim();
                    if (!email) return;
                    
                    const graduationYear = row.Year ? String(row.Year).trim() : null;
                    const department = row.Department ? String(row.Department).trim() : null;
                    const section = row.Section ? String(row.Section).trim() : null;
                    
                    const studentData = { 
                        role: 'student', 
                        name: row.Name || row.name || null, 
                        rollNo: row.RollNo || row.rollNo || null, 
                        regNo: row.RegNo || row.regNo || null, 
                        email, 
                        year: graduationYear, // Saves "2027"
                        department, 
                        section 
                    };
                    batch.set(doc(db, 'users', email), studentData, { merge: true });
                    
                    if (department && graduationYear && section) {
                        // For 'assignments' student count
                        const countKey = `${department}_${graduationYear}_${section}`;
                        studentCounts[countKey] = (studentCounts[countKey] || 0) + 1;
                        
                        // For 'assignments' sections list
                        const assignmentDocId = `${department}_${graduationYear}`;
                        if (!assignmentSections[assignmentDocId]) {
                            assignmentSections[assignmentDocId] = new Set();
                        }
                        assignmentSections[assignmentDocId].add(section);
                    }
                    
                    if (department) allDepts.add(department);
                    if (graduationYear) {
                         const studyYear = calculateYearOfStudy(graduationYear);
                         if(studyYear !== 'N/A') allYears.add(studyYear);
                    }
                });
                
                // 1. Update 'metadata/appData' (only depts and years)
                const metadataRef = doc(db, 'metadata', 'appData');
                batch.set(metadataRef, { 
                    departments: arrayUnion(...allDepts), 
                    years: arrayUnion(...allYears),
                }, { merge: true });
                
                // 2. Build and update 'assignments' documents
                const assignmentsPayload = {};
                
                for (const countKey in studentCounts) {
                    const count = studentCounts[countKey];
                    const parts = countKey.split('_');
                    const docId = `${parts[0]}_${parts[1]}`; // e.g., ADS_2027
                    
                    if (!assignmentsPayload[docId]) assignmentsPayload[docId] = { studentcount: {} };
                    assignmentsPayload[docId].studentcount[countKey] = increment(count); // Use increment for safety
                }

                for (const docId in assignmentSections) {
                    if (!assignmentsPayload[docId]) assignmentsPayload[docId] = {};
                    assignmentsPayload[docId].sections = arrayUnion(...Array.from(assignmentSections[docId]));
                }

                for (const docId in assignmentsPayload) {
                    const assignmentDocRef = doc(db, 'assignments', docId);
                    batch.set(assignmentDocRef, assignmentsPayload[docId], { merge: true });
                }

                await batch.commit();
                alert(`Successfully uploaded ${rows.length} student records!`);
                fileInput.value = '';
                document.getElementById('student-bulk-upload-section').style.display = 'none';
                
                await populateStudentFilters(); // Re-fetch cache
                applyFilters();
                
            } catch (error) {
                console.error("Error processing bulk upload:", error);
                alert("An error occurred during upload. Check console for details.");
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const handleBulkDelete = async () => {
        // ... (this function is correct, no changes needed) ...
        const filters = getStudentFilters();
        if (!filters.year || !filters.department) {
            alert('Error: To prevent accidental deletion, you must at least filter by Year and Department.');
            return;
        }
        const graduationYear = getGraduationYearFromStudyYear(filters.year);
        if (!graduationYear) {
            alert('Error: Invalid year selected.');
            return;
        }
        let filterDesc = `Year: ${filters.year} (Batch: ${graduationYear})\nDepartment: ${filters.department}`;
        if (filters.section) filterDesc += `\nSection: ${filters.section}`;
        // ... (add other filters to description)
        if (!confirm(`You are about to delete ALL students matching:\n\n${filterDesc}\n\nAre you sure?`)) {
            return;
        }
        if (!confirm(`FINAL WARNING: This action is irreversible.\n\nProceed with deletion?`)) {
            return;
        }
        try {
            let qConstraints = [where('role', '==', 'student')];
            qConstraints.push(where('year', '==', graduationYear.toString()));
            qConstraints.push(where('department', '==', filters.department));
            if (filters.section) qConstraints.push(where('section', '==', filters.section));
            const q = query(collection(db, 'users'), ...qConstraints);
            const snapshot = await getDocs(q);
            let allFetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const studentsToDelete = allFetched.filter(student => 
                (!filters.name || (student.name && student.name.toLowerCase().includes(filters.name))) &&
                (!filters.rollNo || (student.rollNo && String(student.rollNo).toLowerCase().includes(filters.rollNo))) &&
                (!filters.regNo || (student.regNo && String(student.regNo).toLowerCase().includes(filters.regNo))) &&
                (!filters.email || (student.email && student.email.toLowerCase().includes(filters.email)))
            );
            if (studentsToDelete.length === 0) {
                alert('No students found matching all specified filters. Nothing to delete.');
                return;
            }
            alert(`Found ${studentsToDelete.length} students to delete. Starting operation...`);
            const countsToDecrement = {};
            for (const student of studentsToDelete) {
                const { year, department, section } = student;
                if (year && department && section) {
                    const assignmentDocId = `${department}_${year}`;
                    const countKey = `${department}_${year}_${section}`;
                    if (!countsToDecrement[assignmentDocId]) countsToDecrement[assignmentDocId] = {};
                    countsToDecrement[assignmentDocId][countKey] = (countsToDecrement[assignmentDocId][countKey] || 0) + 1;
                }
            }
            const batchSize = 450;
            for (let i = 0; i < studentsToDelete.length; i += batchSize) {
                const batch = writeBatch(db);
                const chunk = studentsToDelete.slice(i, i + batchSize);
                for (const student of chunk) {
                    batch.delete(doc(db, 'users', student.id));
                }
                await batch.commit();
            }
            const countBatch = writeBatch(db);
            for (const assignmentDocId in countsToDecrement) {
                const assignmentDocRef = doc(db, 'assignments', assignmentDocId);
                const updates = {};
                for (const countKey in countsToDecrement[assignmentDocId]) {
                    const amount = countsToDecrement[assignmentDocId][countKey];
                    updates[`studentcount.${countKey}`] = increment(-amount);
                }
                countBatch.update(assignmentDocRef, updates);
            }
            await countBatch.commit();
            alert(`Successfully deleted ${studentsToDelete.length} students and updated student counts.`);
            applyFilters();
        } catch (error) {
            console.error("Error during bulk delete:", error);
            alert(`An error occurred during bulk deletion. ${error.message}.`);
        }
    };

    const populateStudentFilters = async () => {
        // ... (this function is correct, no changes needed) ...
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
                populateSelect('student-filter-year', data.years, 'Years');
                populateSelect('student-filter-department', data.departments, 'Departments');
            }
        } catch (error) {
            console.error("Error populating student filters from metadata:", error);
        }
    };
    
    // --- UPDATED: Fetches sections from 'assignments' ---
    const updateSectionFilter = () => {
        const dept = document.getElementById('student-filter-department').value;
        const studyYear = document.getElementById('student-filter-year').value;
        const sectionSelect = document.getElementById('student-filter-section');

        if (!sectionSelect) return;
        sectionSelect.innerHTML = `<option value="">All Sections</option>`;

        if (dept && studyYear) {
            const gradYear = getGraduationYearFromStudyYear(studyYear);
            if (!gradYear) return;
            
            const key = `${dept}_${gradYear}`; // e.g., "ADS_2027"
            
            (async () => {
                try {
                    const assignRef = doc(db, 'assignments', key);
                    const assignSnap = await getDoc(assignRef);
                    if (assignSnap.exists()) {
                        const sections = assignSnap.data().sections || [];
                        (sections.sort() || []).forEach(opt => {
                            sectionSelect.innerHTML += `<option value="${opt}">${opt}</option>`;
                        });
                    }
                } catch(e) {
                    console.error("Error fetching sections for filter: ", e);
                }
            })();
        }
    };

    const renderStudents = async (filters = {}, direction = 'first') => {
        // ... (this function is correct, no changes needed) ...
        try {
            if (tableBody) tableBody.innerHTML = '<tr><td colspan="9" style="text-align:center;">Loading...</td></tr>';
            if (direction === 'first') { page = 1; lastVisibleDoc = null; }
            let qConstraints = [where('role', '==', 'student')];
            if (filters.year) {
                const graduationYear = getGraduationYearFromStudyYear(filters.year);
                if (graduationYear) {
                    qConstraints.push(where('year', '==', graduationYear.toString()));
                } else {
                    renderTable([]);
                    updatePaginationUI(false);
                    return;
                }
            }
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
            updatePaginationUI(snapshot.docs.length >= currentPageSize); // Corrected logic
        } catch (error) { 
            console.error("Error fetching students: ", error); 
            if (tableBody && error.code === 'failed-precondition') {
                 tableBody.innerHTML = '<tr><td colspan="9" class="text-center text-red-500"><b>Query Error:</b> A database index is required.</td></tr>';
            }
        }
    };
    
    const renderTable = (students) => {
        // ... (this function is correct, no changes needed) ...
        tableBody.innerHTML = '';
        if (students.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="9" style="text-align:center;">No students found for the selected criteria.</td></tr>';
        } else {
            students.forEach((student, index) => {
                const row = document.createElement('tr');
                const sno = (page - 1) * currentPageSize + index + 1;
                const displayYear = calculateYearOfStudy(student.year);
                row.innerHTML = `
                    <td>${sno}</td>
                    <td>${student.name || 'N/A'}</td>
                    <td>${student.rollNo || 'N/A'}</td>
                    <td>${student.regNo || 'N/A'}</td>
                    <td>${student.email || 'N/A'}</td>
                    <td>${displayYear || 'N/A'}</td>
                    <td>${student.department || 'N/A'}</td>
                    <td>${student.section || 'N/A'}</td>
                    <td>
                        <div class="table-actions">
                           
                           
                        </div>
                    </td>`;
                tableBody.appendChild(row);
            });
        }
    };
    
    const updatePaginationUI = (hasNextPage) => {
        // ... (this function is correct, no changes needed) ...
        if (pageInfo) pageInfo.textContent = `Page ${page}`;
        if (prevButton) prevButton.disabled = (page === 1);
        if (nextButton) nextButton.disabled = !hasNextPage;
    };
    
    // --- (Event listeners are correct, no changes needed) ---
    document.getElementById('student-apply-filter-btn')?.addEventListener('click', applyFilters);
    document.getElementById('student-clear-filter-btn')?.addEventListener('click', clearFilters);
    pageSizeSelect?.addEventListener('change', (e) => { currentPageSize = parseInt(e.target.value, 10); applyFilters(); });
    prevButton?.addEventListener('click', () => { if(page > 1) { page--; renderStudents(getStudentFilters(), 'prev'); } });
    nextButton?.addEventListener('click', () => { page++; renderStudents(getStudentFilters(), 'next'); });
    document.getElementById('student-filter-department')?.addEventListener('change', updateSectionFilter);
    document.getElementById('student-filter-year')?.addEventListener('change', updateSectionFilter);
    contentArea?.addEventListener('click', async (e) => {
        const target = e.target.closest('button');
        if (!target) {
            if (e.target.id === 'student-manage-modal') {
                hideStudentModal();
            }
            return;
        }
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
        else if (target.id === 'delete-filtered-students-btn') {
            await handleBulkDelete();
        }
        else if (target.id === 'student-modal-save-btn') {
            await saveStudent();
        } 
        else if (target.id === 'student-modal-cancel-btn' || target.classList.contains('modal-close-btn')) {
            hideStudentModal();
        }
        else if (target.id === 'show-student-upload-section-btn') {
            document.getElementById('student-bulk-upload-section').style.display = 'block';
        } 
        else if (target.id === 'download-student-template-btn') {
            const headers = [['Name', 'Email', 'RollNo', 'RegNo', 'Year', 'Section', 'Department']];
            const ws = XLSX.utils.aoa_to_sheet(headers);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Template');
            XLSX.writeFile(wb, 'student_upload_template.xlsx');
        } 
        else if (target.id === 'student-upload-button') {
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
    populateStudentFilters();
    createAndAppendModal();

    if (tableBody) {
        tableBody.innerHTML = '<tr><td colspan="9" style="text-align:center;">Please select filters and click "Apply" to view students.</td></tr>';
    }
}