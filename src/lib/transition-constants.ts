export const TRANSITION_MS = 500;
export const TRANSITION_EASE = "cubic-bezier(0.22, 0.51, 0.00, 1.00)";

/**
 * The "after" (below-the-fold) week rows only need to travel a short
 * distance to clear the viewport, so with TRANSITION_MS + the ease-out curve
 * above they finish that visible portion of the trip almost instantly. Give
 * their exit its own, longer duration so the motion actually reads.
 */
export const TRANSITION_MS_AFTER_EXIT = 800;
