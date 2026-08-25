// This file is the main entry point and router for the faculty portal.

import { setupSignOut, getCurrentFaculty } from './auth.js';
import { initMyProfile } from './pages/facultymyProfile.js';
import { initManageStudents } from './pages/facultyStudents.js';
import { initViewScores } from './pages/facultyviewScores.js';

document.addEventListener('DOMContentLoaded', async () => {
    setupSignOut();

    const faculty = await getCurrentFaculty();
    if (!faculty) {
        console.error("Could not retrieve faculty data. Halting execution.");
        return; 
    }

    const contentArea = document.getElementById('dynamic-content-area');
    const navLinks = document.querySelectorAll('.sidebar-nav .nav-link');
    const sidebar = document.getElementById('sidebar');
    const menuToggle = document.getElementById('menu-toggle');

    const pageModules = {
        'my_profile': { html: './pages/faculty/myProfile.html', init: initMyProfile },
        'manage_students': { html: './pages/faculty/facultymanageStudents.html', init: initManageStudents },
        'view_score': { html: './pages/faculty/viewScores.html', init: initViewScores }
    };

    async function loadPage(pageName) {
        const page = pageModules[pageName] || pageModules['my_profile'];

        try {
            const response = await fetch(page.html);
            if (!response.ok) throw new Error(`HTML partial not found: ${page.html}`);
            contentArea.innerHTML = await response.text();
            
            if (page.init) {
                page.init(faculty); // Pass faculty data to each page's script
            }
        } catch (error) {
            console.error(`Failed to load page: ${pageName}`, error);
            contentArea.innerHTML = `<h2>Error</h2><p>Could not load page content.</p>`;
        }
    }

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            loadPage(link.dataset.page);

            if (window.innerWidth <= 768 && sidebar) {
                sidebar.classList.remove('show');
            }
        });
    });

    if (menuToggle && sidebar) {
        menuToggle.addEventListener('click', () => {
            sidebar.classList.toggle('show');
        });
    }

    loadPage('my_profile'); // Load the default page
});