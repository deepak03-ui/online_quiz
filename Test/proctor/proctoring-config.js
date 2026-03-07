// proctoring-config.js - Proper thresholds with roll detection added

export const ProctoringConfig = {
  // --- Inattention Detection ---
  // FIXED: Balanced thresholds based on your updated values
  INATTENTION_YAW_THRESHOLD: 5,   // degrees - matches your requirement
  INATTENTION_PITCH_THRESHOLD: 5, // degrees - matches your requirement  
  INATTENTION_ROLL_THRESHOLD: 10,  // degrees - added for head tilt detection
  INATTENTION_GAZE_THRESHOLD: 0.2, // (0-1 scale) - gaze deviation from center
  BASELINE_SMOOTHING_FACTOR: 0.03, // 3% influence from the new frame, 977% from the old baseline
  
  // FIXED: Longer cooldown to prevent spam after streak detection
  INATTENTION_WARNING_COOLDOWN_MS: 2000, // 2 seconds - longer since we use streaks
  
  // --- Environmental thresholds (from your reference) ---
  BRIGHTNESS_THRESHOLD: 50,  // Minimum brightness level
  CONTRAST_THRESHOLD: 25,    // Minimum contrast level

  BRIGHTNESS_MIN: 50,
  BRIGHTNESS_MAX: 220,
  CONTRAST_MIN: 30,
  
  // --- Termination Settings ---
  NO_FACE_TERMINATION_THRESHOLD: 2000, // 2 seconds
  MULTI_FACE_TERMINATION_THRESHOLD: 2000, // 2 seconds
};

export default ProctoringConfig;