/**
 * termination-handler.js - Clean, deterministic, strongly typed
 * REVISIONS:
 * 1. Renamed the `onDisplayWarning` callback to `onWarning` to standardize the API.
 * 2. Corrected a bug in `clearTimers` where the lastWarningTime was not being
 * reset, preventing new warnings from showing after a condition was resolved.
 */
import { ProctoringConfig } from './proctoring-config.js';

export class TerminationHandler {
  #callbacks;
  #noFaceTimer = null;
  #multiFaceTimer = null;
  #lastWarningTime = 0;
  #currentCondition = null;

  // Deterministic constants
  static WARNING_COOLDOWN_MS = 2000;

  constructor(callbacks) {
    this.#callbacks = callbacks; // Expects { onWarning, onTermination }
  }

  handleCondition(isMultiFace) {
    const condition = isMultiFace ? 'multi-face' : 'no-face';
    
    if (this.#currentCondition !== condition) {
      this.#currentCondition = condition;
      this.#showWarningIfCooledDown(condition);
      this.#startTimer(condition);
    }
  }

  #showWarningIfCooledDown(condition) {
    const now = Date.now();
    if (now - this.#lastWarningTime >= TerminationHandler.WARNING_COOLDOWN_MS) {
      const message = condition === 'multi-face' 
        ? 'Multiple faces detected. Only one person allowed.'
        : 'Face not detected. Please remain visible.';

      this.#callbacks.onWarning({
        type: 'face-detection',
        message: message,
        incrementsCounter: false // This correctly tells the main app NOT to count this warning.
      });

      this.#lastWarningTime = now;
    }
  }

  #startTimer(condition) {
    // No change needed here, as the condition check in handleCondition prevents re-entry.
    // The existing logic is sound.
    this.#clearAllTimers();

    if (condition === 'multi-face') {
      this.#multiFaceTimer = setTimeout(() => {
        this.#multiFaceTimer = null;
        this.#callbacks.onTermination('Multiple faces detected for too long.');
      }, ProctoringConfig.MULTI_FACE_TERMINATION_THRESHOLD);
    } else {
      this.#noFaceTimer = setTimeout(() => {
        this.#noFaceTimer = null;
        this.#callbacks.onTermination('Face not detected for too long.');
      }, ProctoringConfig.NO_FACE_TERMINATION_THRESHOLD);
    }
  }

  #clearAllTimers() {
    if (this.#noFaceTimer) {
      clearTimeout(this.#noFaceTimer);
      this.#noFaceTimer = null;
    }
    if (this.#multiFaceTimer) {
      clearTimeout(this.#multiFaceTimer);
      this.#multiFaceTimer = null;
    }
  }

  clearTimers() {
    this.#clearAllTimers();
    this.#currentCondition = null;
    // THE FIX: Reset the warning cooldown timestamp.
    // This ensures that if the user fixes the issue and immediately causes
    // it again, a new warning will be shown correctly.
    this.#lastWarningTime = 0;
  }
}

