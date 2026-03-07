// app.js - Updated to use manual capture mode with existing FaceRecogManager

import * as ui from './ui.js';
import * as firebaseService from '../firestore-service.js';
import { FaceRecogManager } from '../face-recog-manager.js';

class App {
    constructor() {
        this.faceManager = new FaceRecogManager();
        this.sessionUser = null;
        this.testConfig = null;
        
        this.startRegistrationProcess = this.startRegistrationProcess.bind(this);
        this.capturePhoto = this.capturePhoto.bind(this);
        this.resetRegistration = this.resetRegistration.bind(this);
    }

    async initialize() {
        try {
            ui.showLoading("Initializing...");

            // 1. Load AI Models
            try {
                await this.faceManager.loadModels(ui.showLoading);
            } catch (modelError) {
                console.error("Model loading failed:", modelError);
                ui.showError(
                    `Failed to load AI models. This might be due to:\n` +
                    `• No internet connection\n` +
                    `• Browser doesn't support WebGL\n` +
                    `• Ad blocker is interfering\n\n` +
                    `Error: ${modelError.message}`,
                    () => { location.reload(); }
                );
                return;
            }

            // 2. Get user data from session
            try {
                const { config } = firebaseService.getTestConfigFromSession();
                if (!config?.user?.email) {
                    throw new Error("User data is incomplete in session.");
                }
                this.sessionUser = config.user;
                this.testConfig = config;
                
                console.log("Session user loaded:", this.sessionUser.email);
            } catch (sessionError) {
                console.error("Session Error:", sessionError.message);
                ui.showError(
                    `${sessionError.message}\n\nPlease return to the student portal and start the test again.`,
                    () => { window.location.href = '../student-new2.html'; }
                );
                return;
            }
            
            // --- ADD THIS CHECK HERE ---
            // Check if user already has face descriptors
            if (this.sessionUser.faceModel?.descriptors) {
                console.log("User already has face descriptors. Skipping capture stage.");
                ui.showLoading("Face model found, redirecting to test...");
                this.navigateToTest(); // Immediately navigate to the test
                return; // Stop the rest of the initialization
            }
            // --- END OF ADDED CHECK ---
            
            // 3. Setup UI
            ui.setupEventListeners({
                onStartRegistration: this.startRegistrationProcess,
                onCapturePhoto: this.capturePhoto,
                onResetRegistration: this.resetRegistration,
                onNavigateToTest: this.navigateToTest.bind(this),
                onModalClose: ui.closeModal
            });
            
            // 4. Show the photo stage
            ui.showPhotoStage(this.sessionUser);
            ui.hideLoading();

        } catch (error) {
            console.error("Initialization failed:", error);
            ui.showError(`Critical error: ${error.message}. Please refresh.`);
        }
    }

    /**
     * Start registration process (initializes camera)
     */
    async startRegistrationProcess() {
        if (!this.sessionUser) {
            return ui.showModal("Session expired. Please refresh the page.", "Error", "⚠");
        }

        ui.updateStartBtn("Requesting Camera Access...", true);
        ui.showVideo();

        const videoElement = document.getElementById('video');
        
        if (!videoElement) {
            ui.showModal("Video element not found. Please refresh.", "Error", "⚠");
            ui.updateStartBtn("Start Face Registration", false);
            return;
        }

        try {
            ui.updateRegistrationMessage("Please allow camera access when prompted...");
            
            // Start registration in MANUAL mode
            await this.faceManager.register({
                videoElement: videoElement,
                userEmail: this.sessionUser.email,
                updateUIMessage: ui.updateRegistrationMessage,
                updatePhotoGuidance: ui.updatePhotoGuidance,
                manualCapture: true, // Enable manual capture mode
                onCameraReady: () => {
                    // Camera is ready, switch to capture mode
                    ui.switchToCaptureMode();
                }
            });

        } catch (error) {
            console.error("Registration initialization failed:", error);
            
            let userMessage = error.message;
            
            if (error.name === 'NotAllowedError' || error.message.includes('permission')) {
                userMessage = "Camera access was denied. Please allow camera access and try again.";
            } else if (error.name === 'NotFoundError') {
                userMessage = "No camera found. Please connect a camera and try again.";
            }
            
            ui.updateRegistrationMessage(`✗ ${userMessage}`, true);
            ui.updateStartBtn("Retry Registration", false);
            
            if (error.name === 'NotAllowedError' || error.name === 'NotFoundError') {
                ui.showModal(userMessage, "Camera Error", "⚠");
            }
        }
    }

