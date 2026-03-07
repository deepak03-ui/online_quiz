/**
     * ===================================================================================
     * Main Application Script for the Student Dashboard (student-new.html)
     * ===================================================================================
     * This script handles:
     * 1. Authentication state changes via Firebase.
     * 2. Loading the student profile exclusively from sessionStorage.
     * 3. Fetching eligible tests using an efficient multi-query strategy.
     * 4. Dynamically loading and rendering all UI components.
     * 5. Setting up global event handlers for modals and user actions.
     * ===================================================================================
     */
import { initializeFirebase } from '../../firebase-config.js';
// 1. DEFINE auth and db GLOBALLY in this script's scope
let auth = null; 
let db = null;
import { storeTestData, setupGlobalModalHandlers, buildNav, activateFirstVisibleSection } from './common2.js';
import { fetchAvailableTests, fetchAttendedTests, categorizeTests } from './utils2.js';
// --- Dynamic Component Loading ---

const COMPONENTS = [
  { path: '/components/navbar.html', target: '#sidebar' }, // <-- FIX
  { path: '/components/profile.html', target: '#profile' }, // <-- FIX
  { path: '/components/unit_test.html', target: '#unit-tests' }, // <-- FIX
  { path: '/components/tsp.html', target: '#technical-skills' }, // <-- FIX
  { path: '/components/aptitude.html', target: '#aptitude' }, // <-- FIX
  { path: '/components/soft_skills.html', target: '#soft-skills' }, // <-- FIX
  { path: '/components/result.html', target: '#results' }, // <-- FIX
  { path: '/components/feedback.html', target: '#feedback' } // <-- FIX
];

    /**
     * Asynchronously loads HTML components and their associated scripts into the page.
     */
    async function loadComponents() {
      for (const comp of COMPONENTS) {
        try {
          const res = await fetch(comp.path);
          if (!res.ok) throw new Error(`Failed to load ${comp.path}: ${res.status}`);
          
          const text = await res.text();
          const targetEl = document.querySelector(comp.target);
          if (!targetEl) {
            console.warn(`Target element "${comp.target}" not found for component "${comp.path}".`);
            continue;
          }

          // Use a DocumentFragment for efficient DOM insertion
          const fragment = document.createDocumentFragment();
          const wrapper = document.createElement('div');
          wrapper.innerHTML = text;
          
          // Append nodes and execute scripts
          Array.from(wrapper.childNodes).forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE && node.tagName?.toLowerCase() !== 'script') {
              fragment.appendChild(node.cloneNode(true));
            }
          });
          targetEl.appendChild(fragment);

          // Find and execute scripts present in the loaded component
          wrapper.querySelectorAll('script').forEach(oldScript => {
            const newScript = document.createElement('script');
            if (oldScript.src) {
              newScript.src = oldScript.src;
            } else {
              newScript.textContent = oldScript.textContent;
            }
            document.body.appendChild(newScript).remove(); // Execute and immediately remove from DOM
          });

        } catch (err) {
          console.error(err);
          const errorEl = document.getElementById('error');
          errorEl.classList.remove('hidden');
          errorEl.textContent = `Error loading component ${comp.path}: ${err.message}`;
        }
      }
    }

    // --- App Initialization and Authentication ---

    /**
     * The main entry point for the application. Sets up static listeners and handles auth state.
     */
 async function startApp() {
    // 1. Get the services (temporary local variable is fine)
    const firebaseServices = initializeFirebase();

    // 2. ASSIGN the services to the GLOBAL variables
    auth = firebaseServices.auth; // Correctly assigns to the global 'auth'
    db = firebaseServices.db;     // Correctly assigns to the global 'db'
    window.auth = auth; // <--- ADD THIS LINE!
    setupGlobalModalHandlers();
    
    // Listen for authentication state changes
    auth.onAuthStateChanged(async (user) => {
        if (!user) {
            // FIX 1: Ensure root-relative path here too
            window.location.href = './index.html'; 
            return;
        }
        await loadDashboard(user, db);
    });
}
    /**
 * Fetches and renders all dashboard content.
 * @param {object} authUser The authenticated user object from Firebase Auth.
 * @param {object} db The initialized Firestore database instance. // <-- ADDED PARAMETER
 */
