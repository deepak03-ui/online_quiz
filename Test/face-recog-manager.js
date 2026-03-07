// face-recog-manager.js
// Optimized face recognition with a robust and isolated data structure for storage,
// now including image quality analysis and user feedback.

import * as faceApi from './Face_recog/faceRecognition.js';
import { uploadDescriptors, fetchDescriptors } from './firestore-service.js';

// --- Configuration Constants ---

/** The minimum confidence threshold for a face match. (Lower = stricter) */
const MATCH_THRESHOLD = 0.5;

/** The number of photos to capture during the registration process. */
const NUM_PHOTOS_FOR_REGISTRATION = 5;

/** The max number of frames to check for a face during verification before failing. */
const MAX_DETECTION_ATTEMPTS = 20;

/** The target frames per second to process during verification. */
const FPS = 5;

/** Minimum average brightness (0-255). Frames below this are 'low-light'. */
const BRIGHTNESS_THRESHOLD = 60;

/** Minimum Laplacian variance. Frames below this are 'blurry'. */
const BLUR_THRESHOLD = 40;

/** Minimum standard deviation of grayscale values. Frames below this are 'low-contrast'. */
const CONTRAST_THRESHOLD = 30;

// --- Class Definition ---

export class FaceRecogManager {
    constructor() {
        this.modelsLoaded = false;
        this.videoElement = null;
        this.canvas = null;
        this.ctx = null;
    }

    /**
     * Creates or retrieves the off-screen canvas used for processing video frames.
     * @returns {HTMLCanvasElement} The processing canvas.
     */
    createProcessingCanvas() {
        if (!this.canvas) {
            this.canvas = document.createElement('canvas');
            this.canvas.width = 640;
            this.canvas.height = 480;
            // 'willReadFrequently' is a performance hint for getImageData
            this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
        }
        return this.canvas;
    }

