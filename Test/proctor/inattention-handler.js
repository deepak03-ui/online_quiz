/**
 * inattention-handler.js - FIXED VERSION
 * FIXES:
 * 1. Calibration now ignores cooldown to complete properly
 * 2. Added grace period after warnings to prevent cascading
 * 3. Slower, more conservative baseline adaptation
 * 4. Better state management to prevent feedback loops
 */
import { ProctoringConfig } from './proctoring-config.js';

export class InattentionHandler {
  #callbacks;
  #baseline = null;
  #warningCount = 0;
  #lastWarningTime = 0;
  #badFrameCount = 0;
  #isCalibrated = false;
  #calibrationFrames = [];
  #graceFramesRemaining = 0; // NEW: Grace period after warning

  // Deterministic constants
  static CALIBRATION_FRAMES_REQUIRED = 30;
  static BAD_FRAMES_FOR_WARNING = 3;
  static GRACE_FRAMES_AFTER_WARNING = 15; // NEW: ~1.5 seconds at 10fps

  constructor(callbacks) {
    this.#callbacks = callbacks;
  }

  startCalibration() {
    this.#calibrationFrames = [];
    this.#baseline = null;
    this.#isCalibrated = false;
    this.#warningCount = 0;
    this.#badFrameCount = 0;
    this.#lastWarningTime = 0;
    this.#graceFramesRemaining = 0; // NEW: Reset grace period
    this.#callbacks.onNotify('info', 'Calibrating...');
  }

  check(calculations) {
    const pose = calculations.pose;
    const gaze = calculations.gaze;
    
    // Validate inputs
    if (!pose || !gaze || 
        typeof pose.yaw !== 'number' || 
        typeof pose.pitch !== 'number' || 
        typeof gaze.x !== 'number' || 
        typeof gaze.y !== 'number') {
      return;
    }

    // CALIBRATION PHASE - No cooldown check here
    if (!this.#isCalibrated) {
      this.#addCalibrationFrame(pose, gaze);
      return;
    }

    // ACTIVE PHASE - Apply cooldown BEFORE processing
    const now = Date.now();
    if (now - this.#lastWarningTime < ProctoringConfig.INATTENTION_WARNING_COOLDOWN_MS) {
      return; // Skip all processing during cooldown
    }

    // NEW: Grace period handling
    if (this.#graceFramesRemaining > 0) {
      this.#graceFramesRemaining--;
      // During grace period, update baseline but don't check violations
      this.#updateBaseline(pose, gaze);
      return;
    }

    this.#checkPosture(pose, gaze);
  }

  #addCalibrationFrame(pose, gaze) {
    this.#calibrationFrames.push({ 
      yaw: pose.yaw, 
      pitch: pose.pitch, 
      roll: pose.roll || 0, 
      gazeX: gaze.x, 
      gazeY: gaze.y 
    });
    
    if (this.#calibrationFrames.length >= InattentionHandler.CALIBRATION_FRAMES_REQUIRED) {
      this.#finishCalibration();
    }
  }

  #finishCalibration() {
    const frames = this.#calibrationFrames;
    const count = frames.length;
    
    this.#baseline = { 
      yaw: frames.reduce((sum, f) => sum + f.yaw, 0) / count, 
      pitch: frames.reduce((sum, f) => sum + f.pitch, 0) / count, 
      roll: frames.reduce((sum, f) => sum + f.roll, 0) / count, 
      gazeX: frames.reduce((sum, f) => sum + f.gazeX, 0) / count, 
      gazeY: frames.reduce((sum, f) => sum + f.gazeY, 0) / count 
    };
    
    this.#isCalibrated = true;
    this.#calibrationFrames = [];
    this.#callbacks.onNotify('success', 'Calibration complete');
  }
  
  #checkPosture(pose, gaze) {
    const yawDiff = Math.abs(pose.yaw - this.#baseline.yaw);
    const pitchDiff = Math.abs(pose.pitch - this.#baseline.pitch);
    const rollDiff = Math.abs((pose.roll || 0) - this.#baseline.roll);
    const gazeDiff = Math.sqrt(
      Math.pow(gaze.x - this.#baseline.gazeX, 2) + 
      Math.pow(gaze.y - this.#baseline.gazeY, 2)
    );

    const isBadPosture = 
      yawDiff > ProctoringConfig.INATTENTION_YAW_THRESHOLD || 
      pitchDiff > ProctoringConfig.INATTENTION_PITCH_THRESHOLD || 
      rollDiff > ProctoringConfig.INATTENTION_ROLL_THRESHOLD || 
      gazeDiff > ProctoringConfig.INATTENTION_GAZE_THRESHOLD;

    if (isBadPosture) {
      this.#badFrameCount++;
      if (this.#badFrameCount >= InattentionHandler.BAD_FRAMES_FOR_WARNING) {
        this.#triggerWarning();
        this.#badFrameCount = 0;
        this.#graceFramesRemaining = InattentionHandler.GRACE_FRAMES_AFTER_WARNING; // NEW
      }
    } else {
      // Good posture - reset counter and update baseline
      this.#badFrameCount = 0;
      this.#updateBaseline(pose, gaze);
    }
  }
  
  // MODIFIED: Slower, more conservative baseline adaptation
  #updateBaseline(pose, gaze) {
    // Use config value, but cap it to prevent too-fast adaptation
    const configAlpha = ProctoringConfig.BASELINE_SMOOTHING_FACTOR || 0.1;
    const alpha = Math.min(configAlpha, 0.05); // Cap at 5% per frame max
    const oneMinusAlpha = 1 - alpha;
    
    this.#baseline.yaw = (alpha * pose.yaw) + (oneMinusAlpha * this.#baseline.yaw);
    this.#baseline.pitch = (alpha * pose.pitch) + (oneMinusAlpha * this.#baseline.pitch);
    this.#baseline.roll = (alpha * (pose.roll || 0)) + (oneMinusAlpha * this.#baseline.roll);
    this.#baseline.gazeX = (alpha * gaze.x) + (oneMinusAlpha * this.#baseline.gazeX);
    this.#baseline.gazeY = (alpha * gaze.y) + (oneMinusAlpha * this.#baseline.gazeY);
  }

  #triggerWarning() {
    this.#warningCount++;
    this.#lastWarningTime = Date.now();

    const warningData = {
      type: 'inattention',
      message: `Please focus on the screen (Warning #${this.#warningCount})`,
      incrementsCounter: true
    };
    
    this.#callbacks.onWarning(warningData);
  }

  // Public API
  getWarningCount() { return this.#warningCount; }
  resetWarningCount() { this.#warningCount = 0; }
  getCurrentBaseline() { return this.#baseline ? { ...this.#baseline } : null; }
  resetCalibration() { this.startCalibration(); }
  isReady() { return this.#isCalibrated && this.#baseline !== null; }
}