export const TRANSITION_MS = 400;
export const TRANSITION_EASE = "cubic-bezier(0.42, 0, 0.58, 1.0)";

/**
 * The "after" (below-the-fold) week rows only need to travel a short
 * distance to clear the viewport, so with TRANSITION_MS + the ease-out curve
 * above they finish that visible portion of the trip almost instantly. Give
 * their exit its own, longer duration so the motion actually reads.
 */
export const TRANSITION_MS_AFTER_EXIT = 400;
