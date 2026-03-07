// File: auth.js

import { db, auth } from '../../shared/firebase-config.js';
// V9 IMPORTS: We need doc and getDoc for fetching a single document.
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/9.10.0/firebase-firestore.js";

/**
 * Handles user sign-out.
 */
function setupSignOut() {
    const signOutBtn = document.getElementById('sign-out-btn');
    if (signOutBtn) {
        signOutBtn.addEventListener('click', () => {
            auth.signOut().then(() => {
                console.log('User signed out successfully.');
                window.location.href = '/index.html';
            }).catch((error) => {
                console.error('Sign Out Error:', error);
                alert('Could not sign out. Please try again.');
            });
        });
    }
}

/**
 * Checks the current authentication state and retrieves the coordinator's data.
 * @returns {Promise<object|null>} A promise that resolves with the coordinator's data object or null.
 */
async function getCurrentCoordinator() {
    return new Promise(resolve => {
        auth.onAuthStateChanged(async (user) => {
            if (user) {
                // V9 FIX: Use doc() to create a reference and getDoc() to fetch it.
                const userDocRef = doc(db, 'users', user.email);
                const userDocSnap = await getDoc(userDocRef);

                if (userDocSnap.exists() && userDocSnap.data().role === 'coordinator') { // V9 CHANGE: Use .exists()
                    const coordinatorData = userDocSnap.data();
                    
                    const nameElement = document.getElementById('coordinator-name-sidebar');
                    if (nameElement) {
                        nameElement.textContent = `Welcome, ${coordinatorData.name || 'Coordinator'}`;
                    }
                    
                    resolve(coordinatorData);
                } else {
                    console.error('Access Denied. User is not a coordinator.');
                    window.location.href = '/index.html';
                    resolve(null);
                }
            } else {
                console.log('No user signed in.');
                window.location.href = '/index.html';
                resolve(null);
            }
        });
    });
}

export { setupSignOut, getCurrentCoordinator }; 