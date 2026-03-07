// Filename: ui-manager.js

// Caching all DOM elements for performance
const dom = {
    testRunnerView: document.getElementById('test-runner-view'),
    testTitleEl: document.getElementById('test-runner-title'),
    testTimerEl: document.getElementById('test-timer'),
    questionArea: document.getElementById('question-area'),
    questionTextEl: document.getElementById('question-text'),
    questionProgressEl: document.getElementById('question-progress'),
    optionsContainer: document.getElementById('options-container'),
    nextQuestionBtn: document.getElementById('next-question-btn'),
    resultsView: document.getElementById('test-results-view'),
    finalScoreEl: document.getElementById('final-score'),
    totalQuestionsEl: document.getElementById('total-questions'),
    backToDashboardBtn: document.getElementById('back-to-dashboard-btn'),
    preTestOverlay: document.getElementById('pre-test-overlay'),
    preTestTitleEl: document.getElementById('pre-test-title'),
    finalStartBtn: document.getElementById('final-start-test-btn'),
    testHeader: document.querySelector('.test-header'),
};

/**
 * Configures the initial pre-test screen and attaches the callback to the start button.
 * @param {string} title - The title of the test.
 * @param {Function} startCallback - The function to call when the start button is clicked.
 */
export function setupPreTestScreen(title, startCallback) {
    dom.preTestOverlay.style.display = 'flex';
    dom.testHeader.style.display = 'none';
    dom.questionArea.style.display = 'none';
    dom.resultsView.style.display = 'none';
    dom.submitTestBtn.style.display = 'none';
    dom.preTestTitleEl.textContent = title;
    dom.finalStartBtn.onclick = startCallback;
}

/**
 * Transitions the UI from the pre-test screen to the active test screen.
 * @param {string} title - The title of the test.
 */
export function showTestScreen(title) {
    dom.preTestOverlay.style.display = 'none';
    dom.testHeader.style.display = 'flex';
    dom.questionArea.style.display = 'block';
    dom.testTitleEl.textContent = title;
}

/**
 * Renders a single question and its options.
 * @param {object} question - The question object.
 * @param {object} stateSnapshot - A snapshot of the current state (currentIndex, total, userAnswers).
 */
export function renderQuestion(question, { currentIndex, totalQuestions, userAnswers }) {
    if (!question) return;

    dom.questionTextEl.textContent = question.questionText;
    dom.questionProgressEl.textContent = `Question ${currentIndex + 1} of ${totalQuestions}`;
    
    // 1. Clear the container before adding new elements
    dom.optionsContainer.innerHTML = '';

    // 2. Build and append elements using DOM methods (no .innerHTML injection)
    question.displayOptions.forEach(([key, text], index) => {
        
        // Create <div class="option-wrapper">
        const wrapper = document.createElement('div');
        wrapper.className = 'option-wrapper';

        // Create <input type="radio" ...>
        const input = document.createElement('input');
        input.type = 'radio';
        input.id = `option${index}`;
        input.name = 'question-options';
        input.value = key;
        
        // Set the 'checked' property directly
        if (userAnswers[question.id] === key) {
            input.checked = true;
        }

        // Create <label for="..." class="option-label">
        const label = document.createElement('label');
        label.htmlFor = `option${index}`;
        label.className = 'option-label';

        // Create <span class="option-number">
        const optionNumber = document.createElement('span');
        optionNumber.className = 'option-number';
        optionNumber.textContent = String.fromCharCode(65 + index); // A, B, C...

        // Create <span class="option-text">
        const optionText = document.createElement('span');
        optionText.className = 'option-text';
        optionText.textContent = text;

        // 3. Assemble the elements
        label.appendChild(optionNumber);
        label.appendChild(optionText);
        wrapper.appendChild(input);
        wrapper.appendChild(label);

        // 4. Add the complete wrapper to the container
        dom.optionsContainer.appendChild(wrapper);
    });
    
    dom.nextQuestionBtn.disabled = currentIndex === totalQuestions - 1;
    // Check if it's the last question
    const isLastQuestion = currentIndex === totalQuestions - 1;
    const nextBtn = dom.nextQuestionBtn;

    // Transform the button based on the state
    if (isLastQuestion) {
        nextBtn.textContent = 'Submit';
        nextBtn.classList.remove('btn-primary'); // Remove blue color
        nextBtn.classList.add('btn-success');   // Add green color
    } else {
        nextBtn.textContent = 'Next';
        nextBtn.classList.remove('btn-success'); // Remove green color
        nextBtn.classList.add('btn-primary');   // Add blue color
    }

    // Ensure the button is always enabled when a question is rendered
    nextBtn.disabled = false;
}

/** Displays the final results screen. */
export function showResults(score, total) {
    dom.questionArea.style.display = 'none';
    dom.testHeader.style.display = 'none';
    // ADDED: Explicitly hide the submit button, as it's no longer inside the question area.
    dom.submitTestBtn.style.display = 'none';
    dom.resultsView.style.display = 'block';
    dom.finalScoreEl.textContent = score;
    dom.totalQuestionsEl.textContent = total;
}

// --- REMOVED ---
// The 'showViolationScreen' function has been deleted.
// All violations must now be handled by the main app's
// unified terminate() function.
// --- END REMOVED ---

/** Puts the UI into a submitting state. */
export function setSubmittingState(isSubmitting) {
    dom.nextQuestionBtn.disabled = isSubmitting;
    if (isSubmitting) {
        dom.nextQuestionBtn.textContent = 'Submitting...';
    }
}
/** Returns a reference to the timer element for the timer manager. */
export function getTimerElement() {
    return dom.testTimerEl;
}

// Exporting DOM elements for event listener attachment in the main logic file.
export const uiElements = {
    nextQuestionBtn: dom.nextQuestionBtn,
    backToDashboardBtn: dom.backToDashboardBtn,
    optionsContainer: dom.optionsContainer,
};