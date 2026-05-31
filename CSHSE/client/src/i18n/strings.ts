// ---------------------------------------------------------------------------
// CR-052 / Sprint 7 — in-house typed string registry.
//
// This is the i18n substitute. The app has no real i18n library today; this
// module centralizes every CR-052-introduced user-visible string so a future
// migration to react-i18next (or similar) is a drop-in replacement of `t`.
//
// Conventions:
//   - Keys are dotted, lowercase, namespaced by surface (`tour.welcome.*`,
//     `help.menu.*`, etc.).
//   - All copy uses plain English at a five-year-old reading level. No
//     computer jargon. Each tour / hint string describes WHAT a thing does
//     in simple words ("This is where you write your school's story" not
//     "Configure your VPA submission"). Per CR-052 user direction.
//   - Variables are `{name}`-style and substituted at call time.
//
// New keys go in `STRINGS` below. The `StringKey` literal-union prevents
// typos at every call site.
// ---------------------------------------------------------------------------

const STRINGS = {
  // ============================================================
  // tour.* — Welcome-tour step content + framing.
  // Five-year-old voice; describe what the thing IS, not what to do.
  // ============================================================
  'tour.welcome.intro':
    "Hi! This is your portal. We can show you around in less than a minute. Want to take a quick look?",
  'tour.welcome.home':
    "This is your home page. From here you can find every part of the portal.",
  'tour.welcome.selfStudy':
    "This is where you tell the story of your school's program. You write what you do and put it here.",
  'tour.welcome.reviewQueue':
    "This is where you read other schools' stories. You read them and say how well they're doing.",
  'tour.welcome.compilations':
    "This is where all the reader scores come together so you can pick the final score for each part.",
  'tour.welcome.settings':
    "This is where the boss sets up the people who use the portal.",
  'tour.welcome.help':
    "If you ever feel stuck, click here. You can ask a question or watch this tour again.",
  'tour.welcome.lastStep':
    "That's it! You can come back to this tour anytime from the help button.",

  // tour.controls.* — the custom tooltip's buttons.
  'tour.controls.back': '← Back',
  'tour.controls.skip': 'Skip',
  'tour.controls.next': 'Next →',
  'tour.controls.finish': 'Finish',
  'tour.controls.stepLabel': 'Step {current} of {total}',

  // tour.errors.* — surfaced via the toast when persistence breaks.
  'tour.errors.persistFailed':
    "We could not save that you watched the tour. Please try again later.",

  // tour.hint.* — the post-completion hint anchored to the Help button.
  'tour.hint.afterComplete':
    "You can come back here anytime to watch the tour again.",

  // hint.* — per-feature first-time nudges (CR-052 / Sprint 9.3). Fire once
  // ever via useOnceHint; five-year-old voice, describe what the thing IS.
  'hint.compilation.firstFinal':
    "This is the final score for this part. You pick one number from all the readers' scores. The schools see this number.",
  'hint.checklist.firstVerify':
    "Click here when you have checked this part in person. It turns the row to \"Yes\" so everyone knows it is done.",
  'hint.reader.firstScore':
    "Pick one number for how well this part is done. 0 means not done, 3 means fully done. Your score is saved right away.",
  'hint.relay.firstQueue':
    "These are reader notes waiting for you. When you share one, the school can read it — but never who wrote it.",
  'hint.messages.firstThread':
    "This is where you talk with the other people working on this school. Pick a chat to read it, or write a new note here.",
  'hint.assignment.firstRequest':
    "The list of readers is locked now. You cannot change it yourself. Use this to ask the boss to add or take away a reader.",

  // ============================================================
  // help.* — Help dropdown menu + chat affordances.
  // ============================================================
  'help.trigger.label': 'Help',
  'help.menu.chat': 'Chat with us',
  'help.menu.chatUnavailable':
    "The help chat is not turned on right now. Please try again later.",
  'help.menu.startTour': 'Start the welcome tour',
  'help.menu.restartTour': 'Watch the welcome tour again',
  'help.menu.closed': 'Close help menu',

  // ============================================================
  // toast.* — generic toast strings.
  // ============================================================
  'toast.dismiss': 'Close this message',
} as const;

export type StringKey = keyof typeof STRINGS;

/**
 * Substitute {var} placeholders in a string with the provided values.
 * Unknown placeholders are left in place so the bug is visible.
 */
function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  let out = template;
  for (const [k, v] of Object.entries(vars)) {
    // Use regex with global flag so we don't depend on ES2021's
    // String.prototype.replaceAll (the project's tsconfig targets ES2020).
    const escaped = k.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&');
    out = out.replace(new RegExp(`\\{${escaped}\\}`, 'g'), String(v));
  }
  return out;
}

/**
 * Read a CR-052 i18n key. Type-safe: passing a non-existent key fails at
 * compile time. Returns the English copy today; in the future this swaps
 * to the active locale via the real i18n layer.
 */
export function t(key: StringKey, vars?: Record<string, string | number>): string {
  return interpolate(STRINGS[key], vars);
}

/** Expose the raw registry for tests (sanity checks + completeness audits). */
export const STRINGS_FOR_TESTING = STRINGS;

export type TFn = typeof t;
