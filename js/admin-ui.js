// js/admin-ui.js

// --- GLOBAL VARIABLES ---
let currentUser = {}; 

// --- ROBUST HELPER FUNCTION: Dynamic Component Loading (FIXED) ---
async function loadComponent(path, targetSelector) {
    const targetElement = document.querySelector(targetSelector);
    if (!targetElement) {
        console.error(`Target selector ${targetSelector} not found in the DOM.`);
        return;
    }
    
    targetElement.innerHTML = `<div class="p-4 text-center text-gray-400">Loading ${path.split('/').pop()}...</div>`;

    try {
        const response = await fetch(path);
        
        if (!response.ok) {
            throw new Error(`Failed to load component: ${path} (Status: ${response.status})`);
        }
        
        const html = await response.text();
        targetElement.innerHTML = html;
        
        // CRITICAL FIX: Trigger the script loading ONLY after the HTML is in the DOM
        const moduleFileName = path.split('/').pop();
        if (moduleFileName.includes('.html')) {
            loadModuleScript(moduleFileName);
        }

    } catch (e) {
        console.error(`CRITICAL UI ERROR: Component fetch failed for ${path}`, e);
        targetElement.innerHTML = `
            <div class="p-6 border-l-4 border-red-500 bg-red-100 rounded-lg shadow-md">
                <p class="font-bold text-red-700">Initialization Error</p>
                <p class="text-sm text-red-600">Failed to load component: Check file paths and server logs.</p>
                <code class="block mt-2 p-2 bg-red-200 rounded text-red-900 break-all">${path}</code>
            </div>`;
    }
}

// --- CORE FUNCTIONALITY (Navigation/Authentication) ---
function filterAndSetupNavigation(role) {
    const sidebarNav = document.getElementById('admin-sidebar-nav');
    if (!sidebarNav) return;

    const navLinks = sidebarNav.querySelectorAll('[data-access-roles]');
    let firstAuthorizedLink = null;
    
    navLinks.forEach(link => {
        const requiredRoles = link.getAttribute('data-access-roles').split(',');
        if (!requiredRoles.includes(role)) {
            link.style.display = 'none'; 
        } else {
            link.style.display = 'flex';
            if (!firstAuthorizedLink) {
                firstAuthorizedLink = link;
            }
        }
    });

    navLinks.forEach(link => {
        if (link.style.display !== 'none') {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const path = link.getAttribute('data-page-path');
                const title = link.textContent.trim();
                
                sidebarNav.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
                link.classList.add('active');
                
                document.getElementById('page-title').textContent = title;
                loadComponent(path, '#dynamic-content-area'); 
            });
        }
    });
    
    if (firstAuthorizedLink) {
        firstAuthorizedLink.click();
    } else {
         document.getElementById('dynamic-content-area').innerHTML = `<div class="text-center py-20 text-gray-500">Access Denied / No Modules</div>`;
    }
}


async function initializeAdminDashboard() {
    const userDataString = sessionStorage.getItem('currentUser');
    if (!userDataString) {
        setTimeout(() => window.location.href = 'new_index.html', 50); 
        return;
    }
    
    currentUser = JSON.parse(userDataString);
    const role = currentUser.role || 'Student';

    if (role === 'Student') {
        setTimeout(() => window.location.href = 'student-new2.html', 50);
        return;
    }
    
    document.getElementById('user-display-name').textContent = currentUser.name || currentUser.email.split('@')[0];
    document.getElementById('user-role-display').textContent = role.toUpperCase();

    // Load the sidebar navigation component (MUST be in /components/admin-nav.html)
    await loadComponent('./components/admin-nav.html', '#admin-sidebar-nav');

    filterAndSetupNavigation(role);

    document.getElementById('sign-out-btn').addEventListener('click', () => {
        sessionStorage.removeItem('currentUser');
        window.location.href = 'new_index.html';
    });
}


// ** loadModuleScript FUNCTION (Fixed Paths) **
async function loadModuleScript(path) { 
    try {
        
        if (path.includes('dashboard-overview.html')) {
            // Correct relative path from /js/admin-ui.js to /js/portals/admin/pages/admin-dashboard.js
            const module = await import('./js/admin-dashboard.js'); 
            if (module && module.initAdminDashboard) {
                module.initAdminDashboard(currentUser); 
            }
        }
        
        if (path.includes('adminmanageTests.html')) {
            // Assuming adminmanageTests.js is also in the /js/ folder
            const module = await import('./adminmanageTests.js'); 
            if (module && module.initManageTests) {
                module.initManageTests(currentUser); 
            }
        }
        
    } catch (error) {
        console.error("Failed to dynamically load or run module script:", path, error);
    }
}


// Start the admin application
initializeAdminDashboard().catch(console.error);