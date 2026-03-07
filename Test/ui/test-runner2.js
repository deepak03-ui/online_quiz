// Filename: test-runner2.js
// MODIFIED TO RETURN A PROMISE WITH THE TEST RESULT

let state = {};
let services = {}; // Holds injected services like uiManager and timerManager

/**
 * Initializes and starts the test.
 * Now returns a Promise that resolves with the final test results.
 * @param {object} context - Contains test details, user info, and questions.
 * @param {object} injectedServices - Contains dependencies like uiManager and timerManager.
 * @returns {Promise<object>} A promise that resolves with the test result object.
 */
export function startTest(context, injectedServices) {
    // --- CHANGE #1: Return a new Promise ---
    return new Promise((resolve, reject) => {
        services = injectedServices; // Store the provided services

        try {
            // 1. Reset the test state, now passing the promise's resolve function
            resetState(context.details, context.user, context.questions, resolve);
            
            // 2. Attach UI event listeners
            attachEventListeners();
            
            // 3. Initialize the timer
            services.timerManager.initTimer({
                element: services.uiManager.getTimerElement(),
                onTimeUp: handleTimeUp
            });
            
            if (state.questions.length === 0) {
                throw new Error("No questions were provided for this test.");
            }

            // 4. Show the main test screen and render the first question
            services.uiManager.showTestScreen(state.testDetails.title);
            renderCurrentQuestion();
            startQuestionTimer();

        } catch (error) {
            console.error("Failed to initialize test:", error);
            reject(error); // Reject the promise if initialization fails
        }
    });
}

/**
 * Finalizes the test, calculates the score, and resolves the main promise.
 */
function submitTest() {
    if (state.testIsOver) return;
    state.testIsOver = true;
    
    services.timerManager.stop();
    services.uiManager.setSubmittingState(true);

    let correctAnswers = 0;
    for (const question of state.questions) {
        // This logic assumes `question.correctAnswerKey` is populated correctly.
        if (state.userAnswers[question.id] === question.correctAnswerKey) {
            correctAnswers++;
        }
    }
    
    console.log("--- TEST COMPLETE & RETURNING RESULT ---");
    console.log("Final Score:", `${correctAnswers} / ${state.questions.length}`);
    
    // --- CHANGE #3: Resolve the promise instead of showing the results UI ---
    // Create the result object in the exact format main7.js expects
    const result = {
        score: {
            correct: correctAnswers,
            total: state.questions.length
        }
    };
    
    // Resolve the promise, sending the result back to main7.js
    if (state.resolveTestPromise) {
        state.resolveTestPromise(result);
    }
    
    // DO NOT call showResults here anymore. main7.js will handle the final screen.
    // services.uiManager.showResults(score, state.questions.length);
}

// --- CHANGE #2: Modify resetState to store the resolve function ---
function resetState(testDetails, user, preparedQuestions, resolve) {
    state = {
        user, 
        testDetails,
        questions: preparedQuestions,
        userAnswers: {},
        currentQuestionIndex: 0,
        testIsOver: false,
        resolveTestPromise: resolve, // Store the resolve function to be called on submit
    };
}

// --- NO CHANGES BELOW THIS LINE ---

function renderCurrentQuestion() {
    const question = state.questions[state.currentQuestionIndex];
    const stateSnapshot = {
        currentIndex: state.currentQuestionIndex,
        totalQuestions: state.questions.length,
        userAnswers: state.userAnswers
    };
    services.uiManager.renderQuestion(question, stateSnapshot);
}

function startQuestionTimer() {
    // FIX: Changed from 'timePerQuestionSeconds' to 'timePerQuestion'
    // and wrapped with Number() to ensure it's not a string.
    const time = Number(state.testDetails.timePerQuestion);
    services.timerManager.start(time);
}

function handleTimeUp() {
    if (state.currentQuestionIndex < state.questions.length - 1) {
        handleNextQuestion();
    } else {
        submitTest();
    }
}

function handleNextQuestion() {
    if (state.testIsOver) return;
    if (state.currentQuestionIndex < state.questions.length - 1) {
        state.currentQuestionIndex++;
        renderCurrentQuestion();
        startQuestionTimer();
    } else {
        submitTest();
    }
}

function attachEventListeners() {
    const uiElements = services.uiManager.uiElements;
    if (!uiElements) {
        throw new Error("UI elements not found in uiManager. Ensure uiManager is initialized.");
    }
    uiElements.nextQuestionBtn.onclick = handleNextQuestion;
    uiElements.backToDashboardBtn.onclick = () => window.location.reload(); // This screen is not used, but we'll leave it
    uiElements.optionsContainer.addEventListener('change', (e) => {
        if (e.target.name === 'question-options') {
            const question = state.questions[state.currentQuestionIndex];
            state.userAnswers[question.id] = e.target.value;
        }
    });

    // --- REMOVED ---
    // The 'beforeunload' event listener block has been deleted
    // to prevent conflicts with the main app's terminate() function.
    // --- END REMOVED ---
}