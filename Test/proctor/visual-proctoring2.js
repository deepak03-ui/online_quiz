/**
 * visual-proctoring.js - CORRECTED CALLBACK CHAIN
 * This version fixes a critical bug where the main callbacks were not passed
 * to the sub-handlers (Inattention, Termination) correctly.
 */
import { ProctoringCameraLogic } from './proctoring-camera-logic.js';
import { TerminationHandler } from './termination-handler.js';
import { InattentionHandler } from './inattention-handler.js';

export class VisualProctor {
  #cameraLogic;
  #terminationHandler;
  #inattentionHandler;
  #callbacks;
  #isRunning = false;

  // FIXED: Constructor now accepts callbacks to establish the event chain immediately.
  constructor(cameraLogic, callbacks) {
    this.#cameraLogic = cameraLogic;
    this.#callbacks = callbacks; // Assign callbacks right away.
    this.#setupHandlers();   // THEN, set up the handlers that depend on them.
  }

  // FIXED: The create method now accepts and passes on the callbacks.
  static async create(callbacks) {
    const cameraLogic = await ProctoringCameraLogic.create();
    return new VisualProctor(cameraLogic, callbacks);
  }

  #setupHandlers() {
    // This section now works perfectly because this.#callbacks is guaranteed to be defined.
    this.#terminationHandler = new TerminationHandler({
      onWarning: this.#callbacks.onWarning,
      onTermination: this.#callbacks.onTermination
    });

    this.#inattentionHandler = new InattentionHandler({
      onWarning: this.#callbacks.onWarning,
      onNotify: this.#callbacks.onStatus || (() => {})
    });
  }

  async start(videoElement) {
    if (this.#isRunning) return;
    this.#isRunning = true;
    this.#inattentionHandler.startCalibration();
    await this.#cameraLogic.start(videoElement, this.#handleCameraData);
  }

  stop() {
    if (!this.#isRunning) return;
    this.#isRunning = false;
    this.#cameraLogic.stop();
    this.#terminationHandler.clearTimers();
  }

  #handleCameraData = (data) => {
    if (!this.#isRunning) return;
    const faceCount = data.results?.faceLandmarks?.length || 0;
    if (faceCount !== 1) {
      this.#terminationHandler.handleCondition(faceCount > 1);
      return;
    }
    this.#terminationHandler.clearTimers();
    if (data.calculations?.pose && data.calculations?.gaze) {
      this.#inattentionHandler.check(data.calculations);
    }
  };
}

