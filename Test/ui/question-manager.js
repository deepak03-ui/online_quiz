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
        console.log(`Processing question ${index + 1}:`, mcq);

        // Validate required properties based on real Firestore schema
        if (!mcq.text) {
            console.error(`Question ${index + 1} missing text:`, mcq);
            throw new Error(`Question ${index + 1} has missing question text`);
        }

        if (!mcq.options || !Array.isArray(mcq.options)) {
            console.error(`Question ${index + 1} missing or invalid options:`, mcq);
            throw new Error(`Question ${index + 1} has missing or invalid options array`);
        }

        if (!mcq.answerKey) {
            console.error(`Question ${index + 1} missing answerKey:`, mcq);
            throw new Error(`Question ${index + 1} has missing answerKey`);
        }

        // Convert options array ['Opt1', 'Opt2'] to object {'A': 'Opt1', 'B': 'Opt2'}
        const optionsObject = mcq.options.reduce((obj, option, i) => {
            obj[String.fromCharCode(65 + i)] = option;
            return obj;
        }, {});

        console.log(`Options object for question ${index + 1}:`, optionsObject);

        // Find correct answer key by matching answerKey to options
        // answerKey is stored as trimmed lowercase string
        const correctAnswerKey = findCorrectAnswerKey(mcq.options, mcq.answerKey);
        console.log(`Correct answer key for question ${index + 1}:`, correctAnswerKey);

        // Shuffle options for display while keeping the original keys
        const displayOptions = Object.entries(optionsObject).sort(() => Math.random() - 0.5);
        console.log(`Display options for question ${index + 1}:`, displayOptions);

        const processedQuestion = {
            id: mcq.id || `q_${index + 1}`,
            questionText: mcq.text,
            options: optionsObject,
            correctAnswerKey: correctAnswerKey,
            displayOptions: displayOptions,
        };

        console.log(`Processed question ${index + 1}:`, processedQuestion);
        return processedQuestion;
    });

    console.log('All processed questions:', processedQuestions);

    // Final validation - ensure all questions have displayOptions
    for (let i = 0; i < processedQuestions.length; i++) {
        const q = processedQuestions[i];
        if (!q.displayOptions || !Array.isArray(q.displayOptions)) {
            console.error(`Processed question ${i + 1} missing displayOptions:`, q);
            throw new Error(`Processed question ${i + 1} missing displayOptions array`);
        }
        if (q.displayOptions.length === 0) {
            console.error(`Processed question ${i + 1} has empty displayOptions:`, q);
            throw new Error(`Processed question ${i + 1} has empty displayOptions array`);
        }
    }

    return processedQuestions;
}

/**
 * Find the correct answer key (A, B, C, D) by matching answerKey to options
 * @param {Array} options - Array of option strings
 * @param {string} answerKey - The correct answer as trimmed lowercase string
 * @returns {string} The answer key (A, B, C, or D)
 */
function findCorrectAnswerKey(options, answerKey) {
    for (let i = 0; i < options.length; i++) {
        const normalizedOption = options[i].toLowerCase().trim();
        if (normalizedOption === answerKey) {
            return String.fromCharCode(65 + i); // Convert index to A, B, C, D
        }
    }
    
    // [FIX] Do not default. Throw an error so the problem is found.
    console.error(`CRITICAL DATA ERROR: No matching option found for answerKey "${answerKey}" in options:`, options);
    throw new Error(`Invalid answerKey: "${answerKey}". Could not find a matching option.`);
}