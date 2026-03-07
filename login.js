/**
 * login.js (Consolidated)
 * ===================================================================================
 * Handles user authentication for the login page (index.html).
 */

import { GoogleAuthProvider, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import { initializeFirebase } from './firebase-config.js';

document.addEventListener('DOMContentLoaded', () => {
    const { auth, db } = initializeFirebase();
    const googleSignInBtn = document.getElementById('google-signin-btn');
    const authErrorMsg = document.getElementById('auth-error-message');

    const showAuthError = (message) => {
        authErrorMsg.textContent = message;
        authErrorMsg.style.display = 'block';
    };

    const calculateYearOfStudy = (graduationYear) => {
        if (!graduationYear || isNaN(graduationYear)) return 'N/A';
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();
        const admissionYear = graduationYear - 4;
        const currentAcademicYearStart = currentMonth < 5 ? currentYear - 1 : currentYear;
        const yearOfStudy = currentAcademicYearStart - admissionYear + 1;

        if (yearOfStudy > 4) return 'Alumni';
        if (yearOfStudy <= 0) return 'Upcoming';
        return yearOfStudy;
    };

    googleSignInBtn.addEventListener('click', () => {
        const provider = new GoogleAuthProvider();
        authErrorMsg.style.display = 'none';
        signInWithPopup(auth, provider)
            .then(result => result.user && checkUserRoleAndRedirect(result.user.email))
            .catch(error => {
                console.error("Google Sign-In Error:", error);
                const msg = error.code === 'auth/popup-closed-by-user' ?
                    'Sign-in process was cancelled.' :
                    'An error occurred during sign-in.';
                showAuthError(msg + ' Please try again.');
            });
    });

    const checkUserRoleAndRedirect = async (email) => {
        const userDocRef = doc(db, 'users', email);
        try {
            const docSnap = await getDoc(userDocRef);
            if (docSnap.exists()) {
                const userData = docSnap.data();
                if (userData.role === 'student') {
                    userData.year = calculateYearOfStudy(parseInt(userData.year, 10));
                    userData.email = userData.email || email;
                    sessionStorage.setItem('studentProfile', JSON.stringify(userData));
                    window.location.href = 'student-new2.html';
                } else if (['admin', 'coordinator', 'faculty'].includes(userData.role)) {
                    window.location.href = `admin/${userData.role}.html`;
                } else {
                    throw new Error('Your account does not have a valid role.');
                }
            } else {
                throw new Error('Your email is not registered.');
            }
        } catch (error) {
            console.error("Role Check Error:", error);
            showAuthError(`Access Denied. ${error.message}`);
            signOut(auth);
        }
    };
});
