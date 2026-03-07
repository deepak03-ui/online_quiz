// main13.js - Agent fully removed, simplified pre-test flow
import * as testRunner from './ui/test-runner2.js';
import * as questionManager from './ui/question-manager.js';
import * as timerManager from './ui/timer-manager.js';
import * as uiManager from './ui/ui-manager.js';
import * as testData from './firestore-service.js';
import { ProctoringManager } from './proctor/proctoring-manager2.js';
import { UIElements } from './ui/ui-elements.js';
import { submitTestResults, submitInitialTestState } from './firestore-service.js';
import { FaceRecogManager } from './face-recog-manager.js';

// ===== PREVENT ALL PERMISSION POPUPS =====
if (navigator.clipboard) {
    Object.defineProperty(navigator, 'clipboard', {
        get: () => ({
            writeText: () => Promise.resolve(),
            readText: () => Promise.reject(new Error('Clipboard disabled during test')),
            write: () => Promise.resolve(),
            read: () => Promise.reject(new Error('Clipboard disabled during test'))
        }),
        configurable: true
    });
}

const originalPermissionsQuery = navigator.permissions?.query;
if (originalPermissionsQuery) {
    navigator.permissions.query = function(descriptor) {
        if (descriptor.name === 'camera') {
            return originalPermissionsQuery.call(navigator.permissions, descriptor);
        }
        return Promise.resolve({ state: 'denied' });
    };
}

// State Machine - agent states removed
const STATES = {
    INIT: 'init',
    PERMISSIONS_REQUEST: 'permissions_request',
    FACE_VERIFY: 'face_verify',
    PROCTORING_START: 'proctoring_start',
    TEST_ACTIVE: 'test_active',
    TEST_END: 'test_end',
    ERROR: 'error'
};

const STATE_CONFIG = {
    [STATES.INIT]: { title: 'Test Preparation', msg: 'Ensure quiet environment', btn: 'Begin Security Check' },
    [STATES.PERMISSIONS_REQUEST]: { title: 'Grant Permissions', msg: 'Click below to grant camera access and enter fullscreen mode.<br><small>Required for identity verification and proctoring</small>', btn: 'Grant Permissions & Continue' },
    [STATES.FACE_VERIFY]: { title: 'Verifying Identity', msg: 'Please look at your screen...', btn: 'Verifying...', loading: true },
    [STATES.PROCTORING_START]: { title: 'Starting Test', msg: 'Initializing proctoring systems...', btn: 'Starting...', loading: true },
    [STATES.ERROR]: { title: 'Error', msg: 'Something went wrong', btn: 'Refresh' }
};

// Application State Manager
class App {
    constructor() {
        this.state = STATES.INIT;
        this.isHighSecurity = true;
        this.faceRecogManager = new FaceRecogManager();
        this.proctoringManager = null;
        this.attempts = 0;
        this.detectedViolations = []; // kept for compatibility with proctoring callbacks
        this.testConfig = {};
        this.rawQuestions = [];
        this.warnings = 0;
        this.proctorAlertTimeout = null;
        this.fullscreenGranted = false;
        this.elements = {
            title: document.getElementById('pre-test-title'),
            message: document.getElementById('pre-test-message'),
            spinner: document.getElementById('loading-spinner'),
            blockedSection: document.getElementById('blocked-processes-section'),
            blockedList: document.getElementById('blocked-processes-list'),
            buttonContainer: document.getElementById('button-container'),
            proctorAlert: document.getElementById('proctor-alert'),
            proctorAlertMessage: document.getElementById('proctor-alert-message'),
            terminationScreen: document.getElementById('termination-screen'),
            terminationReason: document.getElementById('termination-reason'),
            terminationTitle: document.getElementById('termination-title')
        };
        this.actions = {
            [STATES.INIT]: () => this.requestPermissions(),
            [STATES.PERMISSIONS_REQUEST]: () => this.grantPermissionsAndStartVerification(),
            [STATES.ERROR]: () => location.reload()
        };

        this.preventPopups();
    }

