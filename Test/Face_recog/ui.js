// ui.js - Manual capture version

// --- Element Cache ---
let elements = {};

export function cacheDOMElements() {
    elements = {
        loadingOverlay: document.getElementById('loading-overlay'),
        loadingMessage: document.getElementById('loading-message'),
        
        // Stages
        stageError: document.getElementById('stage-error'),
        stagePhoto: document.getElementById('stage-photo'),
        stageSuccess: document.getElementById('stage-success'),

        // Error
        errorMessage: document.getElementById('error-message'),
        btnBack: document.getElementById('btn-back'),

        // Photo
        video: document.getElementById('video'),
        videoContainer: document.getElementById('camera-display'),
        btnStartCapture: document.getElementById('btn-start-capture'),
        btnCapturePhoto: document.getElementById('btn-capture-photo'),
        btnResetRegistration: document.getElementById('btn-reset-registration'),
        registrationMessage: document.getElementById('registration-message'),
        photoGuidance: document.getElementById('photo-guidance'),

        // Success
        btnContinueToTest: document.getElementById('btn-continue-to-test'),
        detailName: document.getElementById('detail-name'),
        detailEmail: document.getElementById('detail-email'),
        detailRoll: document.getElementById('detail-roll'),
        detailRegister: document.getElementById('detail-register'),

        // Modal
        modal: document.getElementById('modal'),
        modalIcon: document.getElementById('modal-icon'),
        modalTitle: document.getElementById('modal-title'),
        modalMessage: document.getElementById('modal-message'),
        btnModalClose: document.getElementById('btn-modal-close'),
        photoButtonContainer: document.querySelector('#stage-photo .button-container')
    };

    const found = [];
    const missing = [];
    
    for (const [key, value] of Object.entries(elements)) {
        if (value) {
            found.push(key);
        } else {
            missing.push(key);
        }
    }
    
    console.log(`✓ Found ${found.length} elements:`, found);
    if (missing.length > 0) {
        console.warn(`⚠ Missing ${missing.length} elements:`, missing);
    }
}

// --- Loading & Modal ---

export function showLoading(message) {
    if (elements.loadingMessage) {
        elements.loadingMessage.textContent = message;
    }
    if (elements.loadingOverlay) {
        elements.loadingOverlay.classList.remove('hidden');
    }
}

export function hideLoading() {
    if (elements.loadingOverlay) {
        elements.loadingOverlay.classList.add('hidden');
    }
}

export function showModal(message, title = 'Information', icon = 'ℹ') {
    if (!elements.modal) {
        alert(`${title}\n\n${message}`);
        return;
    }
    
    if (elements.modalIcon) elements.modalIcon.textContent = icon;
    if (elements.modalTitle) elements.modalTitle.textContent = title;
    if (elements.modalMessage) elements.modalMessage.textContent = message;
    elements.modal.classList.add('active');
}

export function closeModal() {
    if (elements.modal) {
        elements.modal.classList.remove('active');
    }
}

// --- Navigation ---

function moveToStage(stageId) {
    const allStages = document.querySelectorAll('.stage-container');
    allStages.forEach(stage => {
        stage.classList.add('hidden');
    });
    
    const targetStage = document.getElementById(stageId);
    if (targetStage) {
        targetStage.classList.remove('hidden');
        console.log(`✓ Moved to stage: ${stageId}`);
    } else {
        console.error(`✗ Stage not found: ${stageId}`);
    }
}

// --- Event Listeners Setup ---

export function setupEventListeners({ onStartRegistration, onCapturePhoto, onResetRegistration, onNavigateToTest, onModalClose }) {
    elements.btnStartCapture = document.getElementById('btn-start-capture');
    elements.btnCapturePhoto = document.getElementById('btn-capture-photo');
    elements.btnResetRegistration = document.getElementById('btn-reset-registration');
    
    if (elements.btnStartCapture) {
        elements.btnStartCapture.onclick = onStartRegistration;
        console.log('✓ Start registration button listener attached');
    }
    
    if (elements.btnCapturePhoto) {
        elements.btnCapturePhoto.onclick = onCapturePhoto;
        console.log('✓ Capture photo button listener attached');
    }
    
    if (elements.btnResetRegistration) {
        elements.btnResetRegistration.onclick = onResetRegistration;
        console.log('✓ Reset registration button listener attached');
    }
    
    if (elements.btnContinueToTest) {
        elements.btnContinueToTest.onclick = onNavigateToTest;
        console.log('✓ Continue to test button listener attached');
    }
    
    if (elements.btnModalClose) {
        elements.btnModalClose.onclick = onModalClose;
        console.log('✓ Modal close button listener attached');
    }
    
    // Store handlers for later attachment
    window._faceRegHandlers = {
        onStartRegistration,
        onCapturePhoto,
        onResetRegistration,
        onNavigateToTest,
        onModalClose
    };
}

// --- UI Updaters ---

export function showError(message, onBackCallback) {
    moveToStage('stage-error');
    
    if (elements.errorMessage) {
        elements.errorMessage.textContent = message;
    }
    
    if (elements.btnBack && onBackCallback) {
        elements.btnBack.onclick = onBackCallback;
    }
    
    hideLoading();
}

