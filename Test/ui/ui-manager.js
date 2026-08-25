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
    dom.optionsContainer.innerHTML = '';

    const isMatchQuestion =
    question.type === 'match' ||
    (Array.isArray(question.leftItems) && question.rightOptions);

    if (isMatchQuestion) {
    const userMap = userAnswers[question.id] || {};
    const leftItems = Array.isArray(question.leftItems) ? question.leftItems : [];
    const rightOptions = question.rightOptions || {};

    const matchWrapper = document.createElement('div');
    matchWrapper.className = 'match-wrapper';

    const title = document.createElement('h3');
    title.textContent = 'Match the Following';
    title.style.marginBottom = '12px';
    matchWrapper.appendChild(title);

    const note = document.createElement('div');
    note.textContent = `1 mark for each correct pair`;
    note.style.marginBottom = '16px';
    note.style.fontSize = '14px';
    note.style.color = '#666';
    matchWrapper.appendChild(note);

    const columnsContainer = document.createElement('div');
    columnsContainer.style.display = 'grid';
    columnsContainer.style.gridTemplateColumns = '1fr 1fr';
    columnsContainer.style.gap = '24px';
    columnsContainer.style.marginBottom = '20px';

    const columnA = document.createElement('div');
    const columnB = document.createElement('div');

    const colATitle = document.createElement('h4');
    colATitle.textContent = 'Column A';
    columnA.appendChild(colATitle);

    const colBTitle = document.createElement('h4');
    colBTitle.textContent = 'Column B';
    columnB.appendChild(colBTitle);

    leftItems.forEach((leftItem, index) => {
        const row = document.createElement('div');
        row.textContent = `${index + 1}. ${leftItem}`;
        row.style.marginBottom = '8px';
        columnA.appendChild(row);
    });

    Object.entries(rightOptions).forEach(([letter, value]) => {
        const row = document.createElement('div');
        row.textContent = `${letter}. ${value}`;
        row.style.marginBottom = '8px';
        columnB.appendChild(row);
    });

    columnsContainer.appendChild(columnA);
    columnsContainer.appendChild(columnB);
    matchWrapper.appendChild(columnsContainer);

    const answerTitle = document.createElement('h4');
    answerTitle.textContent = 'Your Answers';
    answerTitle.style.marginBottom = '12px';
    matchWrapper.appendChild(answerTitle);

    const selectedLetters = Object.values(userMap).filter(Boolean);

    leftItems.forEach((leftItem, index) => {
        const row = document.createElement('div');
        row.className = 'match-answer-row';
        row.style.display = 'flex';
        row.style.alignItems = 'center';
        row.style.gap = '12px';
        row.style.marginBottom = '12px';

        const leftLabel = document.createElement('span');
        leftLabel.textContent = `${index + 1} →`;
        leftLabel.style.width = '40px';

        const select = document.createElement('select');
        select.className = 'match-dropdown';
        select.name = 'match-options';
        select.dataset.left = leftItem;
        select.style.minWidth = '120px';

        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Select';
        select.appendChild(defaultOption);

        Object.keys(rightOptions).forEach((letter) => {
            const currentSelected = userMap[leftItem];
            const alreadyUsedElsewhere =
                selectedLetters.includes(letter) && currentSelected !== letter;

            if (!alreadyUsedElsewhere) {
                const option = document.createElement('option');
                option.value = letter;
                option.textContent = letter;

                if (currentSelected === letter) {
                    option.selected = true;
                }

                select.appendChild(option);
            }
        });

        row.appendChild(leftLabel);
        row.appendChild(select);
        matchWrapper.appendChild(row);
    });

    dom.optionsContainer.appendChild(matchWrapper);

    const isLastQuestion = currentIndex === totalQuestions - 1;
    const nextBtn = dom.nextQuestionBtn;

    if (isLastQuestion) {
        nextBtn.textContent = 'Submit';
        nextBtn.classList.remove('btn-primary');
        nextBtn.classList.add('btn-success');
    } else {
        nextBtn.textContent = 'Next';
        nextBtn.classList.remove('btn-success');
        nextBtn.classList.add('btn-primary');
    }

    nextBtn.disabled = false;
    return;
}

    if (!Array.isArray(question.displayOptions)) {
        throw new Error('displayOptions missing for non-match question');
    }

    question.displayOptions.forEach(([key, text], index) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'option-wrapper';

        const input = document.createElement('input');
        input.type = 'radio';
        input.id = `option${index}`;
        input.name = 'question-options';
        input.value = key;

        if (userAnswers[question.id] === key) {
            input.checked = true;
        }

        const label = document.createElement('label');
        label.htmlFor = `option${index}`;
        label.className = 'option-label';

        const optionNumber = document.createElement('span');
        optionNumber.className = 'option-number';
        optionNumber.textContent = String.fromCharCode(65 + index);

        const optionText = document.createElement('span');
        optionText.className = 'option-text';
        optionText.textContent = text;

        label.appendChild(optionNumber);
        label.appendChild(optionText);
        wrapper.appendChild(input);
        wrapper.appendChild(label);
        dom.optionsContainer.appendChild(wrapper);
    });

    const isLastQuestion = currentIndex === totalQuestions - 1;
    const nextBtn = dom.nextQuestionBtn;

    if (isLastQuestion) {
        nextBtn.textContent = 'Submit';
        nextBtn.classList.remove('btn-primary');
        nextBtn.classList.add('btn-success');
    } else {
        nextBtn.textContent = 'Next';
        nextBtn.classList.remove('btn-success');
        nextBtn.classList.add('btn-primary');
    }

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