    /**
     * Analyzes a video frame for common image quality issues.
     * @param {ImageData} imageData - The raw pixel data from the canvas.
     * @returns {object} An object containing quality metrics and an array of issue strings.
     */
    _analyzeFrameQuality(imageData) {
        const data = imageData.data;
        const width = imageData.width;
        const height = imageData.height;
        const pixelCount = width * height;
        if (pixelCount === 0) return { issues: ['empty-frame'] };

        const gray = new Uint8Array(pixelCount);
        let sumBrightness = 0;
        const histogram = new Array(256).fill(0);

        // 1. Calculate Grayscale, Brightness Sum, and Histogram
        for (let i = 0, j = 0; i < data.length; i += 4, j++) {
            // Using REC. 601 luma formula (0.299R + 0.587G + 0.114B)
            const grayValue = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
            gray[j] = grayValue;
            sumBrightness += grayValue;
            histogram[grayValue]++;
        }

        const brightness = sumBrightness / pixelCount;

        // 2. Calculate Contrast (Standard Deviation)
        let sumStdDev = 0;
        for (let i = 0; i < 256; i++) {
            if (histogram[i] > 0) {
                sumStdDev += Math.pow(i - brightness, 2) * histogram[i];
            }
        }
        const contrast = Math.sqrt(sumStdDev / pixelCount);

        // 3. Calculate Sharpness (Variance of Laplacian)
        // We use a simplified 3x3 Laplacian kernel: [0, 1, 0], [1, -4, 1], [0, 1, 0]
        let laplacianVarSum = 0;
        let laplacianMeanSum = 0;
        let validPixels = 0;

        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const i = y * width + x;
                // Simplified kernel calculation
                const lapValue = (
                    gray[i - width] +
                    gray[i - 1] - 4 * gray[i] + gray[i + 1] +
                    gray[i + width]
                );
                laplacianMeanSum += lapValue;
                laplacianVarSum += lapValue * lapValue;
                validPixels++;
            }
        }
        
        // Calculate variance
        const laplacianMean = validPixels > 0 ? laplacianMeanSum / validPixels : 0;
        const sharpness = validPixels > 0 ? (laplacianVarSum / validPixels) - (laplacianMean * laplacianMean) : 0;

        // 4. Collect issues
        const issues = [];
        if (brightness < BRIGHTNESS_THRESHOLD) issues.push('low-light');
        if (sharpness < BLUR_THRESHOLD) issues.push('blurry');
        if (contrast < CONTRAST_THRESHOLD) issues.push('low-contrast');
        
        return { brightness, sharpness, contrast, issues, histogram, pixelCount };
    }

    /**
     * Applies a simple and fast Contrast Stretching to the image.
     * This is more "natural" for the DL model than CLAHE.
     * @param {ImageData} imageData - The image data to modify in place.
     * @param {number[]} histogram - The 256-bin histogram from _analyzeFrameQuality.
     * @param {number} pixelCount - The total number of pixels.
     * @returns {ImageData} The modified image data.
     */
    _applyContrastStretching(imageData, histogram, pixelCount) {
        const data = imageData.data;
        const clipLimit = pixelCount * 0.01; // Clip the bottom 1% and top 1%

        // Find the new "min" (1st percentile)
        let min = 0;
        let cumulative = 0;
        while (min < 255) {
            cumulative += histogram[min];
            if (cumulative >= clipLimit) break;
            min++;
        }

        // Find the new "max" (99th percentile)
        let max = 255;
        cumulative = 0;
        while (max > 0) {
            cumulative += histogram[max];
            if (cumulative >= clipLimit) break;
            max--;
        }

        // Prevent division by zero if image is solid color
        if (min >= max) return imageData; 

        // Calculate the scale factor
        const scale = 255.0 / (max - min);
        
        // Apply the stretch to all R, G, B channels
        for (let i = 0; i < data.length; i += 4) {
            // Apply: new_value = (old_value - min) * scale
            // We also clamp the value between 0 and 255
            data[i] = Math.max(0, Math.min(255, (data[i] - min) * scale));
            data[i + 1] = Math.max(0, Math.min(255, (data[i + 1] - min) * scale));
            data[i + 2] = Math.max(0, Math.min(255, (data[i + 2] - min) * scale));
        }
        
        return imageData;
    }
    

    /**
     * Captures a frame from the video, runs quality analysis, and applies enhancement.
     * @returns {object|null} An object { processedCanvas, qualityReport } or null on error.
     */
    processVideoFrame() {
        if (!this.videoElement || !this.canvas || !this.ctx) return null;
        try {
            // 1. Draw video to canvas and get raw image data
            this.ctx.drawImage(this.videoElement, 0, 0, this.canvas.width, this.canvas.height);
            const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);

            // 2. Analyze the *original* frame for quality
            let qualityReport = this._analyzeFrameQuality(imageData);

            // 3. Check if quality is good. If so, we are done.
            if (qualityReport.issues.length === 0) {
                // Quality is high, no enhancement needed.
                // The canvas already has the original image, so just return.
                return { processedCanvas: this.canvas, qualityReport };
            }

            // 4. --- Quality was poor, apply Contrast Stretching ---
            // The original image failed. Let's try to fix it.
            // This will help with low-light, low-contrast, AND blurry scores.
            console.log(`Original image quality poor (${qualityReport.issues.join(', ')}). Applying Contrast Stretching...`);
            this._applyContrastStretching(
                imageData, 
                qualityReport.histogram, 
                qualityReport.pixelCount
            ); // Modifies imageData in place

            // 5. --- Re-analyze the *enhanced* frame ---
            // This checks if the optimization fixed the issues
            qualityReport = this._analyzeFrameQuality(imageData);

            // 6. Put the *enhanced* data back on the canvas
            this.ctx.putImageData(imageData, 0, 0);

            // 7. Return the enhanced canvas and the *final* quality report
            // The capturePhoto function will use this new report to pass/fail.
            return { processedCanvas: this.canvas, qualityReport };
            
        } catch (error) {
            console.error('Error processing video frame:', error);
            return null;
        }
    }

    /**
     * Finds or creates the hidden video element used for background verification.
     * @returns {HTMLVideoElement} The video element.
     */
    getOrCreateVideoElement() {
        // Check if the user-facing proctoring video exists
        let proctoringVideo = document.getElementById('proctoring-video');
        if (proctoringVideo) {
            this.videoElement = proctoringVideo;
            this.createProcessingCanvas();
            return proctoringVideo;
        }

        // If not, create a hidden one
        let faceContainer = document.getElementById('face-recognition-container');
        if (!faceContainer) {
            faceContainer = document.createElement('div');
            faceContainer.id = 'face-recognition-container';
            // Styles to hide it completely
            faceContainer.style.cssText = `position:fixed;bottom:0;right:0;width:1px;height:1px;opacity:0.01;pointer-events:none;z-index:-1000;overflow:hidden;`;
            document.body.appendChild(faceContainer);
        }
        
        let videoElement = document.getElementById('face-recognition-video');
        if (videoElement) videoElement.remove(); // Clean up old one if it exists
        
        videoElement = document.createElement('video');
        videoElement.id = 'face-recognition-video';
        videoElement.autoplay = true;
        videoElement.playsinline = true;
        videoElement.muted = true;
        videoElement.style.cssText = `width:640px;height:480px;`;
        faceContainer.appendChild(videoElement);
        
        this.videoElement = videoElement;
        this.createProcessingCanvas();
        return this.videoElement;
    }

    /**
     * Loads the required face-api.js models.
     * @param {function(string)} updateCallback - A function to call with loading progress updates.
     */
    async loadModels(updateCallback) {
        if (this.modelsLoaded) return;
        try {
           
            await faceApi.loadModels(updateCallback);
            this.modelsLoaded = true;
            console.log('FaceRecogManager: Models loaded successfully');
        } catch (error) {
            console.error('FaceRecogManager: Failed to load models:', error);
            throw new Error(`Could not load AI models: ${error.message}`);
        }
    }


