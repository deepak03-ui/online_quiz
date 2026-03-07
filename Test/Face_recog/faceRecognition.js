// faceRecognition.js - Production Ready

const FACE_MODELS_URL = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@0.22.2/weights';
const VIDEO_READY_TIMEOUT = 10000;

let videoStream = null;

export async function loadModels(updateCallback) {
    try {
        // --- ADD THIS SECTION TO ENABLE GPU ---
        // We set the backend to 'webgl' which is the browser's API for the GPU.
        // This must be done before loading any models.
        if (faceapi.tf.getBackend() !== 'webgl') {
            await faceapi.tf.setBackend('webgl');
            await faceapi.tf.ready();
            console.log('FaceAPI backend set to WebGL (GPU).');
        }
        // --- END OF GPU SECTION ---

        updateCallback('Loading Face Detector...');
        await faceapi.nets.tinyFaceDetector.loadFromUri(FACE_MODELS_URL);
        
        updateCallback('Loading Facial Landmarks Model...');
        await faceapi.nets.faceLandmark68Net.loadFromUri(FACE_MODELS_URL);
        
        updateCallback('Loading Face Recognition Model...');
        await faceapi.nets.faceRecognitionNet.loadFromUri(FACE_MODELS_URL);
        
        updateCallback('Models loaded successfully');
    } catch (error) {
        // This will now catch errors if WebGL is not supported.
        console.error("Model loading failed. This device may not support WebGL.", error);
        throw new Error(`Model loading failed: ${error.message}`);
    }
}

export async function startCamera(videoElement) {
    try {
        if (videoStream) stopCamera();

        const constraints = {
            video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }
        };

        videoStream = await navigator.mediaDevices.getUserMedia(constraints);
        videoElement.srcObject = videoStream;

        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Camera timed out')), VIDEO_READY_TIMEOUT);
            videoElement.onloadedmetadata = () => {
                clearTimeout(timeout);
                videoElement.play();
                resolve();
            };
        });
        
        return videoStream;
    } catch (error) {
        throw new Error(`Camera initialization failed: ${error.message}`);
    }
}

export function stopCamera() {
    if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
        videoStream = null;
    }
}

export async function getFaceDescriptor(input) {
    try {
        const detection = await faceapi
            .detectSingleFace(input, new faceapi.TinyFaceDetectorOptions({ inputSize: 224 }))
            .withFaceLandmarks()
            .withFaceDescriptor();

        if (detection && validateDescriptor(detection.descriptor)) {
            return detection.descriptor;
        }
        return null;
    } catch (error) {
        return null;
    }
}

function validateDescriptor(descriptor) {
    return (descriptor instanceof Float32Array) && descriptor.length === 128 && !descriptor.some(v => !isFinite(v));
}

export function arrayToDescriptor(arr) {
    try {
        if (!Array.isArray(arr) || arr.length !== 128) {
            return null;
        }
        const descriptor = new Float32Array(arr);
        return validateDescriptor(descriptor) ? descriptor : null;
    } catch (error) {
        return null;
    }
}

export function compareDescriptors(liveDescriptor, referenceDescriptor) {
    if (!validateDescriptor(liveDescriptor) || !validateDescriptor(referenceDescriptor)) {
        throw new Error('Invalid descriptor provided for comparison.');
    }
    return faceapi.euclideanDistance(liveDescriptor, referenceDescriptor);
}
