import { setupSignOut, getCurrentCoordinator } from './auth.js';
import { initManageFaculty } from './pages/coordinmanageFaculty.js';
import { initManageStudents } from './pages/coordinmanageStudents.js';
import { initManageTests } from './pages/coordinmanageTests.js';
import { initViewScores } from './pages/coordinviewScores.js';

document.addEventListener('DOMContentLoaded', async () => {
    // Setup the sign-out button
    setupSignOut();

    // Authenticate the user and get their details (department, year)
    const coordinator = await getCurrentCoordinator();
    if (!coordinator) {
        console.log("Could not retrieve coordinator data. Halting execution.");
        return; // Stop if no valid coordinator is found
    }

    const contentArea = document.getElementById('dynamic-content-area');
    const navLinks = document.querySelectorAll('.sidebar-nav .nav-link');

    // Map page names to their HTML and JS modules
    const pageModules = {
        'manage_faculty': { html: './pages/coordinator/coordinmanageFaculty.html', init: initManageFaculty },
        'manage_students': { html: './pages/coordinator/coordinmanageStudents.html', init: initManageStudents },
        'manage_test': { html: './pages/coordinator/coordinmanageTests.html', init: initManageTests },
        'view_score': { html: './pages/coordinator/coordinviewScores.html', init: initViewScores }
    };

    /**
     * Loads a page by fetching its HTML and running its initialization script.
     * @param {string} pageName - The name of the page to load from the nav link's data-page attribute.
     */
    async function loadPage(pageName) {
        const page = pageModules[pageName] || pageModules['manage_faculty']; // Default to faculty page

        try {
            const response = await fetch(page.html);
            if (!response.ok) throw new Error(`Page not found: ${page.html}`);
            contentArea.innerHTML = await response.text();
            
            // Pass the coordinator's scope to the initialization function
            if (page.init) {
                page.init(coordinator);
            }
        } catch (error) {
            console.error(`Failed to load page: ${pageName}`, error);
            contentArea.innerHTML = `<h2>Error</h2><p>Could not load page content.</p>`;
        }
    }

    // Add click listeners to all navigation links
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            loadPage(link.dataset.page);
        });
    });

    // Load the initial page
    loadPage('manage_faculty');
});