// Replace the existing register() method in face-recog-manager.js with this:

/**
 * Registers a new user's face with MANUAL photo capture.
 * Camera stays open, user clicks to capture each of 5 photos.
 * Verifies same person across all photos before saving.
 * 
 * @param {object} options
 * @param {HTMLVideoElement} options.videoElement - The video element to stream from.
 * @param {string} options.userEmail - The user's email for storing data.
 * @param {function(string, boolean=)} options.updateUIMessage - (message, isError)
 * @param {function(number, number, string)} options.updatePhotoGuidance - (current, total, instruction)
 * @param {function()} options.onCameraReady - Called when camera is ready for manual capture
 * @param {boolean} options.manualCapture - Set to true for manual capture mode (default: false for backward compatibility)
 */
async register({ 
    videoElement, 
    userEmail, 
    updateUIMessage, 
    updatePhotoGuidance, 
    onCameraReady = null,
    manualCapture = false 
}) {
    if (!this.modelsLoaded) throw new Error('Models not loaded.');
    if (!videoElement) throw new Error('A video element must be provided.');

    this.videoElement = videoElement;
    this.isManualRegistration = manualCapture;
    this.capturedDescriptors = [];
    this.currentPhotoIndex = 0;
    this.registrationUserEmail = userEmail;

    let stream = null;

    try {
        updateUIMessage('Starting webcam...');
        stream = await navigator.mediaDevices.getUserMedia({ 
            video: { width: { ideal: 640 }, height: { ideal: 480 } } 
        });
        this.videoElement.srcObject = stream;
        this.registrationStream = stream;
        
        await new Promise(resolve => { this.videoElement.onloadedmetadata = resolve; });
        await this.videoElement.play();
        this.createProcessingCanvas();

        if (manualCapture) {
            // MANUAL MODE: Camera ready, wait for user clicks
            updateUIMessage('Camera ready. Click "Capture Photo" when ready.');
            updatePhotoGuidance(0, NUM_PHOTOS_FOR_REGISTRATION, 'Look straight at the camera');
            
            if (onCameraReady) {
                onCameraReady();
            }
            // Don't close stream - keep it open for manual captures
            return;
        } else {
            // AUTOMATIC MODE: Original behavior
            const photoInstructions = [
                'Look straight at the camera', 
                'Slowly turn your head to the left',
                'Slowly turn your head to the right', 
                'Tilt your head up slightly', 
                'Tilt your head down slightly'
            ];

            for (let i = 0; i < NUM_PHOTOS_FOR_REGISTRATION; i++) {
                updatePhotoGuidance(i + 1, NUM_PHOTOS_FOR_REGISTRATION, photoInstructions[i]);
                updateUIMessage(`Get ready for photo ${i + 1}...`);
                await new Promise(r => setTimeout(r, 2500));
                updateUIMessage(`Capturing photo ${i + 1}...`);

                let descriptor = await faceApi.getFaceDescriptor(this.videoElement);

                if (!descriptor) {
                    const frameData = this.processVideoFrame();
                    if (frameData) {
                        descriptor = await faceApi.getFaceDescriptor(frameData.processedCanvas);
                    }
                }

                if (!descriptor) {
                    updateUIMessage('No face detected. Please try again.', true);
                    i--;
                } else {
                    this.capturedDescriptors.push(Array.from(descriptor));
                    updateUIMessage(`✓ Photo ${i + 1} captured successfully!`);
                }
            }

            // Save automatically
            await this._saveRegistrationData(updateUIMessage);
        }

    } catch (error) {
        console.error('FaceRecogManager: Registration failed:', error);
        updateUIMessage(`Registration failed: ${error.message}`, true);
        throw new Error(`Registration failed: ${error.message}`);
    } finally {
        if (!manualCapture && stream) {
            stream.getTracks().forEach(track => track.stop());
            this.registrationStream = null;
        }
    }
}

