// File: /js/portals/faculty/auth.js

// ✅ Corrected: Use the correct relative path to your config file.
import { db, auth } from '../../shared/firebase-config.js'; 

import { signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.10.0/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/9.10.0/firebase-firestore.js';

/**
 * Sets up the sign-out button functionality.
 */
export function setupSignOut() {
    const signOutBtn = document.getElementById('sign-out-btn');
    if (signOutBtn) {
        signOutBtn.addEventListener('click', () => {
            signOut(auth).then(() => {
                console.log('User signed out successfully.');
                window.location.href = '../index.html';
            }).catch((error) => {
                console.error('Sign Out Error:', error);
            });
        });
    }
}


/**
 * =========================================================================
 * ✅ REWRITTEN FUNCTION FOR THE NEW FIRESTORE STRUCTURE
 * =========================================================================
 * Checks auth state and retrieves all subject assignments for the logged-in faculty
 * from a single document.
 */
export async function getCurrentFaculty() {
    return new Promise(resolve => {
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                try {
                    const userDocRef = doc(db, 'users', user.email);
                    const userDocSnap = await getDoc(userDocRef);

                    if (!userDocSnap.exists() || userDocSnap.data().role !== 'faculty') {
                        console.error("Access Denied. No faculty record found for:", user.email);
                        window.location.href = '../index.html';
                        resolve(null);
                        return;
                    }
                    
                    const facultyDoc = userDocSnap.data();
                    
                    const subjectsList = [];
                    for (let i = 0; i < facultyDoc.subjectCodes.length; i++) {
                        for (let j = 0; j < facultyDoc.sections.length; j++) {
                            subjectsList.push({
                                // ✅ Changed to 'name' and 'email'
                                name: facultyDoc.name,
                                email: facultyDoc.email,
                                role: facultyDoc.role,
                                department: facultyDoc.departments[i] || facultyDoc.departments[0],
                                year: facultyDoc.years[i] || facultyDoc.years[0],
                                subjectCode: facultyDoc.subjectCodes[i],
                                subjectName: facultyDoc.subjectName[i],
                                section: facultyDoc.sections[j]
                            });
                        }
                    }
                    
                    const facultyData = {
                        info: {
                            // ✅ Changed to 'name' and 'email'
                            name: facultyDoc.name,
                            email: facultyDoc.email,
                            department: facultyDoc.departments.join(', ')
                        },
                        subjects: subjectsList 
                    };

                    const sidebarElement = document.getElementById('faculty-name-sidebar');
                    if (sidebarElement) {
                        // ✅ Updated to use 'name'
                        sidebarElement.textContent = `Welcome, ${facultyData.info.name}`;
                    }
                    
                    resolve(facultyData);

                } catch (error) {
                    console.error("Error fetching faculty data:", error);
                    alert("Error loading faculty data. Please try again.");
                    resolve(null);
                }

            } else {
                console.log('No user signed in.');
                window.location.href = '../index.html';
                resolve(null);
            }
        });
    });
}