/* Bottom-sheet móvil — lógica pura (testeable en node, sin DOM). */
export const SHEET_STATES = ["peek", "half", "full"];

/** Cicla peek→half→full→peek. */
export function nextSheetState(cur) {
  const i = SHEET_STATES.indexOf(cur);
  return SHEET_STATES[(i + 1) % SHEET_STATES.length];
}