/**
 * Capture a single photo manually (call this when user clicks capture button)
 * @param {function(string, boolean=)} updateUIMessage
 * @param {function(number, number, string)} updatePhotoGuidance
 * @param {function(number, string)} updatePhotoThumbnail - Optional callback to display captured photo
 * @returns {Promise<{completed: boolean, current: number, total: number}>}
 */
async capturePhoto(updateUIMessage, updatePhotoGuidance, updatePhotoThumbnail = null) {
    if (!this.isManualRegistration) {
        throw new Error('Manual registration not started');
    }

    const photoNum = this.currentPhotoIndex + 1;
    const photoInstructions = [
        'Look straight at the camera',
        'Turn slightly to the left',
        'Turn slightly to the right',
        'Tilt your head slightly up',
        'Tilt your head slightly down'
    ];

    try {
        updateUIMessage(`Capturing photo ${photoNum}/${NUM_PHOTOS_FOR_REGISTRATION}...`);

        // --- START OF MODIFIED LOGIC ---

        // 1. Process the video frame to check quality FIRST
        const frameData = this.processVideoFrame();
        if (!frameData) {
            throw new Error('Could not process camera frame.');
        }

        const { processedCanvas, qualityReport } = frameData;

        // 2. Check for quality issues
        if (qualityReport.issues.length > 0) {
            let issueMsg = 'Image quality is poor. ';
            const score = qualityReport.sharpness.toFixed(0); // Get the actual score

            if (qualityReport.issues.includes('low-light')) {
                issueMsg += 'It is too dark. Please improve lighting.';
            } else if (qualityReport.issues.includes('blurry')) {
                // --- THIS IS THE FIX ---
                issueMsg += `It is too blurry (Score: ${score}, Required: ${BLUR_THRESHOLD}). Please hold still.`;
            } else if (qualityReport.issues.includes('low-contrast')) {
                issueMsg += 'Low contrast detected.';
            }

            // This error will be caught by app.js and shown in a modal
            throw new Error(issueMsg); 
        }

        // 3. Get image data URL *from the processed canvas*
        const capturedImageData = processedCanvas.toDataURL('image/jpeg', 0.8);

        // 4. Try to get descriptor *from the processed (and enhanced) canvas*
        const descriptor = await faceApi.getFaceDescriptor(processedCanvas);

        // --- END OF MODIFIED LOGIC ---

        if (!descriptor) {
            throw new Error('No face detected. Please ensure your face is clearly visible and try again.');
        }

        // Verify same person (if not first photo)
        if (this.capturedDescriptors.length > 0) {
            const isMatch = this._verifySamePerson(descriptor);
            if (!isMatch) {
                throw new Error('Face mismatch detected. Please ensure the same person is in all photos.');
            }
        }

        // Store descriptor
        this.capturedDescriptors.push(Array.from(descriptor));
        this.currentPhotoIndex++;

        // Display the captured photo in UI
        if (updatePhotoThumbnail && capturedImageData) {
            updatePhotoThumbnail(photoNum, capturedImageData);
        }

        // Update UI
        updatePhotoGuidance(
            photoNum, 
            NUM_PHOTOS_FOR_REGISTRATION, 
            photoNum < NUM_PHOTOS_FOR_REGISTRATION ? photoInstructions[photoNum] : 'All photos captured!'
        );

        // Check if complete
        if (this.currentPhotoIndex >= NUM_PHOTOS_FOR_REGISTRATION) {
            await this._saveRegistrationData(updateUIMessage);
            return { completed: true, current: photoNum, total: NUM_PHOTOS_FOR_REGISTRATION };
        } else {
            updateUIMessage(`Photo ${photoNum} captured! ${NUM_PHOTOS_FOR_REGISTRATION - photoNum} more to go.`);
            return { completed: false, current: photoNum, total: NUM_PHOTOS_FOR_REGISTRATION };
        }

    } catch (error) {
        // Pass the error up to app.js to be handled
        throw error;
    }
}

