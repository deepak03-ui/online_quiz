// Filename: security-manager.js

let state = { isOver: false, violationDetected: false };
let onViolationCallback = null;

/**
 * The core violation handler. It ensures the violation is only triggered once.
 */
function triggerViolation() {
    // Check flags to prevent this from running multiple times
    if (state.isOver || state.violationDetected) return;
    state.violationDetected = true; 
    console.error(" SECURITY VIOLATION DETECTED ");
    if (onViolationCallback) onViolationCallback();
}

// --- Event Handlers for Violation Detection ---

/**
 * Handles leaving fullscreen mode (e.g., via ESC or F11). This is a very reliable check.
 */
function handleFullscreenChange() {
    if (!document.fullscreenElement && !state.isOver) {
        console.warn("Violation: Exited fullscreen mode.");
        triggerViolation();
    }
}

/**
 * Detects tab switching or window minimization using the Page Visibility API.
 */
function handleVisibilityChange() {
    if (document.hidden && !state.isOver) {
        console.warn("Violation: Page is no longer visible (tab switched or window minimized).");
        triggerViolation();
    }
}

/**
 * A fallback to detect when the window loses focus (e.g., Alt+Tab).
 */
function handleBlur() {
    if (!state.isOver) {
        console.warn("Violation: Window lost focus.");
        triggerViolation();
    }
}

/**
 * Blocks a wide range of keys and combinations to prevent access to dev tools or navigation.
 * @param {KeyboardEvent} e The keyboard event.
 */
function handleKeyDown(e) {
    if (state.isOver) return;

    // Block all F-keys (F1-F12)
    if (e.key.startsWith('F') && e.keyCode >= 112 && e.keyCode <= 123) {
        e.preventDefault();
        return;
    }

    // Block common developer tool combinations
    if ((e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) || (e.ctrlKey && e.key === 'u')) {
        e.preventDefault();
        return;
    }

    // Block Tab, Alt, and Ctrl+Tab to prevent navigation
    if (e.altKey || e.key === 'Tab' || (e.ctrlKey && e.key === 'Tab')) {
        e.preventDefault();
        return;
    }
}

// --- Public API ---

export function setup(dependencies) {
    state = { isOver: false, violationDetected: false };
    onViolationCallback = dependencies.onViolation;

    console.log("SECURITY: High-enforcement measures are now active. 🔒");

    // Add all event listeners. Using 'true' for keydown to capture the event early.
    document.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
}

export function updateTestState({ isOver }) {
    if (typeof isOver === 'boolean') {
        state.isOver = isOver;
    }
}

export function cleanup() {
    console.log("SECURITY: Deactivating enforcement measures.");
    updateTestState({ isOver: true }); // Mark test as over to prevent lingering listeners from firing

    // It's good practice to remove all listeners to prevent memory leaks
    document.removeEventListener('contextmenu', e => e.preventDefault());
    document.removeEventListener('keydown', handleKeyDown, true);
    window.removeEventListener('blur', handleBlur);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    document.removeEventListener('fullscreenchange', handleFullscreenChange);
    
    // Attempt to exit fullscreen when the test is legitimately over
    if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
    }
}