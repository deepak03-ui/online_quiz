import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

// Your web app's Firebase configuration
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
 * Initializes Firebase and returns the auth and firestore services.
 * This function ensures that Firebase is only initialized once.
 * @returns {object} An object containing the 'auth' and 'db' services.
 */
export function initializeFirebase() {
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    const auth = getAuth(app);
    const db = getFirestore(app);
    return { auth, db };
}

