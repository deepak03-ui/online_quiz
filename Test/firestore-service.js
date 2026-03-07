/**
 * firestore-service.js
 * A dedicated service for all Firestore interactions.
 */

// [FIX] Import the initializer function, not the config object.
import { initializeFirebase } from '../firebase-config.js';

import { 
  doc, 
  getDoc, 
  setDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

// --- Firebase Initialization ---
// [FIX] Get the already-initialized instances from the central config file.
const { db, auth } = initializeFirebase();

// --- Exported Functions ---

/**
 * Provides the initialized Auth instance to other modules.
 * This function no longer needs to be async as initialization is now synchronous.
 * @returns {object} The Auth instance.
 */
export function getAuthInstance() {
    return auth;
}

// --- Face Recognition Data Handling ---

export async function uploadDescriptors(userEmail, dataToUpdate) {
    const userRef = doc(db, 'users', userEmail);
    await updateDoc(userRef, dataToUpdate);
}

export async function fetchDescriptors(userEmail) {
    // --- [NEW] Check session storage first ---
    try {
        // Based on your log, the key is likely 'studentProfile'
        const profileJSON = sessionStorage.getItem('studentProfile');
        if (profileJSON) {
            const profile = JSON.parse(profileJSON);
            
            // Check if the profile is valid, matches the user, and has the data
            if (profile && profile.email === userEmail && profile.faceModel) {
                console.log("Loaded face descriptors from session storage.");
                return profile.faceModel;
            }
        }
    } catch (error) {
        console.warn("Could not parse student profile from session storage, fetching from DB.", error);
    }
    // --- [END NEW] ---

    // --- Fallback to Firestore if session check fails ---
    console.log(`No session data found for ${userEmail}, fetching from Firestore...`);
    const userRef = doc(db, 'users', userEmail);
    const docSnap = await getDoc(userRef);
    if (docSnap.exists() && docSnap.data().faceModel) {
        console.log("Loaded face descriptors from Firestore.");
        return docSnap.data().faceModel;
    }
    
    console.warn(`No face descriptors found in Firestore for ${userEmail}.`);
    return null;
}
// --- Test Data and Results Handling ---

export function getTestConfigFromSession() {
    const configJSON = sessionStorage.getItem('currentTestConfig');
    if (!configJSON) throw new Error("Could not find test configuration in session.");
    try {
        const config = JSON.parse(configJSON);
        if (!config.id) throw new Error("Test configuration is invalid (missing ID).");
        return { testId: config.id, config };
    } catch (error) {
        throw new Error("Invalid test data format in session.");
    }
}

export async function fetchTestAndQuestions(testId, testConfig) {
  try {
    const questionCount = parseInt(testConfig.questionCount, 10);
    const questionsToAttend = parseInt(testConfig.questionsToAttend, 10);
    if (isNaN(questionCount) || isNaN(questionsToAttend)) {
        throw new Error("Invalid question counts in test config.");
    }
    const allQuestionNumbers = Array.from({ length: questionCount }, (_, i) => i + 1);
    const questionNumbersToFetch = questionsToAttend >= questionCount
        ? allQuestionNumbers
        : shuffleArray(allQuestionNumbers).slice(0, questionsToAttend);
    
    const questions = await fetchQuestions(db, testId, questionNumbersToFetch);
    if (questions.length === 0) throw new Error("No questions could be loaded.");
    
    return {
      details: { ...testConfig, id: testId, questionsToSelect: questions.length },
      questions
    };
  } catch (error) {
    console.error(`Error fetching questions for test "${testId}":`, error);
    throw error;
  }
}

export async function submitInitialTestState(data) {
  try {
    const { testDetails, userData } = data;
    const docId = `${testDetails.id}_${userData.email}`;
    const testResultRef = doc(db, 'scores', docId);
    const initialPayload = {
      testId: testDetails.id,
      testName: testDetails.title,
      subjectCode: testDetails.subjectCode || 'N/A',
      userId: userData.email,
      studentName: userData.name,
      email: userData.email,
      department: userData.department,
      year: userData.year,
      section: userData.section,
      status: 'not finished',
      timeCreated: new Date().toISOString()
    };
    await setDoc(testResultRef, initialPayload);
  } catch (error) {
    console.error('Error recording initial test state:', error);
  }
}

export async function submitTestResults(resultData) {
  try {
    const { testDetails, userData, score } = resultData;
    if (!score || typeof score.correct !== 'number' || typeof score.total !== 'number') {
        throw new Error("Invalid score object provided.");
    }
    const docId = `${testDetails.id}_${userData.email}`;
    const testResultRef = doc(db, 'scores', docId);
    const percentage = score.total > 0 ? (score.correct / score.total) * 100 : 0;
    const finalPayload = {
      rawScore: score.correct,
      totalMarks: score.total,
      score: percentage.toFixed(2),
      status: 'completed',
      timeCompleted: new Date().toISOString()
    };
    await updateDoc(testResultRef, finalPayload);
  } catch (error) {
    console.error('Failed to submit final test results:', error);
    throw error;
  }
}

function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

async function fetchQuestions(database, testId, questionNumbers) {
  const questionPromises = questionNumbers.map(async (qNum) => {
    try {
      const qRef = doc(database, 'tests', testId, 'questions', String(qNum));
      const qDoc = await getDoc(qRef);
      return qDoc.exists() ? { id: qDoc.id, ...qDoc.data() } : null;
    } catch (error) {
      console.error(`Failed to fetch question ${qNum} for test ${testId}:`, error);
      return null;
    }
  });
  const questions = await Promise.all(questionPromises);
  return questions.filter(Boolean);
}