    preventPopups() {
        document.addEventListener('contextmenu', e => e.preventDefault());
        document.addEventListener('keydown', e => {
            if ((e.ctrlKey || e.metaKey) && ['c', 'v', 'x', 'a', 's'].includes(e.key.toLowerCase())) e.preventDefault();
            if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && e.key === 'I')) e.preventDefault();
        });
        document.addEventListener('selectstart', e => { 
            if (this.state === STATES.TEST_ACTIVE) e.preventDefault(); 
        });
    }

    requestPermissions() { 
        this.setState(STATES.PERMISSIONS_REQUEST); 
    }

    async grantPermissionsAndStartVerification() {
        // ensure UI indicates proctoring start while we prepare
        this.setState(STATES.PROCTORING_START);

        try {
            await this.enterFullscreen();
            this.fullscreenGranted = true;

            const devToolsOpen = await this.performInitialDevToolsCheck();
            if (devToolsOpen) {
                this.terminate('Developer Tools must be closed before starting the test.');
                throw new Error('DevTools detected');
            }

            if (this.isHighSecurity) {
                this.setState(STATES.FACE_VERIFY);
                await this.startFaceVerification();
            } else {
                // low-security: skip verification, quick start
                this.setState(STATES.PROCTORING_START);
                await new Promise(resolve => setTimeout(resolve, 500));
                // release face manager early
                this.faceRecogManager = null;
                await this.startProctoring();
            }
        } catch (error) {
            if (error.message.includes('DevTools')) {
                return;
            } else {
                this.terminate(`Permission error: ${error.message}`);
            }
        }
    }

    /**
     * Robust DevTools detection (keeps behavior from original)
     */
    async performInitialDevToolsCheck() {
        await new Promise(resolve => setTimeout(resolve, 500));
        const widthThreshold = window.outerWidth - window.innerWidth > 160;
        const heightThreshold = window.outerHeight - window.innerHeight > 160;
        if (widthThreshold || heightThreshold) {
            return true;
        }

        let consoleOpen = false;
        const element = new Image();
        Object.defineProperty(element, 'id', {
            get: function() {
                consoleOpen = true;
                return 'detect';
            }
        });
        console.log(element);
        if (consoleOpen) return true;

        const start = performance.now();
        debugger;
        const end = performance.now();
        if ((end - start) > 100) return true;

        return false;
    }

    async enterFullscreen() {
        const element = document.documentElement;
        try {
            if (element.requestFullscreen) {
                await element.requestFullscreen();
            } else if (element.webkitRequestFullscreen) {
                await element.webkitRequestFullscreen();
            } else if (element.msRequestFullscreen) {
                await element.msRequestFullscreen();
            }

            document.addEventListener('fullscreenchange', () => {
                if (!document.fullscreenElement && this.state === STATES.TEST_ACTIVE) {
                    this.terminate('Exited fullscreen mode during test');
                }
            });
        } catch (error) {
            throw new Error("Fullscreen mode is required to start the test");
        }
    }

    async startFaceVerification() {
        try {
            if (!this.faceRecogManager.modelsLoaded) {
                await this.faceRecogManager.loadModels(message => { 
                    this.elements.message.innerHTML = message; 
                });
            }

            const isVerified = await this.faceRecogManager.verify({
                userEmail: this.userData.email,
                onUpdateMessage: message => { 
                    this.elements.message.innerHTML = message; 
                }
            });

            if (isVerified) {
                await new Promise(resolve => setTimeout(resolve, 500));
                this.faceRecogManager = null;
                await this.startProctoring();
            } else {
                this.terminate('Face verification failed. Identity could not be confirmed.');
            }
        } catch (error) {
            if (error.message.includes('Face not registered')) {
                this.elements.title.textContent = "Registration Required";
                this.elements.message.innerHTML = "Your face is not registered. You will be redirected to the registration page in 3 seconds...";
                this.elements.buttonContainer.innerHTML = '';
                setTimeout(() => { 
                    window.location.href = 'Face_recog/face3.html'; 
                }, 3000);
            } else {
                this.terminate(`Error during identity check: ${error.message}`);
            }
        }
    }

    setState(newState) {
        this.state = newState;
        this.updateUI();
    }

    _showProctorAlert(message) {
        if (!this.elements.proctorAlert || !this.elements.proctorAlertMessage) return;

        if (this.proctorAlertTimeout) {
            clearTimeout(this.proctorAlertTimeout);
        }

        this.elements.proctorAlertMessage.textContent = message;
        this.elements.proctorAlert.classList.add('show');

        this.proctorAlertTimeout = setTimeout(() => { 
            this.elements.proctorAlert.classList.remove('show'); 
        }, 3000);
    }

    updateUI() {
        this.elements.spinner?.classList.add('hidden');

        const config = STATE_CONFIG[this.state];
        if (!config) return;

        // Slight message override for non-high-security
        if (this.state === STATES.INIT && !this.isHighSecurity) {
            config.msg = "Ensure you are in a quiet environment. The test will be in fullscreen mode.";
            config.btn = "Begin Test";
        }

        this.elements.title.textContent = config.title;
        this.elements.message.innerHTML = config.msg;

        const button = `<button id="action-btn" class="btn btn-primary btn-large" ${config.loading ? 'disabled' : ''}>${config.btn}</button>`;
        this.elements.buttonContainer.innerHTML = button;

        const action = this.actions[this.state] || (() => {});
        const btnEl = document.getElementById('action-btn');
        if (btnEl) btnEl.onclick = action;

        if (config.loading) {
            this.elements.spinner?.classList.remove('hidden');
        }
    }

    async startProctoring() {
        this.setState(STATES.PROCTORING_START);
        try {
            if (!this.fullscreenGranted) {
                throw new Error('Fullscreen was not granted');
            }

            // Fetch test and questions
            const { details: fetchedTestDetails, questions: fetchedQuestions } =
                await testData.fetchTestAndQuestions(this.testId, this.testConfigFromURL);
            this.rawQuestions = fetchedQuestions;
            this.testConfig = fetchedTestDetails;
            this.testConfig.maxWarnings = this.testConfig.maxWarnings ?? 5;

            // Create ProctoringManager instance
            this.proctoringManager = new ProctoringManager({
                onWarning: (data) => this.handleWarning(data),
                onTermination: (reason) => this.terminate(reason)
            }, this.isHighSecurity);

            // Start proctoring video/capture (manager handles internal logic)
            await this.proctoringManager.start(UIElements.proctoringVideo);

            // No agent: background security scan replaced by no-op result
            const backgroundScanPromise = Promise.resolve({ matches: [] });

            // UI: hide pre-test overlay and set initial warnings display
            document.getElementById('pre-test-overlay').style.display = 'none';
            const warningDisplay = UIElements.warningCountDisplay || document.getElementById('warning-count-display');
            if (warningDisplay) {
                warningDisplay.textContent = `Warnings: 0 / ${this.testConfig.maxWarnings}`;
            }
            this.setState(STATES.TEST_ACTIVE);

            // Prepare and start test in parallel with the no-op security "scan"
            const setupAndRunTest = async () => {
                const initialData = { 
                    testDetails: this.testConfig, 
                    userData: this.testConfig.user 
                };
                submitInitialTestState(initialData);

                const questions = await questionManager.prepareQuestions(
                    this.rawQuestions, 
                    this.testConfig.questionsToSelect || this.testConfig.questionsToAttend
                );

                if (questions.length === 0) {
                    throw new Error('No questions were prepared');
                }

                const context = { 
                    details: this.testConfig, 
                    user: this.testConfig.user, 
                    questions: questions 
                };
                const services = { timerManager, uiManager };

                return await testRunner.startTest(context, services);
            };

            const [scanResult, testResult] = await Promise.all([
                backgroundScanPromise,
                setupAndRunTest()
            ]);

            // Post-test security check: no agent, so no matches expected
            const violations = scanResult.matches || [];
            if (violations.length > 0) {
                const criticalViolation = violations.find(v => v.type === 'block');
                if (criticalViolation) {
                    this.terminate(
                        `Test invalidated. Prohibited application detected during the test: ${criticalViolation.name || criticalViolation.description}`
                    );
                    return;
                }
            }

            // Stop services and submit results
            this.proctoringManager?.stop();

            const submissionData = { 
                testDetails: this.testConfig, 
                userData: this.testConfig.user, 
                score: testResult.score 
            };
            await submitTestResults(submissionData);

            this.terminate('Test Submitted Successfully', { 
                isSuccess: true, 
                redirectUrl: '../student-new2.html' 
            });

        } catch (error) {
            this.terminate(`An error occurred: ${error.message}`);
        }
    }

    handleWarning(data) {
        if (this.state === STATES.TEST_END || this.state !== STATES.TEST_ACTIVE) return;

        if (data.isCritical) {
            return this.terminate(data.message || 'Critical proctoring violation detected');
        }

        if (data.message) {
            this._showProctorAlert(data.message);
        }

        if (data.incrementsCounter) {
            this.warnings++;
        }

        const warningDisplay = UIElements.warningCountDisplay || document.getElementById('warning-count-display');
        if (warningDisplay) {
            warningDisplay.textContent = `Warnings: ${this.warnings} / ${this.testConfig.maxWarnings}`;
        }

        if (this.warnings >= this.testConfig.maxWarnings) {
            this.terminate('Maximum warnings exceeded');
        }
    }

    terminate(reason, options = {}) {
        const { isSuccess = false, redirectUrl = '../student-new2.html' } = options;

        if (this.state === STATES.TEST_END) return;

        try {
            const keysToKeep = ['studentProfile'];
            const keysToRemove = [];

            for (let i = 0; i < sessionStorage.length; i++) {
                const key = sessionStorage.key(i);
                if (key && !keysToKeep.includes(key)) {
                    keysToRemove.push(key);
                }
            }

            for (const key of keysToRemove) {
                sessionStorage.removeItem(key);
            }
        } catch (e) {
            console.error('Error clearing session storage:', e);
        }

        // Stop proctoring manager (if running)
        this.proctoringManager?.stop();

        // Update state
        this.setState(STATES.TEST_END);
        window.onbeforeunload = null;

        // Exit fullscreen
        if (document.fullscreenElement) {
            document.exitFullscreen().catch(err => console.error('Fullscreen exit error:', err));
        }

        // Hide app container
        const appContainer = document.getElementById('app-container');
        if (appContainer) {
            appContainer.setAttribute('style', 'display: none !important');
        }

        // Show termination screen
        if (!this.elements.terminationScreen) {
            alert(reason);
            if (redirectUrl) {
                setTimeout(() => window.location.replace(redirectUrl), 4000);
            }
            return;
        }

        this.elements.terminationScreen.style.display = 'flex';
        this.elements.terminationTitle.textContent = isSuccess 
            ? 'Test Submitted Successfully' 
            : 'Test Terminated';
        this.elements.terminationReason.textContent = isSuccess 
            ? 'Your results have been recorded. You will be redirected shortly.' 
            : reason;

        if (isSuccess) {
            this.elements.terminationTitle.classList.add('success');
        }

        if (redirectUrl) {
            setTimeout(() => { 
                window.location.replace(redirectUrl); 
            }, 3000);
        }
    }
}