/**
 * Verify that new descriptor matches previously captured ones
 * @private
 */
_verifySamePerson(newDescriptor) {
    for (const storedDescArray of this.capturedDescriptors) {
        const storedDesc = faceApi.arrayToDescriptor(storedDescArray);
        if (storedDesc) {
            const distance = faceApi.compareDescriptors(newDescriptor, storedDesc);
            if (distance > MATCH_THRESHOLD) {
                console.warn(`Face mismatch: distance=${distance.toFixed(3)}, threshold=${MATCH_THRESHOLD}`);
                return false;
            }
        }
    }
    return true;
}

/**
 * Save all captured descriptors to database
 * @private
 */
async _saveRegistrationData(updateUIMessage) {
    updateUIMessage('Uploading face data...');
    
    const dataToUpload = {
        faceModel: {
            descriptors: JSON.stringify(this.capturedDescriptors),
            lastUpdated: new Date().toISOString()
        }
    };

    await uploadDescriptors(this.registrationUserEmail, dataToUpload);
    console.log('FaceRecogManager: Registration completed for', this.registrationUserEmail);
    // 3. --- NEW: Save to Session Storage ---
    try {
        // Get the current user profile from session
        const sessionData = sessionStorage.getItem('studentProfile');
        if (!sessionData) {
            throw new Error('studentProfile not found in session storage.');
        }
        
        const userProfile = JSON.parse(sessionData);
        
        // Add/update the faceModel (this matches the login.js structure)
        userProfile.faceModel = dataToUpload.faceModel;
        
        // Save the *entire updated profile* back to the session
        sessionStorage.setItem('studentProfile', JSON.stringify(userProfile));
        
        console.log('FaceRecogManager: Face model saved to session storage.');
        // Send the final success message as requested
        updateUIMessage('✓ Registration successful and saved!', false);

    } catch (error) {
        console.error('FaceRecogManager: Failed to save to session storage:', error);
        // Even if session save fails, Firestore save succeeded.
        updateUIMessage('✓ Registration uploaded, but session save failed. Please refresh.', true);
    }
    // --- END NEW ---
    
    // Clean up
    this.resetManualRegistration();

}

/**
 * Reset manual registration state and stop camera
 */
