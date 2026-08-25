// Filename: question-manager.js

/**
 * Processes raw MCQs from Firestore with the correct schema, shuffles them, selects a subset, 
 * and transforms them into the format required by the application.
 * @param {Array} mcqs - The array of question objects from Firestore.
 * @param {number} amountToSelect - The number of questions to randomly select for the test.
 * @returns {Promise<Array>} A promise that resolves to the array of processed and shuffled questions.
 */
export async function prepareQuestions(mcqs, amountToSelect) {
    if (!mcqs || mcqs.length === 0) {
        console.warn('No questions provided to prepareQuestions');
        return [];
    }

    console.log('Raw MCQs received:', mcqs);
    console.log('Amount to select:', amountToSelect);

    const shuffledMcqs = [...mcqs].sort(() => Math.random() - 0.5);
    const selectedMcqs = shuffledMcqs.slice(0, amountToSelect);

    console.log('Selected MCQs for processing:', selectedMcqs);

const processedQuestions = selectedMcqs.map((mcq, index) => {

    if (!mcq.text) {
        throw new Error(`Question ${index + 1} missing text`);
    }

    const questionType = (mcq.type || '').toLowerCase();

    // =========================
    // ✅ MCQ / TF HANDLING
    // =========================
    if (questionType === 'mcq' || questionType === 'tf') {

        if (!mcq.options || !Array.isArray(mcq.options)) {
            throw new Error(`Question ${index + 1} missing options`);
        }

        if (!mcq.answerKey) {
            throw new Error(`Question ${index + 1} missing answerKey`);
        }

        const optionsObject = mcq.options.reduce((obj, option, i) => {
            obj[String.fromCharCode(65 + i)] = option;
            return obj;
        }, {});

        const normalizedAnswer = String(mcq.answerKey).toLowerCase().trim();
        const correctAnswerKey = findCorrectAnswerKey(mcq.options, normalizedAnswer);

        const displayOptions = Object.entries(optionsObject).sort(() => Math.random() - 0.5);

        return {
            id: mcq.id || `q_${index + 1}`,
            type: questionType,
            questionText: mcq.text,
            options: optionsObject,
            correctAnswerKey: correctAnswerKey,
            displayOptions: displayOptions,
            marks: mcq.marks || 1
        };
    }

    // =========================
    // ✅ MATCH HANDLING (NEW)
    // =========================
   if (questionType === 'match') {
    if (!Array.isArray(mcq.leftItems) || mcq.leftItems.length === 0) {
        throw new Error(`Match question ${index + 1} missing leftItems`);
    }

    if (!Array.isArray(mcq.rightItems) || mcq.rightItems.length === 0) {
        throw new Error(`Match question ${index + 1} missing rightItems`);
    }

    if (!mcq.correctMapping || typeof mcq.correctMapping !== 'object') {
        throw new Error(`Match question ${index + 1} missing correctMapping`);
    }

    const shuffledRightItems = [...mcq.rightItems].sort(() => Math.random() - 0.5);

    const rightOptions = {};
    shuffledRightItems.forEach((item, i) => {
        const letter = String.fromCharCode(65 + i); // A, B, C...
        rightOptions[letter] = item;
    });

    const correctAnswerKey = {};
    mcq.leftItems.forEach((leftItem) => {
        const correctRightText = mcq.correctMapping[leftItem];
        const matchedLetter = Object.keys(rightOptions).find(
            letter => rightOptions[letter] === correctRightText
        );

        if (matchedLetter) {
            correctAnswerKey[leftItem] = matchedLetter;
        }
    });

    return {
        id: mcq.id || `q_${index + 1}`,
        type: 'match',
        questionText: mcq.text,
        leftItems: mcq.leftItems,
        rightOptions: rightOptions,
        correctAnswerKey: correctAnswerKey,
        marks: mcq.marks || 0,
        marksPerPair: mcq.marksPerPair || 1,
        totalPairs: mcq.totalPairs || mcq.leftItems.length
    };
}

    // =========================
    // ❌ UNKNOWN TYPE
    // =========================
    throw new Error(`Unsupported question type: ${questionType}`);
});

    console.log('All processed questions:', processedQuestions);

    // Final validation - ensure all questions have displayOptions
    for (let i = 0; i < processedQuestions.length; i++) {
    const q = processedQuestions[i];

   if (q.type === 'match') {
    if (!q.leftItems || !Array.isArray(q.leftItems) || q.leftItems.length === 0) {
        console.error(`Processed match question ${i + 1} missing leftItems:`, q);
        throw new Error(`Processed match question ${i + 1} missing leftItems`);
    }

    if (!q.rightOptions || typeof q.rightOptions !== 'object' || Object.keys(q.rightOptions).length === 0) {
        console.error(`Processed match question ${i + 1} missing rightOptions:`, q);
        throw new Error(`Processed match question ${i + 1} missing rightOptions`);
    }

    if (!q.correctAnswerKey || typeof q.correctAnswerKey !== 'object') {
        console.error(`Processed match question ${i + 1} missing correctAnswerKey:`, q);
        throw new Error(`Processed match question ${i + 1} missing correctAnswerKey`);
    }

    continue;
}

    if (!q.displayOptions || !Array.isArray(q.displayOptions)) {
        console.error(`Processed question ${i + 1} missing displayOptions:`, q);chrome
        throw new Error(`Processed question ${i + 1} missing displayOptions array`);
    }

    if (q.displayOptions.length === 0) {
        console.error(`Processed question ${i + 1} has empty displayOptions:`, q);
        throw new Error(`Processed question ${i + 1} has empty displayOptions array`);
    }
}

    return processedQuestions;
}
function evaluateMatch(question, studentAnswer) {
    let score = 0;

    Object.keys(question.correctMapping).forEach(left => {
        if (studentAnswer[left] === question.correctMapping[left]) {
            score += question.marksPerPair;
        }
    });

    return score;
}
/**
 * Find the correct answer key (A, B, C, D) by matching answerKey to options
 * @param {Array} options - Array of option strings
 * @param {string} answerKey - The correct answer as trimmed lowercase string
 * @returns {string} The answer key (A, B, C, or D)
 */
function findCorrectAnswerKey(options, answerKey) {
    const normalizedAnswer = String(answerKey).toLowerCase().trim();

    for (let i = 0; i < options.length; i++) {
        const normalizedOption = String(options[i]).toLowerCase().trim();

        if (normalizedOption === normalizedAnswer) {
            return String.fromCharCode(65 + i); // A, B, C, D
        }
    }

    // ✅ SPECIAL HANDLING FOR TF (fallback safety)
    if (normalizedAnswer === 'true' || normalizedAnswer === 'false') {
        console.warn('TF fallback triggered. Options:', options, 'Answer:', normalizedAnswer);

        for (let i = 0; i < options.length; i++) {
            const opt = String(options[i]).toLowerCase();
            if (opt.includes(normalizedAnswer)) {
                return String.fromCharCode(65 + i);
            }
        }
    }

    console.error(`CRITICAL DATA ERROR: No matching option found for answerKey "${answerKey}"`, options);
    throw new Error(`Invalid answerKey: "${answerKey}". Could not find a matching option.`);
}