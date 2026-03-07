// devtools-detector.js - Multi-method DevTools Detection

class DevToolsDetector {
    constructor(onDetected) {
        this.onDetected = onDetected;
        this.isDetected = false;
        this.checkInterval = null;
        this.methods = {
            debugger: false,
            threshold: false,
            toString: false,
            firebug: false
        };
    }

    // Method 1: Debugger statement (most reliable but intrusive)
    checkDebugger() {
        const start = performance.now();
        debugger; // This pauses if DevTools is open
        const end = performance.now();
        // If DevTools is open, this will take significantly longer
        return (end - start) > 100;
    }

    // Method 2: Console detection via toString
    checkConsoleToString() {
        let devtoolsOpen = false;
        const element = new Image();
        
        Object.defineProperty(element, 'id', {
            get: function() {
                devtoolsOpen = true;
                throw new Error('DevTools detected');
            }
        });

        try {
            console.log('%c', element);
        } catch (e) {
            // Expected error
        }

        return devtoolsOpen;
    }

    // Method 3: Window size threshold detection
    checkThreshold() {
        const threshold = 160;
        const widthThreshold = window.outerWidth - window.innerWidth > threshold;
        const heightThreshold = window.outerHeight - window.innerHeight > threshold;
        return widthThreshold || heightThreshold;
    }

    // Method 4: Firebug check
    checkFirebug() {
        return !!(window.Firebug && window.Firebug.chrome && window.Firebug.chrome.isInitialized);
    }

    // Method 5: Performance timing
    checkPerformanceTiming() {
        const start = performance.now();
        for (let i = 0; i < 100; i++) {
            console.log(i);
            console.clear();
        }
        const end = performance.now();
        return (end - start) > 200;
    }

    // Method 6: RegExp toString check
    checkRegExp() {
        let detected = false;
        const regexp = /./;
        regexp.toString = function() {
            detected = true;
        };
        console.log(regexp);
        return detected;
    }

    // Comprehensive check combining multiple methods
    detect() {
        this.methods.debugger = this.checkDebugger();
        this.methods.threshold = this.checkThreshold();
        
        // Avoid console methods if already detected to minimize interference
        if (!this.methods.debugger && !this.methods.threshold) {
            this.methods.toString = this.checkConsoleToString();
            this.methods.firebug = this.checkFirebug();
        }

        // DevTools is considered open if ANY method detects it
        const detected = Object.values(this.methods).some(result => result === true);

        if (detected && !this.isDetected) {
            this.isDetected = true;
            this.onDetected(this.methods);
            return true;
        }

        return detected;
    }

    // Start continuous monitoring
    startMonitoring(intervalMs = 1000) {
        // Initial check
        this.detect();

        // Periodic checks
        this.checkInterval = setInterval(() => {
            this.detect();
        }, intervalMs);
    }

    // Stop monitoring
    stopMonitoring() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
    }

    // Reset detection state
    reset() {
        this.isDetected = false;
        this.methods = {
            debugger: false,
            threshold: false,
            toString: false,
            firebug: false
        };
    }
}

// ============================================
// ALTERNATIVE: Passive Detection Only
// (Less intrusive, but less reliable)
// ============================================

class PassiveDevToolsDetector {
    constructor(onDetected) {
        this.onDetected = onDetected;
        this.isDetected = false;
        this.checkInterval = null;
    }

    // Only use threshold method (window size)
    checkThreshold() {
        const threshold = 160;
        const widthThreshold = window.outerWidth - window.innerWidth > threshold;
        const heightThreshold = window.outerHeight - window.innerHeight > threshold;
        
        // Additional check: ensure we're in fullscreen mode
        const isFullscreen = document.fullscreenElement !== null;
        
        // Only flag if NOT in fullscreen and size difference is significant
        return !isFullscreen && (widthThreshold || heightThreshold);
    }

    detect() {
        const detected = this.checkThreshold();

        if (detected && !this.isDetected) {
            this.isDetected = true;
            this.onDetected({ method: 'threshold' });
            return true;
        }

        return detected;
    }

    startMonitoring(intervalMs = 2000) {
        this.detect();
        this.checkInterval = setInterval(() => {
            this.detect();
        }, intervalMs);
    }

    stopMonitoring() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
    }
}

// ============================================
// HYBRID DETECTOR (Recommended)
// ============================================

class HybridDevToolsDetector {
    constructor(onDetected) {
        this.onDetected = onDetected;
        this.isDetected = false;
        this.checkInterval = null;
        this.suspicionLevel = 0;
        this.useAggressiveMode = false;
    }

    // Passive check (window size only)
    checkPassive() {
        const threshold = 160;
        const widthThreshold = window.outerWidth - window.innerWidth > threshold;
        const heightThreshold = window.outerHeight - window.innerHeight > threshold;
        const isFullscreen = document.fullscreenElement !== null;
        
        return !isFullscreen && (widthThreshold || heightThreshold);
    }

    // Aggressive checks (only when suspicious)
    checkAggressive() {
        // Debugger timing
        const start = performance.now();
        debugger;
        const end = performance.now();
        if ((end - start) > 100) return true;

        // Console toString
        let consoleDetected = false;
        const element = new Image();
        Object.defineProperty(element, 'id', {
            get: function() {
                consoleDetected = true;
                throw new Error('DevTools detected');
            }
        });
        try {
            console.log('%c', element);
        } catch (e) {
            // Expected
        }

        return consoleDetected;
    }

    detect() {
        // Always do passive check
        const passiveDetected = this.checkPassive();

        if (passiveDetected) {
            this.suspicionLevel++;
            
            // After 2 passive detections, switch to aggressive mode
            if (this.suspicionLevel >= 2) {
                this.useAggressiveMode = true;
            }
        } else {
            // Reset suspicion if window size normalizes
            this.suspicionLevel = Math.max(0, this.suspicionLevel - 1);
        }

        // Use aggressive checks if in aggressive mode or highly suspicious
        let detected = passiveDetected;
        if (this.useAggressiveMode || this.suspicionLevel >= 3) {
            detected = this.checkAggressive();
        }

        if (detected && !this.isDetected) {
            this.isDetected = true;
            this.onDetected({
                method: this.useAggressiveMode ? 'aggressive' : 'passive',
                suspicionLevel: this.suspicionLevel
            });
            return true;
        }

        return detected;
    }

    startMonitoring(intervalMs = 1500) {
        this.detect();
        this.checkInterval = setInterval(() => {
            this.detect();
        }, intervalMs);
    }

    stopMonitoring() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
    }

    reset() {
        this.isDetected = false;
        this.suspicionLevel = 0;
        this.useAggressiveMode = false;
    }
}

// ============================================
// Export
// ============================================

export { DevToolsDetector, PassiveDevToolsDetector, HybridDevToolsDetector };

