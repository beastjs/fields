/** Total tries for one request, counting the user's own message as the first. */
export const MAX_ATTEMPTS = 5;

// Failures the model cannot fix by answering again: nothing to edit, nothing left to change,
// or the user cancelled.
const terminal = [/No file was attached/, /already in the file/, /Verification cancelled/];

/**
 * The follow-up that feeds a failed change back to the model, or undefined when no further
 * attempt should run. `attempt` is the attempt that just failed.
 */
export function fixUpPrompt(error: string, file: string, attempt: number) {
  if (attempt >= MAX_ATTEMPTS || terminal.some(pattern => pattern.test(error))) return;
  return `Your change to ${file} was not applied (attempt ${attempt} of ${MAX_ATTEMPTS}). The playground reported:
${error.trim()}

The attached file is its current contents; nothing from your last reply was applied. Fix the cause above and reply with one corrected patch for ${file} whose SEARCH lines are copied exactly from the attached file and whose result compiles with no errors.`;
}