async function loadDashboard(authUser, db) { // <-- ADDED PARAMETER
    const loadingEl = document.getElementById('loading');
    const errorEl = document.getElementById('error');
    loadingEl.style.display = 'flex';
    errorEl.classList.add('hidden');
    
    try {
        const storedProfileJSON = sessionStorage.getItem('studentProfile');
        if (!storedProfileJSON) {
            throw new Error("Student profile not found in session. Please sign out and sign in again.");
        }
        
        const studentProfile = JSON.parse(storedProfileJSON);
        if (studentProfile.email !== authUser.email) {
            throw new Error("Session data mismatch. Please sign out and sign in again.");
        }
        console.log("Successfully loaded student profile from session:", studentProfile);

        // 4. FIXED: Pass the 'db' instance to your data-fetching functions.
        const [availableTests, attendedTests] = await Promise.all([
            fetchAvailableTests(studentProfile, db),
            fetchAttendedTests(studentProfile, db)
        ]);

        console.log("Attended Tests:", attendedTests);

        const attendedTestIds = new Set(attendedTests.map(t => t.testId));
        const unattendedTests = availableTests.filter(test => !attendedTestIds.has(test.id));
        
        storeTestData(unattendedTests);
        const categorizedTests = categorizeTests(unattendedTests);
        updateDashboardUI(studentProfile, categorizedTests, attendedTests);
        
    } catch (error) {
        console.error("Failed to load dashboard:", error);
        errorEl.textContent = `Error: ${error.message}`;
        errorEl.classList.remove('hidden');
    } finally {
        loadingEl.style.display = 'none';
    }
}


    /**
     * Renders all dynamic UI components on the dashboard with the provided data.
     * @param {object} student The authoritative student profile object.
     * @param {object} categories The categorized test data for unattended tests.
     * @param {Array<object>} attendedTests The data for tests that have been attended.
     */
    // In ui.js

function updateDashboardUI(student, categories, attendedTests) {
  // Update welcome text and profile information in the header
  document.getElementById('welcome-name').textContent = student.name || student.fullName;
  document.getElementById('header-fullname').textContent = student.name || student.fullName;
  document.getElementById('header-reg').textContent = student.rollNo || student.regNo || '';
  
  // Load HTML components and then populate them with data
  loadComponents().then(() => {
    updateProfilePhotos(student); 

    if (window.renderProfileData) window.renderProfileData(student);
    if (window.renderUnitTestsData) window.renderUnitTestsData(categories.unitTests);
    if (window.renderTechnicalSkillsData) window.renderTechnicalSkillsData(categories.technicalSkills);
    if (window.renderAptitudeData) window.renderAptitudeData(categories.aptitude);
    if (window.renderSoftSkillsData) window.renderSoftSkillsData(categories.softSkills);
    if (window.renderResultsData) window.renderResultsData({ tests: attendedTests });
    if (window.renderFeedbackData) window.renderFeedbackData({ feedback: [] });
  });

  // Calculate and display pending/completed test counts
  const pendingTestsCount = (categories.unitTests?.subjects || []).reduce((acc, s) => acc + (s.tests?.filter(t => t.availability === 'available').length||0),0)
                + (categories.technicalSkills?.tests || []).filter(t => t.availability === 'available').length
                + (categories.aptitude?.tests || []).filter(t => t.availability === 'available').length;
  document.getElementById('welcome-pending-tests').textContent = pendingTestsCount;
  document.getElementById('welcome-completed-tests').textContent = attendedTests.length || 0;

  // Build the sidebar navigation
  const navOrder = ['profile','unit-tests','technical-skills','aptitude','soft-skills','results','feedback'];
  
  // ✅ FIXED: Call the imported function directly, not on the window object.
  buildNav(navOrder);

  setTimeout(() => activateFirstVisibleSection(), 100);
}

    /**
     * This function is defined here to be available to updateDashboardUI.
     * It provides a better fallback avatar using the user's initial.
     * @param {object} user The student profile object.
     */
    function updateProfilePhotos(user) {
      try {
        const name = user?.name || user?.fullName;
        const fallbackLetter = name.trim().charAt(0).toUpperCase();
        const fallbackUrl = `https://placehold.co/80x80/1e3a8a/ffffff?text=${fallbackLetter}`;
        const photoURL = user?.photo || fallbackUrl;

        ['header-avatar','profile-photo','sidebar-avatar'].forEach(id => {
          const el = document.getElementById(id);
          if (el) {
            el.src = photoURL;
            el.onerror = function() {
              this.onerror = null; // Prevent infinite error loop
              this.src = fallbackUrl;
            };
          }
        });
      } catch (e) {
        console.warn('Error updating profile photos', e);
      }
    }

    // Start the application, with a top-level catch for any initialization errors.
    startApp().catch(err => {
      console.error('Critical application start error:', err);
      const errorEl = document.getElementById('error');
      errorEl.textContent = `A critical error occurred: ${err.message}. Please try refreshing the page.`;
      errorEl.classList.remove('hidden');
      document.getElementById('loading').style.display = 'none';
    });

document.addEventListener('DOMContentLoaded', (event) => {
    const signOutButton = document.getElementById('sign-out-btn');
    
    if (signOutButton) {
        signOutButton.addEventListener('click', () => {
            sessionStorage.clear();
            
            if (auth && auth.signOut) { 
                auth.signOut().then(() => {
                    // *** REMOVE window.location.href here! ***
                }).catch(e => console.error('Sign out error:', e));
            } else {
                console.error("Firebase auth object is not defined or initialized. Sign-out failed.");
                window.location.href = './index.html'; // Keep fallback only
            }
        });
    } else {
        console.warn("Sign out button with ID 'sign-out-btn' not found in the DOM.");
    }
});