    /**
     * Capture a single photo (called when user clicks capture button)
     */
    async capturePhoto() {
        const videoElement = document.getElementById('video');
        
        if (!videoElement) {
            ui.showModal("Video element not found.", "Error", "⚠");
            return;
        }

        // Disable button during capture
        ui.updateCaptureBtn("Capturing...", true);

        try {
            // Capture photo using the manager (with photo thumbnail callback)
            const result = await this.faceManager.capturePhoto(
                ui.updateRegistrationMessage,
                ui.updatePhotoGuidance,
                ui.updatePhotoThumbnail  // Add this callback to display photos
            );

            // Check if registration is complete
            if (result.completed) {
                
                // --- NEW: Re-load user data from session ---
                // The manager has updated the session, so we update our local copy
                try {
                    const updatedProfile = sessionStorage.getItem('studentProfile');
                    if (updatedProfile) {
                        this.sessionUser = JSON.parse(updatedProfile);
                        console.log('App: Updated local sessionUser with new face model.');
                    }
                } catch (e) {
                    console.error('App: Failed to re-load session storage:', e);
                }
                // --- END NEW ---
                // Registration complete!
                ui.updateCaptureBtn("Registration Complete ✓", true);
                
                setTimeout(() => {
                    ui.showSuccessStage(this.sessionUser);
                }, 1500);
            } else {
                // Re-enable button for next photo
                ui.updateCaptureBtn("Capture Photo", false);
            }

        } catch (error) {
            console.error("Photo capture failed:", error);
            
            let userMessage = error.message;
            
            // Show error but allow retry
            ui.updateRegistrationMessage(`✗ ${userMessage}`, true);
            
            // Check if it's a face mismatch error
            if (error.message.includes('Face mismatch')) {
                ui.showModal(
                    userMessage + '\n\nPlease try again with the same person. You don\'t need to restart - just recapture this photo.',
                    "Face Verification Failed",
                    "⚠"
                );
                
                // Just retry the current photo - DON'T reset the whole session
                ui.updateCaptureBtn("Retry This Photo", false);
                
            } else if (error.message.includes('No face detected')) {
                // Just retry the same photo
                ui.showModal(
                    userMessage + '\n\nMake sure:\n• Your face is clearly visible\n• Good lighting\n• Look at the camera',
                    "Face Not Detected",
                    "⚠"
                );
                ui.updateCaptureBtn("Retry Capture", false);

            // --- ADD THIS BLOCK ---
            } else if (error.message.includes('Image quality is poor')) {
                // Show modal for poor quality
                ui.showModal(
                    userMessage + '\n\nPlease try again.\n• Hold still\n• Make sure there is enough light on your face',
                    "Image Quality Issue",
                    "⚠"
                );
                ui.updateCaptureBtn("Retry Capture", false);
            // --- END OF BLOCK ---
            
            } else {
                // Other errors
                ui.updateCaptureBtn("Retry Capture", false);
            }
        }
    }

    navigateToTest() {
        // Clear any active streams before navigating
        const videoElement = document.getElementById('video');
        if (videoElement && videoElement.srcObject) {
            videoElement.srcObject.getTracks().forEach(track => track.stop());
        }
        
        // Also reset manager if needed
        this.faceManager.resetManualRegistration();
        
        window.location.href = '../test4.html'; 
    }

    /**
 * Resets the registration process entirely
 */
resetRegistration() {
    console.log('App: Resetting registration...');
    try {
        // 1. Stop the camera and clear data in the manager
        this.faceManager.resetManualRegistration();

        // 2. Reset the UI back to the "Start" button
        ui.resetToStartMode();

        // 3. Give user feedback
        ui.updateRegistrationMessage('Registration has been reset. You can start over.', false);

    } catch (error) {
        console.error('App: Error during reset:', error);
        ui.showModal(`An error occurred while resetting: ${error.message}`, "Error", "⚠");
    }
}
}

// --- Initialize the application ---
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

function initApp() {
    ui.cacheDOMElements();
    const app = new App();
    app.initialize();
}