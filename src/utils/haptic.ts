/**
 * Simple Vibration API Helper - completely disabled as requested to prevent unhelpful haptics.
 */
export const triggerHaptic = (pattern: number | number[]) => {
  // Disabled as per user request to remove unhelpful vibrations
};

export const hapticFeedback = {
  light: () => {},
  medium: () => {},
  success: () => {},
  error: () => {},
  longError: () => {},
  searchSuccess: () => {},
};

export const playTargetLockSound = () => {
  // Disabled as per user request to remove unhelpful target lock audio sweeps
};

