// js/shared/firebase-config.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.10.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.10.0/firebase-firestore.js";
// !!! IMPORTANT: REPLACE THESE PLACEHOLDERS WITH YOUR ACTUAL FIREBASE CONFIG !!!
const firebaseConfig = {
    apiKey: "AIzaSyAzgcmChgb_Ko0gvkrOuYK5WxF7PRtIHbw",
    authDomain: "logindevice-20fed.firebaseapp.com",
    projectId: "logindevice-20fed",
    storageBucket: "logindevice-20fed.firebasestorage.app",
    messagingSenderId: "328827294527",
    appId: "1:328827294527:web:7ad4db038b6d35de34398a",
    measurementId: "G-DF1NHVCMW8"
};

/**
 * Initializes the Firebase App instance.
 * @returns {{app: import("firebase/app").FirebaseApp}} The initialized Firebase app object.
 */
export function initializeFirebase() {
    try {
        const app = initializeApp(firebaseConfig);
        console.log("Firebase App Initialized Successfully.");
        return { app };
    } catch (e) {
        console.error("CRITICAL ERROR: Firebase Initialization Failed.", e);
        // Display a user-friendly error on the login page
        const errorEl = document.getElementById('auth-error');
        if (errorEl) {
            errorEl.textContent = "System Error: Failed to connect to backend services. Check Console for details.";
            errorEl.classList.remove('hidden');
        }
        throw e;
    }
}

let dbInstance = null;

try {
    const app = initializeApp(firebaseConfig);
    dbInstance = getFirestore(app);
    console.log("Firebase App & Firestore Initialized.");
} catch (e) {
    console.error("CRITICAL ERROR: Firebase Initialization Failed. Check network/config.", e);
}

// Export the Firestore instance
export const db = dbInstance;