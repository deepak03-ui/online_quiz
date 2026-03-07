// js/login.js

// IMPORTANT: This assumes you have a file at './shared/firebase-config.js' 
// that exports the initialized Firebase app.

import { initializeFirebase } from './shared/firebase-config.js'; 
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    GoogleAuthProvider,     
    signInWithPopup,
    // Add these if you need state tracking, though usually handled in the dashboard's ui.js
    // onAuthStateChanged,
    // signOut
} from "https://www.gstatic.com/firebasejs/9.10.0/firebase-auth.js"; 
import { 
    getFirestore, 
    doc, 
    getDoc, 
    setDoc          
} from "https://www.gstatic.com/firebasejs/9.10.0/firebase-firestore.js";

// --- INITIALIZATION ---
const { app } = initializeFirebase(); // Initialize the Firebase App
const auth = getAuth(app);
const db = getFirestore(app);

// --- DOM ELEMENTS ---
const emailLoginForm = document.getElementById('email-login-form');
const googleBtn = document.getElementById('google-login-btn');
const errorEl = document.getElementById('auth-error');
const loadingEl = document.getElementById('loading-message');
const loginBtn = document.getElementById('login-btn');


// --- HELPER FUNCTION: UI MANAGEMENT ---

/**
 * Updates the UI state (loading, error) and disables/enables buttons.
 */
function updateUIStatus(isLoading, message = '', isError = false) {
    loadingEl.classList.toggle('hidden', !isLoading);
    // Disable both buttons while loading
    loginBtn.disabled = isLoading;
    googleBtn.disabled = isLoading;
    
    // Manage error message visibility
    errorEl.classList.toggle('hidden', !isError);
    if (isError) {
        errorEl.textContent = message;
    } else {
        errorEl.textContent = '';
    }
}


// --- CORE REDIRECTION LOGIC ---

/**
 * Fetches user profile, determines role, and redirects.
 * Creates a default student profile if a Google user is new.
 * @param {object} user - The Firebase User object from a successful sign-in.
 */
async function redirectUserByRole(user) {
    updateUIStatus(true, 'Checking user role and profile...');

    try {
        const email = user.email;
        const userDocRef = doc(db, "users", email);
        let userDoc = await getDoc(userDocRef);

        let userData;
        
        if (!userDoc.exists()) {
            // New user case (usually from Google Sign-In or initial unpopulated DB)
            userData = {
                email: email,
                name: user.displayName || email.split('@')[0],
                role: 'Student', // Assign default role
                createdAt: new Date().toISOString(),
            };
            // Create the new profile in Firestore
            await setDoc(userDocRef, userData);
        } else {
            userData = userDoc.data();
        }

        const role = userData.role || 'Student'; // Ensure a fallback role

        // Store user data in session storage for the dashboard scripts (ui.js / admin-ui.js)
        sessionStorage.setItem('currentUser', JSON.stringify(userData));

        // Redirect based on role
        if (role === 'student') {
            window.location.href = 'student-dashboard.html'; // Existing Student Dashboard
        } else {
            // Administrator, Coordinator, Faculty all use the same admin entry page
            window.location.href = 'admin-dashboard.html'; 
        }

    } catch (error) {
        console.error("Role determination/Redirection Error:", error);
        updateUIStatus(false, `Login successful, but redirection failed: ${error.message}`, true);
    }
}


// --- 1. EMAIL/PASSWORD SIGN-IN HANDLER ---

emailLoginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    updateUIStatus(true, 'Signing in...');

    const email = emailLoginForm.email.value;
    const password = emailLoginForm.password.value;

    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        await redirectUserByRole(userCredential.user);

    } catch (error) {
        console.error("Email/Password Login Error:", error);
        let message = "Authentication failed. Invalid email or password.";
        // You can add more specific Firebase error codes here if needed
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
             message = "Invalid email or password. Please check your credentials.";
        }
        updateUIStatus(false, message, true);
    }
});


// --- 2. GOOGLE SIGN-IN HANDLER ---

googleBtn.addEventListener('click', async () => {
    updateUIStatus(true, 'Signing in with Google...');
    
    const provider = new GoogleAuthProvider();
    // OPTIONAL: Uncomment to restrict sign-in to the institutional domain
    // provider.setCustomParameters({ hd: 'pec.edu' }); 

    try {
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        
        // Use the core function to check profile, create if new, and redirect
        await redirectUserByRole(user); 

    } catch (error) {
        console.error("Google Sign-In Error:", error);
        let message = "Google Sign-in failed.";
        
        if (error.code === 'auth/popup-closed-by-user') {
            message = "Sign-in cancelled by user.";
        } else if (error.code === 'auth/cancelled-popup-request') {
            message = "Sign-in attempt blocked. Please try again.";
        } else if (error.code === 'auth/unauthorized-domain') {
            message = "Authentication domain error. Check Firebase Console authorized domains.";
        }
        
        updateUIStatus(false, message, true);
    }
});