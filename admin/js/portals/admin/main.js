// File: /js/portals/admin/main.js

import { initializeAuth } from './auth.js';
import { initManageAdmins } from './pages/manageAdmins.js';
import { initManageCoordinators } from './pages/manageCoordinators.js';
import { initManageFaculty } from './pages/manageFaculty.js';
import { initManageStudents } from './pages/manageStudents.js';
import { initViewScores } from './pages/viewScores.js';
import { initManageTests } from './pages/adminmanageTests.js';
import { initManageSubjects } from './pages/manageSubjects.js';
import { initManageTestsView } from './pages/manageTestsView.js';

document.addEventListener('DOMContentLoaded', () => {
    initializeAuth();

    const contentArea = document.getElementById('dynamic-content-area');
    const navLinks = document.querySelectorAll('.sidebar-nav .nav-link');
    const sidebar = document.getElementById('sidebar');
    const menuToggle = document.getElementById('menu-toggle');

    const pageModules = {
        'manage_users': { html: './pages/admin/manageAdmins.html', init: initManageAdmins },
        'manage_coordinators': { html: './pages/admin/manageCoordinators.html', init: initManageCoordinators },
        'manage_faculty': { html: './pages/admin/manageFaculty.html', init: initManageFaculty },
        'manage_students': { html: './pages/admin/manageStudents.html', init: initManageStudents },
        'view_score': { html: './pages/admin/viewScores.html', init: initViewScores },
        'manage_test': { html: './pages/admin/adminmanageTests.html', init: initManageTests },
        'view_upload_subjects': { html: './pages/admin/manageSubjects.html', init: initManageSubjects },
        'view_test': { html: './pages/admin/manageTestsView.html', init: initManageTestsView }
    };

    /**
     * Loads a page into the main content area and initializes its JavaScript.
     * @param {string} pageName - The key from the pageModules object.
     * @param {object} [data] - Optional data to pass to the page's init function.
     */
    async function loadPage(pageName, data) {
        const page = pageModules[pageName] || pageModules['manage_users'];

        try {
            // Update the active state on the sidebar navigation
            navLinks.forEach(l => l.classList.remove('active'));
            const newActiveLink = document.querySelector(`.nav-link[data-page="${pageName}"]`);
            if (newActiveLink) {
                newActiveLink.classList.add('active');
            }

            const response = await fetch(page.html);
            if (!response.ok) throw new Error(`Page not found: ${page.html}`);
            contentArea.innerHTML = await response.text();
            
            // Pass the data object to the init function if it exists.
            if (page.init) {
                page.init(data);
            }
        } catch (error) {
            console.error(`Failed to load page: ${pageName}`, error);
            contentArea.innerHTML = `<h2>Error</h2><p>Could not load the requested page.</p>`;
        }
    }

    // Expose the loadPage function globally so other modules can use it for navigation.
    window.loadPage = loadPage;

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const pageName = link.dataset.page;
            
            loadPage(pageName);

            if (window.innerWidth <= 768) {
                sidebar.classList.remove('show');
            }
        });
    });
    
    menuToggle.addEventListener('click', () => {
        sidebar.classList.toggle('show');
    });

    // Load the default page
    loadPage('manage_users');
});