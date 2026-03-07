/**
 * ==================================================================================
 * | MAIN ROUTER & CONTROLLER FOR THE ADMIN PORTAL SPA                             |
 * |--------------------------------------------------------------------------------|
 * | This file manages the Single Page Application (SPA) functionality.             |
 * | - It loads different page views (HTML & JS) into the main content area.        |
 * | - It handles passing data between views using sessionStorage.                  |
 * ==================================================================================
 */

// This function is the core of your SPA. It switches between different views.
async function switchToView(viewName, data = null) {
    const dynamicContentArea = document.getElementById('dynamic-content-area');
    if (!dynamicContentArea) {
        console.error("Fatal Error: The dynamic content area with ID 'dynamic-content-area' was not found in the DOM.");
        return;
    }

    // --- Data Passing Logic ---
    if (data) {
        sessionStorage.setItem('viewScoresFilter', JSON.stringify(data));
    }

    try {
        // Step 1: Fetch and display the HTML content for the requested view.
        // We will fetch pages like 'manage_faculty.html'
        const response = await fetch(`pages/${viewName}.html`); 
        if (!response.ok) throw new Error(`HTML for view '${viewName}' not found.`);
        dynamicContentArea.innerHTML = await response.text();

        // Step 2: Dynamically import the corresponding JavaScript module and run its initializer.
        // This keeps your code modular and only loads the JS needed for the current view.
        switch (viewName) {
            case 'dashboard':
                // const { initDashboard } = await import('./pages/dashboard.js');
                // initDashboard();
                break;
            
            // --- This must match your HTML data-page="manage_test" ---
            case 'manage_test': 
                const { initManageTests } = await import('./pages/adminmanageTests.js');
                // We assume 'auth' is available globally from another script
                initManageTests(window.auth?.currentUser); 
                break;

            // --- This must match your HTML data-page="view_test" ---
            case 'view_test': 
                const { initManageTestsView } = await import('./pages/manageTestsView.js');
                initManageTestsView();
                break;
            
            // --- This must match your HTML data-page="view_score" ---
            case 'view_score':
                const { initViewScores } = await import('./pages/viewScores.js');
                initViewScores();
                break;

            // --- THIS IS THE FIX ---
            // This is the case for your "Faculty Details" page
            case 'manage_faculty':
                const { initManageFaculty } = await import('./pages/manageFaculty.js');
                initManageFaculty();
                break;
            
            // --- This must match your HTML data-page="view_upload_subjects" ---
            case 'view_upload_subjects':
                const { initManageSubjects } = await import('./pages/manageSubjects.js');
                initManageSubjects();
                break;

            // ... (Add cases for 'manage_users', 'manage_coordinators', 'manage_students' here) ...

            default:
                console.warn(`No JavaScript module found for view: ${viewName}`);
        }
    } catch (error) {
        console.error(`Failed to load view '${viewName}':`, error);
        dynamicContentArea.innerHTML = `<p class="text-center text-red-500 p-4">Error: Could not load the page. Please check the console for details.</p>`;
    }
}

// --- Global Access & Initial Setup ---
window.switchToView = switchToView;

document.addEventListener('DOMContentLoaded', () => {
    // Add click listeners to your sidebar navigation links
    const navLinks = document.querySelectorAll('.sidebar-nav .nav-link'); // More specific selector
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Remove 'active' from all links
            navLinks.forEach(l => l.classList.remove('active'));
            // Add 'active' to the clicked link
            link.classList.add('active');

            // --- Uses data-page attribute ---
            const viewName = link.getAttribute('data-page'); 
            if (viewName) {
                sessionStorage.removeItem('viewScoresFilter'); 
                switchToView(viewName);
            }
        });
    });

    // Load the default view.
    const defaultView = 'manage_faculty'; // Or whatever you want
    // Find the default link and make it active
    const defaultLink = document.querySelector(`.nav-link[data-page="${defaultView}"]`);
    if(defaultLink) {
        defaultLink.classList.add('active');
    } else {
        // Fallback if 'manage_faculty' isn't the first link
        document.querySelector('.sidebar-nav .nav-link')?.classList.add('active');
    }
    switchToView(defaultView); 
});