export function showPhotoStage(user) {
    moveToStage('stage-photo');
    
    // Re-cache and re-attach listeners
    elements.btnStartCapture = document.getElementById('btn-start-capture');
    elements.btnCapturePhoto = document.getElementById('btn-capture-photo');
    
    if (elements.btnStartCapture && window._faceRegHandlers) {
        elements.btnStartCapture.onclick = window._faceRegHandlers.onStartRegistration;
    }
    
    if (elements.btnCapturePhoto && window._faceRegHandlers) {
        elements.btnCapturePhoto.onclick = window._faceRegHandlers.onCapturePhoto;
    }
    
    // Start with capture button hidden
    if (elements.btnCapturePhoto) {
        elements.btnCapturePhoto.style.display = 'none';
    }
}

export function showSuccessStage(user) {
    if (user) {
        if (elements.detailName) elements.detailName.textContent = user.name || 'N/A';
        if (elements.detailEmail) elements.detailEmail.textContent = user.email || 'N/A';
        if (elements.detailRoll) elements.detailRoll.textContent = user.rollNo || 'N/A'; /* <-- FIX */
        if (elements.detailRegister) elements.detailRegister.textContent = user.regNo || 'N/A'; /* <-- FIX */
    }
    moveToStage('stage-success');
}

export function updateStartBtn(message, isDisabled) {
    if (elements.btnStartCapture) {
        elements.btnStartCapture.textContent = message;
        elements.btnStartCapture.disabled = isDisabled;
    }
}

export function updateCaptureBtn(message, isDisabled) {
    if (elements.btnCapturePhoto) {
        elements.btnCapturePhoto.textContent = message;
        elements.btnCapturePhoto.disabled = isDisabled;
    }
}

export function showVideo() {
    if (elements.videoContainer) {
        elements.videoContainer.style.display = 'block';
    }
}

export function updateRegistrationMessage(message, isError = false) {
    if (elements.registrationMessage) {
        elements.registrationMessage.textContent = message;
        elements.registrationMessage.className = isError ? 'message error' : 'message success';
    }
}

export function updatePhotoGuidance(current, total, instruction) {
    if (elements.photoGuidance) {
        elements.photoGuidance.textContent = instruction;
    }
    
    if (current === total && elements.registrationMessage) {
        updateRegistrationMessage('✓ All photos captured!', false);
    }
}

/**
 * Display captured photo in thumbnail slot
 * @param {number} photoNumber - Photo number (1-5)
 * @param {string} imageDataUrl - Base64 image data URL
 */
export function updatePhotoThumbnail(photoNumber, imageDataUrl) {
    const photoElement = document.getElementById(`photo-${photoNumber}`);
    if (photoElement) {
        // Create image element
        const img = document.createElement('img');
        img.src = imageDataUrl;
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'cover';
        
        // Clear and add image
        photoElement.innerHTML = '';
        photoElement.appendChild(img);
        
        // Add checkmark overlay
        const checkmark = document.createElement('div');
        checkmark.className = 'photo-check';
        checkmark.textContent = '✓';
        photoElement.appendChild(checkmark);
        
        console.log(`✓ Photo ${photoNumber} displayed in thumbnail`);
    }
}

/**
 * Switch from "Start Registration" button to "Capture Photo" button
 */
export function switchToCaptureMode() {
    // Re-cache buttons in case they weren't found initially
    elements.btnCapturePhoto = document.getElementById('btn-capture-photo');
    elements.btnResetRegistration = document.getElementById('btn-reset-registration');
    
    if (elements.photoButtonContainer) {
        elements.photoButtonContainer.classList.remove('full');
    }

    if (elements.btnStartCapture) {
        elements.btnStartCapture.style.display = 'none';
    }
    
    if (elements.btnCapturePhoto) {
        elements.btnCapturePhoto.style.display = 'block';
        elements.btnCapturePhoto.disabled = false;
        elements.btnCapturePhoto.textContent = 'Capture Photo';
        
        // Re-attach listener if available
        if (window._faceRegHandlers && window._faceRegHandlers.onCapturePhoto) {
            elements.btnCapturePhoto.onclick = window._faceRegHandlers.onCapturePhoto;
            console.log('✓ Capture photo button activated and listener attached');
        }
    } else {
        console.error('✗ btn-capture-photo element not found!');
    }
    
    // Show reset button (side by side)
    if (elements.btnResetRegistration) {
        elements.btnResetRegistration.style.display = 'block';
        
        // Re-attach listener if available
        if (window._faceRegHandlers && window._faceRegHandlers.onResetRegistration) {
            elements.btnResetRegistration.onclick = window._faceRegHandlers.onResetRegistration;
            console.log('✓ Reset button activated and listener attached');
        }
    } else {
        console.error('✗ btn-reset-registration element not found!');
    }
}

/**
 * Reset back to "Start Registration" mode (after error or restart)
 */
export function resetToStartMode() {

    if (elements.photoButtonContainer) {
        elements.photoButtonContainer.classList.add('full'); // <-- ADD THIS
    }

    if (elements.btnStartCapture) {
        elements.btnStartCapture.style.display = 'block';
        elements.btnStartCapture.disabled = false;
        elements.btnStartCapture.textContent = 'Start Face Registration';
    }
    
    if (elements.btnCapturePhoto) {
        elements.btnCapturePhoto.style.display = 'none';
    }
    
    if (elements.btnResetRegistration) {
        elements.btnResetRegistration.style.display = 'none';
    }
    
    // Clear photo thumbnails
    for (let i = 1; i <= 5; i++) {
        const photoElement = document.getElementById(`photo-${i}`);
        if (photoElement) {
            photoElement.innerHTML = '';
        }
    }
    
    // Clear messages
    if (elements.registrationMessage) {
        elements.registrationMessage.textContent = '';
    }
    
    if (elements.photoGuidance) {
        elements.photoGuidance.textContent = 'Ready to begin';
    }
}