// Initialize Application
function initializeApp() {
    let app;
    try {
        app = new App();
        const { testId, config } = testData.getTestConfigFromSession();
        app.testId = testId;
        app.userData = config.user;
        app.testConfigFromURL = config;

        // Hotfix: refresh user data from session if present
        try {
            const freshProfileData = sessionStorage.getItem('studentProfile');
            if (freshProfileData) {
                const freshUser = JSON.parse(freshProfileData);
                app.userData = freshUser;
                config.user = freshUser;
                console.log("Hotfix Applied: User data refreshed from studentProfile.");
            }
        } catch (e) {
            console.error("Error refreshing user data from session:", e);
        }

        // Read proctoring flag from config
        if (config.isProctored == false) {
            app.isHighSecurity = false;
        }

        // If high-security, ensure face data exists otherwise redirect
        if (app.isHighSecurity && !app.userData.faceModel?.descriptors) {
            console.warn("Face data not found in session. Redirecting to registration.");
            app.elements.title.textContent = "Registration Required";
            app.elements.message.innerHTML = "Your face is not registered. You will be redirected to the registration page in 3 seconds...";
            app.elements.buttonContainer.innerHTML = '';
            app.elements.spinner.classList.add('hidden');
            setTimeout(() => { 
                window.location.href = 'Face_recog/face3.html'; 
            }, 3000);
            return;
        }

        // For low-security mode, override INIT action to skip verification if desired
        if (!app.isHighSecurity) {
            app.actions[STATES.INIT] = () => app.requestPermissions();
        }

        app.updateUI();
    } catch (error) {
        if (app && typeof app.terminate === 'function') {
            app.terminate(`Initialization Error: ${error.message}`, { redirectUrl: null });
        } else {
            document.body.innerHTML = '';
            const container = document.createElement('div');
            container.className = 'error-fullpage';
            const h1 = document.createElement('h1');
            h1.textContent = 'Initialization Error';
            const p = document.createElement('p');
            p.textContent = error.message;
            container.appendChild(h1);
            container.appendChild(p);
            document.body.appendChild(container);
        }
    }
}

initializeApp();
