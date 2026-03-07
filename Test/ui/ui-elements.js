// ui/ui-elements.js - Updated to map to existing HTML structure

export const UIElements = {
    // Pre-test elements
    preTestBox: document.querySelector('.pre-test-box'),
    startTestBtn: document.getElementById('final-start-test-btn'),
    
    // App container
    appContainer: document.getElementById('app-container'),
    
    // Proctoring elements  
    proctoringVideo: document.getElementById('proctoring-video'),
    proctorAlert: document.getElementById('proctor-alert'),
    proctorAlertMessage: document.getElementById('proctor-alert-message'),
    warningCountDisplay: document.getElementById('warning-count-display'),
    
    // Termination screen
    terminationScreen: document.getElementById('termination-screen'),
    terminationTitle: document.getElementById('termination-title'),
    terminationReason: document.getElementById('termination-reason'),
    
    // Test elements (for when test is running)
    testHeader: document.querySelector('.test-header'),
    testTimer: document.getElementById('test-timer'),
    questionProgress: document.getElementById('question-progress'),
    questionArea: document.getElementById('question-area'),
    questionText: document.getElementById('question-text'),
    optionsContainer: document.getElementById('options-container'),
    nextQuestionBtn: document.getElementById('next-question-btn'),
    testResultsView: document.getElementById('test-results-view')
};