resetManualRegistration() {
    if (this.registrationStream) {
        this.registrationStream.getTracks().forEach(track => track.stop());
        this.registrationStream = null;
    }
    
    this.isManualRegistration = false;
    this.capturedDescriptors = [];
    this.currentPhotoIndex = 0;
    this.registrationUserEmail = null;
    
    if (this.videoElement && this.videoElement.srcObject) {
        this.videoElement.srcObject = null;
    }
}

    /**
     * Verifies a user's identity against their stored face data.
     * @param {object} options
     * @param {string} options.userEmail - The user's email to fetch data for.
     * @param {function(string)} options.onUpdateMessage - (message)
     * @returns {Promise<boolean>} True if verified, false otherwise.
     */
    async verify({ userEmail, onUpdateMessage }) {
        if (!this.modelsLoaded) throw new Error('Models not loaded.');
        let stream = null;
        try {
            this.videoElement = this.getOrCreateVideoElement();
            onUpdateMessage('Requesting camera access...');
            stream = await navigator.mediaDevices.getUserMedia({ 
                video: { width: { ideal: 640 }, height: { ideal: 480 } } 
            });
            this.videoElement.srcObject = stream;
            await new Promise(resolve => { this.videoElement.onloadedmetadata = resolve; });
            await this.videoElement.play();
            
            onUpdateMessage('Loading registered face data...');
            
            // Fetch the specific 'faceModel' object.
            const storedFaceModel = await fetchDescriptors(userEmail);
            
            // Check for the object and that the 'descriptors' field is a non-empty string.
            if (!storedFaceModel || typeof storedFaceModel.descriptors !== 'string' || storedFaceModel.descriptors.length < 10) {
                throw new Error('Face not registered. Please complete registration first.');
            }
            
            // Parse the JSON string back into a nested array.
            const storedDescriptorsArray = JSON.parse(storedFaceModel.descriptors);

            if (!Array.isArray(storedDescriptorsArray)) {
                throw new Error('Failed to parse stored face data.');
            }

            // Convert plain arrays back into face-api.js Float32Array descriptors
            const referenceDescriptors = storedDescriptorsArray
                .map(arr => faceApi.arrayToDescriptor(arr))
                .filter(desc => desc !== null);

            if (referenceDescriptors.length === 0) {
                throw new Error('No valid registered face descriptors found.');
            }
            console.log(`Verification: Loaded ${referenceDescriptors.length} reference descriptors`);

            onUpdateMessage('Analyzing your face...');
            let liveDescriptor = null;
            let lastQualityIssues = []; // To track the last known issue

            for (let attempt = 0; attempt < MAX_DETECTION_ATTEMPTS; attempt++) {
    // 1. First, try detecting directly from the video element (fastest path)
    liveDescriptor = await faceApi.getFaceDescriptor(this.videoElement);
    if (liveDescriptor) break; // Success!

    // 2. If it fails, then run your quality analysis and enhancement
    const frameData = this.processVideoFrame();
    if (frameData) {
        const { processedCanvas, qualityReport } = frameData;
        lastQualityIssues = qualityReport.issues;
        
        // Try again with the enhanced canvas
        liveDescriptor = await faceApi.getFaceDescriptor(processedCanvas);
        if (liveDescriptor) break; // Success with enhancement!
    }

                // Build and show helpful retry message
                let retryMsg = 'Could not detect face.';
                if (lastQualityIssues.includes('low-light')) {
                    retryMsg = 'It seems too dark. Please improve lighting.';
                } else if (lastQualityIssues.includes('blurry')) {
                    retryMsg = 'Image is blurry. Please hold still.';
                } else if (lastQualityIssues.includes('low-contrast')) {
                    retryMsg = 'Low contrast. Please check lighting.';
                }
                
                onUpdateMessage(`${retryMsg} Retrying... (${attempt + 1}/${MAX_DETECTION_ATTEMPTS})`);
                
                await new Promise(r => setTimeout(r, 1000 / FPS));
            }

            // Throw a more informative error if it fails
            if (!liveDescriptor) {
                 throw new Error('Could not detect face after multiple attempts. Please check your lighting, camera position, and hold still.');
            }

            onUpdateMessage('Face detected! Comparing with registration...');

            // Compare the live descriptor against all stored reference descriptors
            const distances = referenceDescriptors.map(refDesc => faceApi.compareDescriptors(liveDescriptor, refDesc));
            const minDistance = Math.min(...distances);
            const isMatch = minDistance < MATCH_THRESHOLD;

            console.log(`Verification result: distance=${minDistance.toFixed(4)}, match=${isMatch}`);
            onUpdateMessage(isMatch ? '✓ Identity verified successfully!' : '✗ Identity verification failed.');
            return isMatch;

        } catch (error) {
            console.error('FaceRecogManager: Verification failed:', error);
            onUpdateMessage(`Error: ${error.message}`);
            throw error;
        } finally {
            if (stream) {
                // --- FIX: ONLY STOP/CLEAN UP *HIDDEN* VIDEO ---
                if (this.videoElement && this.videoElement.id === 'face-recognition-video') {
                    // It was a hidden video, so stop the stream and remove it.
                    stream.getTracks().forEach(track => track.stop());
                    this.videoElement.srcObject = null;
                    this.videoElement.remove();
                    this.videoElement = null;
                }
            }
        }
    }
}