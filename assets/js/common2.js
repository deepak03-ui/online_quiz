/**
 * common2.js
 * Handles dashboard UI interactions, including test selection modals, navigation, and section display.
 * This file is intended to be used on the main student dashboard page.
 */

// --- Module-Scoped State ---

/**
 * @type {Map<string, object>}
 * A global store to cache the full data of fetched tests, using the test's Firestore ID as the key.
 */
const testDataStore = new Map();

/**
 * @type {string | null}
 * A variable to safely track the ID of the test currently displayed in the modal.
 */
let currentModalTestId = null;

// --- Data Caching ---

/**
 * Caches the raw test data after it's fetched from Firestore.
 * This must be called from the main dashboard script after `fetchAvailableTests`.
 * @param {Array<Object>} rawTests The array of test objects from fetchAvailableTests.
 */
export function storeTestData(rawTests) {
  testDataStore.clear();
  if (!rawTests || !rawTests.length) return;
  rawTests.forEach(test => testDataStore.set(test.id, test));
  console.log('Test data has been cached:', testDataStore);
}

// --- Modal Controls ---

/**
 * Opens the global test confirmation modal and populates it with data for a specific test.
 * @param {string} testId The Firestore ID of the test to display.
 */
function openModal(testId) {
  const overlay = document.getElementById('testModal');
  if (!overlay) return;

  const testDetails = testDataStore.get(testId);
  if (!testDetails) {
    // This error is now much less likely to happen due to the corrected flow
    console.error(`Error: Details for test ID "${testId}" were not found in the cache.`);
    return;
  }
  
  // Safely store the current test ID to be used by the confirm button
  currentModalTestId = testId;
  
  const displayTitle = testDetails.name || testDetails.title || testId;
  document.getElementById('modalTitle').textContent = `Start Test: ${displayTitle}`;
  document.getElementById('modalDescription').textContent = 'Are you ready to begin the assessment?';
  overlay.classList.remove('hidden');
}

/**
 * Closes the global test confirmation modal and clears any temporary state.
 */
function closeModal() {
  const overlay = document.getElementById('testModal');
  if (!overlay) return;
  
  // Clear the stored test ID so it's not accidentally reused
  currentModalTestId = null;
  overlay.classList.add('hidden');
} 

// --- Global Event Handlers ---

/**
 * Sets up all necessary global event listeners for the dashboard.
 */
export function setupGlobalModalHandlers() {
  // Use event delegation to handle clicks on any test button
  document.body.addEventListener('click', (e) => {
    const testButton = e.target.closest('[data-test-id]');
    if (testButton && !testButton.disabled) {
      openModal(testButton.dataset.testId);
    }
  });

  const modalCancel = document.getElementById('modalCancel');
  const modalConfirm = document.getElementById('modalConfirm');
  const overlay = document.getElementById('testModal');

  if (modalCancel) modalCancel.addEventListener('click', closeModal);
  if (overlay) overlay.addEventListener('click', (ev) => { if (ev.target === overlay) closeModal(); });

  if (modalConfirm) modalConfirm.addEventListener('click', () => {
    // ✅ FIX: Use the reliably stored test ID
    const testId = currentModalTestId;
    if (!testId) {
      console.error("No test ID selected. Cannot proceed.");
      closeModal();
      return;
    }

    const testDetails = testDataStore.get(testId);
    const studentProfileJSON = sessionStorage.getItem('studentProfile');

    if (!testDetails || !studentProfileJSON) {
      console.error("Could not find Test Details or User Profile to start the test.");
      closeModal();
      return;
    }

    const userData = JSON.parse(studentProfileJSON);
    const testConfig = { ...testDetails, user: userData };

    sessionStorage.setItem('currentTestConfig', JSON.stringify(testConfig));
    console.log('Saved test config to sessionStorage:', testConfig);

    window.location.href = `./Test/test4.html`;
  });
}

// --- Navigation & Section Display ---

/**
 * Dynamically builds the sidebar navigation menu.
 * @param {string[]} order An array of section IDs in the desired display order.
 */
export function buildNav(order) {
  const navContainer = document.getElementById('nav-list') || document.createElement('div');
  navContainer.id = 'nav-list';
  navContainer.className = 'p-4 space-y-2';
  
  const sidebar = document.getElementById('sidebar');
  if (sidebar && !sidebar.querySelector('#nav-list')) {
    const existing = sidebar.querySelector('.sidebar-inner');
    if (existing) existing.appendChild(navContainer);
    else sidebar.appendChild(navContainer);
  } else if (!sidebar) {
    const header = document.getElementById('app-header');
    if (header && !header.querySelector('#nav-list')) header.appendChild(navContainer);
  }

  const map = {
    'profile': { label: 'Profile', icon: 'person' },
    'unit-tests': { label: 'Unit Tests', icon: 'quiz' },
    'internal': { label: 'Internal Test', icon: 'analytics' },
    'technical-skills': { label: 'Technical Skills', icon: 'code' },
    'aptitude': { label: 'Aptitude', icon: 'psychology' },
    'soft-skills': { label: 'Soft Skills', icon: 'groups' },
    'results': { label: 'Results', icon: 'analytics' },
    'feedback': { label: 'Feedback', icon: 'feedback' }
  };

  navContainer.innerHTML = '';
  order.forEach(id => {
    const item = document.createElement('button');
    item.className = 'nav-item w-full text-left';
    item.dataset.target = id;
    item.innerHTML = `<span class="material-symbols-outlined">${map[id]?.icon || 'circle'}</span><span>${map[id]?.label || id}</span>`;
    item.addEventListener('click', () => showSection(id));
    navContainer.appendChild(item);
  });
}

/**
 * Hides all sections and displays the one with the matching ID.
 * @param {string} sectionId The ID of the section to display.
 */
export function showSection(sectionId) {
  // Hide all sections
  document.querySelectorAll('.section').forEach(s => { s.style.display = 'none'; });
  
  // Show the target section
  const el = document.getElementById(sectionId);
  if (!el) return;
  el.style.display = 'block';

  // Update the active state in the navigation
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const activeBtn = document.querySelector(`.nav-item[data-target="${sectionId}"]`);
  if (activeBtn) activeBtn.classList.add('active');

  // REMOVED: The line that was causing the page to scroll has been deleted from here.
  // el.scrollIntoView({ behavior: 'smooth', block: 'start' }); 
}

/**
 * Activates the first section in the navigation menu.
 */
export function activateFirstVisibleSection() {
    const firstNavItem = document.querySelector('.nav-item');
    if (firstNavItem) {
        firstNavItem.click();
    }
}