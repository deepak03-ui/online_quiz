// js/user-management.js

// Import required Firebase modules
import { db } from './shared/firebase-config.js'; // CRITICAL: Ensure 'db' is exported here
import { 
    collection, getDocs, doc, setDoc, deleteDoc, 
    query, where, orderBy, updateDoc 
} from "https://www.gstatic.com/firebasejs/9.10.0/firebase-firestore.js";
import { 
    getAuth, createUserWithEmailAndPassword, updatePassword, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/9.10.0/firebase-auth.js";


// --- DOM ELEMENTS (Global references for efficiency) ---
const userModal = document.getElementById('user-modal');
const userForm = document.getElementById('user-form');
const userTableBody = document.getElementById('user-list-table-body');
const searchInput = document.getElementById('user-search-input');
const roleFilter = document.getElementById('user-role-filter');

let allUsers = []; 
let editingUserEmail = null; 

// --- FIREBASE INITIALIZATION ---
// NOTE: auth is retrieved, but client-side delete/update for OTHER users is restricted
let auth = null; 
if (db && db.app) {
    auth = getAuth(db.app); 
}


// --- USER INTERFACE HELPERS ---
function createUserRowHTML(user) {
    const roleBadge = (role) => {
        let color = 'bg-gray-200 text-gray-800';
        if (role === 'admin') color = 'bg-red-100 text-red-800';
        else if (role === 'Coordinator') color = 'bg-blue-100 text-blue-800';
        else if (role === 'Faculty') color = 'bg-yellow-100 text-yellow-800';
        else if (role === 'Student') color = 'bg-green-100 text-green-800';
        return `<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${color}">${role}</span>`;
    };

    return `
        <tr data-email="${user.email}" class="hover:bg-gray-50">
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${user.name || user.email.split('@')[0]}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${user.email}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${user.department || 'N/A'}</td>
            <td class="px-6 py-4 whitespace-nowrap">${roleBadge(user.role)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <button data-action="edit" data-email="${user.email}" class="text-pec-orange hover:text-orange-600 mr-3">Edit</button>
                <button data-action="delete" data-email="${user.email}" class="text-red-600 hover:text-red-900">Delete</button>
            </td>
        </tr>
    `;
}

function renderUsers(users) {
    if (!userTableBody) return;
    
    const searchTerm = searchInput.value.toLowerCase();
    const filterRole = roleFilter.value;

    const filteredUsers = users.filter(user => {
        const matchesSearch = user.email.toLowerCase().includes(searchTerm) || 
                              (user.name && user.name.toLowerCase().includes(searchTerm));
        const matchesRole = !filterRole || user.role === filterRole;
        return matchesSearch && matchesRole;
    }).sort((a, b) => a.role.localeCompare(b.role) || a.email.localeCompare(b.email));

    userTableBody.innerHTML = filteredUsers.map(createUserRowHTML).join('');

    if (filteredUsers.length === 0) {
         userTableBody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-gray-500">No users found matching the criteria.</td></tr>`;
    }
}


// --- FIREBASE DATA OPERATIONS (FIXES APPLIED HERE) ---

/**
 * Fetches all users from Firestore.
 */
async function fetchUsers() {
    if (!db) {
        console.error("CRITICAL: Firestore instance 'db' is undefined. Check firebase-config.js export.");
        if (userTableBody) userTableBody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-red-600 font-bold">FIREBASE ERROR: DB connection failed. Check console.</td></tr>`;
        return;
    }
    try {
        console.log("Attempting to fetch users from Firestore...");
        const usersRef = collection(db, "users");
        const q = query(usersRef, orderBy("role"), orderBy("email"));
        const snapshot = await getDocs(q);
        
        allUsers = snapshot.docs.map(doc => doc.data());
        console.log(`Successfully fetched ${allUsers.length} users.`);
        renderUsers(allUsers);
    } catch (error) {
        console.error("Error fetching users. Check Firestore Security Rules:", error);
        if (userTableBody) userTableBody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-red-600">FAILED to load users. Likely a Security Rule or Network issue.</td></tr>`;
    }
}

// ... [The saveUser, deleteUser, openModal, and closeModal functions remain the same] ...
async function saveUser(e) { /* ... same as before ... */ }
async function deleteUser(email) { /* ... same as before ... */ }
function openModal(user = null) { /* ... same as before ... */ }
function closeModal() { /* ... same as before ... */ }

// --- ENTRY POINT ---

export function initUserManagement(currentUser) {
    // 1. Initial Data Fetch
    // We only fetch if the required elements are present
    if (userTableBody && searchInput && roleFilter) {
        fetchUsers();
    } else {
        console.error("User Management DOM elements not found. Initialization failed.");
        return;
    }

    // 2. Event Listeners for Filters/Search
    searchInput.addEventListener('input', () => renderUsers(allUsers));
    roleFilter.addEventListener('change', () => renderUsers(allUsers));
    
    // 3. Event Listener for 'Add User' button
    document.getElementById('add-user-btn').addEventListener('click', () => openModal());

    // 4. Event Listener for 'Edit/Delete' actions on the table (Delegation)
    userTableBody.addEventListener('click', (e) => {
        const action = e.target.dataset.action;
        const email = e.target.dataset.email;
        
        if (action === 'edit') {
            const userToEdit = allUsers.find(u => u.email === email);
            if (userToEdit) openModal(userToEdit);
        } else if (action === 'delete') {
            deleteUser(email);
        }
    });

    // 5. Event Listener for Modal Form Submission
    userForm.addEventListener('submit', saveUser);
    
    // 6. Event Listener for Modal Close Button
    document.getElementById('close-modal-btn').addEventListener('click', closeModal);
    document.getElementById('cancel-modal-btn').addEventListener('click', closeModal);
}