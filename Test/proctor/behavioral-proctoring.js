export class BehavioralProctor {
    constructor(callbacks) {
        this.callbacks = callbacks; // { onWarning, onTermination }
        this.devToolsOpen = false;
        this.eventHandlers = {}; // Store bound handlers for easy removal

        // --- FIX START: Add properties for cooldown ---
        this.lastWarningTimestamp = 0;
        this.WARNING_COOLDOWN_MS = 2500; // 2.5 seconds
        // --- FIX END ---
    }

    /**
     * CORRECT: Starts the initial, non-focus-sensitive proctoring features.
     */
    start() {
        return new Promise((resolve, reject) => {
            this.clearClipboard();
            this.enforceFullscreen()
                .then(() => {
                    this.addInitialListeners(); // Only adds listeners that don't depend on focus
                    this.devToolsCheckInterval = setInterval(this.handleDevTools.bind(this), 1000);
                    resolve();
                })
                .catch(err => reject(err));
        });
    }

    stop() {
        this.removeListeners();
        clearInterval(this.devToolsCheckInterval);
    }

    /**
     * NEW: Adds initial listeners that are safe to activate before camera permissions.
     */
    addInitialListeners() {
        this.eventHandlers.fullscreenchange = this.handleFullscreenChange.bind(this);
        this.eventHandlers.contextmenu = this.handleContextMenu.bind(this);
        this.eventHandlers.keydown = this.handleKeyDown.bind(this);
        this.eventHandlers.selectstart = (e) => e.preventDefault();

        document.addEventListener('fullscreenchange', this.eventHandlers.fullscreenchange);
        document.addEventListener('contextmenu', this.eventHandlers.contextmenu);
        document.addEventListener('keydown', this.eventHandlers.keydown);
        document.addEventListener('selectstart', this.eventHandlers.selectstart);
    }

    /**
     * NEW & CRUCIAL: Public method to activate strict focus and visibility change listeners
     * after all permissions have been granted. This is the key to preventing the race condition.
     */
    activateFocusListeners() {
        this.eventHandlers.visibilitychange = this.handleVisibilityChange.bind(this);
        this.eventHandlers.blur = this.handleBlur.bind(this);

        document.addEventListener('visibilitychange', this.eventHandlers.visibilitychange);
        window.addEventListener('blur', this.eventHandlers.blur);
    }
    
    /**
     * MODIFIED: Now removes all potential listeners, regardless of activation stage.
     */
    removeListeners() {
        document.removeEventListener('visibilitychange', this.eventHandlers.visibilitychange);
        window.removeEventListener('blur', this.eventHandlers.blur);
        document.removeEventListener('fullscreenchange', this.eventHandlers.fullscreenchange);
        document.removeEventListener('contextmenu', this.eventHandlers.contextmenu);
        document.removeEventListener('keydown', this.eventHandlers.keydown);
        document.removeEventListener('selectstart', this.eventHandlers.selectstart);
    }
    
    /**
     * REVISED: Now includes a cooldown and the isCritical flag.
     */
    issueWarning(message) {
        // --- FIX START: Implement the cooldown check ---
        const now = Date.now();
        if (now - this.lastWarningTimestamp < this.WARNING_COOLDOWN_MS) {
            // If we are in the cooldown period, do nothing.
            return;
        }
        this.lastWarningTimestamp = now;
        // --- FIX END ---
        
        this.callbacks.onWarning({
            message: message,
            incrementsCounter: true,
            source: 'behavioral',
            isCritical: false // Explicitly mark as a non-critical warning
        });
    }

    enforceFullscreen() {
        return new Promise((resolve, reject) => {
            if (!document.documentElement.requestFullscreen) {
                return reject(new Error("Fullscreen API is not supported."));
            }
            if (document.fullscreenElement) {
                return resolve();
            }
            document.documentElement.requestFullscreen().catch(() => {
                reject(new Error("Fullscreen permission was denied."));
            });
            // Resolve immediately for a smoother flow
            resolve();
        });
    }

    clearClipboard() {
        navigator.clipboard?.writeText('').catch(() => console.warn("Could not clear clipboard."));
    }

    /**
     * MODIFIED: Now sends a critical warning instead of terminating directly.
     */
    handleVisibilityChange() {
        if (document.hidden) {
            this.callbacks.onWarning({
                message: "Test terminated: Switched tabs or minimized the window.",
                incrementsCounter: false,
                isCritical: true, // This new flag signals immediate termination
                source: 'behavioral'
            });
        }
    }

    /**
     * MODIFIED: Now sends a critical warning instead of terminating directly.
     */
    handleBlur() {
        // A short delay helps prevent termination from brief, legitimate focus losses.
        setTimeout(() => {
            if (!document.hasFocus()) {
                this.callbacks.onWarning({
                    message: "Test terminated: The test window lost focus.",
                    incrementsCounter: false,
                    isCritical: true, // This new flag signals immediate termination
                    source: 'behavioral'
                });
            }
        }, 300);
    }

    /**
     * MODIFIED: Now sends a critical warning instead of terminating directly.
     */
    handleFullscreenChange() {
        if (!document.fullscreenElement) {
            this.callbacks.onWarning({
                message: "Test terminated: Full-screen mode was exited.",
                incrementsCounter: false,
                isCritical: true, // This new flag signals immediate termination
                source: 'behavioral'
            });
        }
    }

    handleContextMenu(event) {
        event.preventDefault();
        this.issueWarning("Right-click is disabled.");
    }
    
    /**
     * Blocks a wide range of key combinations to secure the environment.
     */
    handleKeyDown(event) {
        if (event.key === "Escape") {
            event.preventDefault();
            this.issueWarning("The ESC key is disabled.");
        }
        if (
            event.key === "F12" ||
            (event.ctrlKey && event.shiftKey && ["I", "J", "C"].includes(event.key.toUpperCase())) ||
            (event.ctrlKey && ["P", "S", "R", "T", "N", "H", "J", "U", "W"].includes(event.key.toUpperCase()))
        ) {
            event.preventDefault();
            this.issueWarning(`This browser action is disabled during the test.`);
        }
        if (event.ctrlKey && event.key === "Tab") {
            event.preventDefault();
            this.issueWarning("Switching tabs is not permitted.");
        }
        if (event.key === "F5") {
             event.preventDefault();
             this.issueWarning("Reloading the page is not permitted.");
        }
        if (event.altKey && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
            event.preventDefault();
            this.issueWarning("Browser navigation is disabled.");
        }
    }

    handleDevTools() {
        const threshold = 160;
        if (window.outerWidth - window.innerWidth > threshold || window.outerHeight - window.innerHeight > threshold) {
            if (!this.devToolsOpen) {
                this.issueWarning("Developer tools detected.");
                this.devToolsOpen = true;
            }
        } else {
            this.devToolsOpen = false;
        }
    }
}