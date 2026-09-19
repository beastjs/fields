import type { RepairPlan } from '../jev/chat';
import { JevNotConfigured, jevConfigured } from '../jev/status';

/** Total tries for one request, counting the user's own message as the first. */
export const MAX_ATTEMPTS = 5;

// Failures the model cannot fix by answering again: nothing to edit, nothing left to change,
// or the user cancelled. The error states these outright, so they never cost an evaluation.
const terminal = [/No file was attached/, /already in the file/, /Verification cancelled/];

export type Remedy = RepairPlan['remedy'];

/** Either the next prompt to send, or the reason the loop stopped, for the message to show. */
export type Repair = { action: 'retry'; prompt: string; remedy: Remedy } | { action: 'stop'; reason: string };

export const EXHAUSTED = `Stopped auto-fixing after ${MAX_ATTEMPTS} attempts. Adjust the request and try again.`;
const UNFIXABLE = 'Stopped auto-fixing: another attempt cannot fix this. Adjust the request and try again.';
const NEEDS_YOU = 'Stopped auto-fixing: this needs a decision from you before another attempt makes sense.';
const UNLIKELY = 'Stopped auto-fixing: another attempt is unlikely to land. Adjust the request and try again.';
/** Below this, the remaining attempts are more likely to be spent than used. */
const PROSPECT_FLOOR = 0.25;

/** What each remedy adds to the fix-up prompt. `retry` is the prompt this loop has always sent. */
const direction: Record<Remedy, string> = {
  retry: '',
  simplify:
    'Your last attempt was too large to land in one patch. Make the smallest change that fixes the cause above, even if it leaves the rest for a follow-up.',
  split:
    'This change appears to need code that is not attached. Make only the part the attached file can carry on its own, and say plainly which other file the rest belongs in.',
  ask_user: '',
  stop: ''
};

/**
 * The follow-up that feeds a failed change back to the model, or undefined when no further
 * attempt should run. `attempt` is the attempt that just failed.
 */
export function fixUpPrompt(error: string, file: string, attempt: number, remedy: Remedy = 'retry') {
  if (attempt >= MAX_ATTEMPTS || terminal.some(pattern => pattern.test(error))) return;
  const extra = direction[remedy];
  return `Your change to ${file} was not applied (attempt ${attempt} of ${MAX_ATTEMPTS}). The playground reported:
${error.trim()}

The attached file is its current contents; nothing from your last reply was applied. Fix the cause above and reply with one corrected patch for ${file} whose SEARCH lines are copied exactly from the attached file and whose result compiles with no errors.${extra ? '\n' + extra : ''}`;
}

export interface RepairInput {
  /** The developer's own request, so the decision is about the change and not only the error. */
  prompt: string;
  file: string;
  error: string;
  attempt: number;
}
export type Decide = (input: RepairInput & { maxAttempts: number }) => Promise<RepairPlan>;

// Loaded on demand: a failed auto-apply is a rare path, and this keeps Effect and the workflows
// out of the initial bundle for every session that never hits one. `status.ts` carries neither, so
// an unconfigured server never loads any of it.
const viaJev: Decide = async input => {
  if (!(await jevConfigured())) throw new JevNotConfigured();
  const [{ runJev }, { repairDecision }] = await Promise.all([import('../jev/browser'), import('../jev/chat')]);
  return runJev(repairDecision(input));
};

/**
 * Decide what to do about a failed edit.
 *
 * The blind version of this loop retried every recoverable failure until the cap, which spent five
 * model calls on requests that were never going to land. Jev reads the failure instead — but only
 * ever to *save* attempts, never to spend them on a guess: anything it cannot separate confidently,
 * and any failure it cannot be reached for, falls back to exactly the retry this loop always did.
 *
 * The deterministic answers come first and cost nothing. "No file was attached" is not a judgment.
 */
export async function planRepair(input: RepairInput, decide: Decide | null = viaJev): Promise<Repair> {
  const { error, file, attempt } = input;
  const retry = fixUpPrompt(error, file, attempt);
  if (!retry) return { action: 'stop', reason: attempt >= MAX_ATTEMPTS ? EXHAUSTED : UNFIXABLE };
  const fallback: Repair = { action: 'retry', prompt: retry, remedy: 'retry' };
  if (!decide) return fallback;
  try {
    const plan = await decide({ ...input, maxAttempts: MAX_ATTEMPTS });
    if (!plan.certain) return fallback;
    if (plan.remedy === 'stop' || !plan.fixable) return { action: 'stop', reason: UNFIXABLE };
    if (plan.remedy === 'ask_user') return { action: 'stop', reason: NEEDS_YOU };
    if (plan.prospect < PROSPECT_FLOOR) return { action: 'stop', reason: UNLIKELY };
    return { action: 'retry', prompt: fixUpPrompt(error, file, attempt, plan.remedy)!, remedy: plan.remedy };
  } catch {
    // Unreachable, unconfigured, rate limited: the loop must not depend on it being there.
    return fallback;
  }
}
