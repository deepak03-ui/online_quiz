// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.10.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.10.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.10.0/firebase-auth.js";

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
// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);
export const auth = getAuth(app);
