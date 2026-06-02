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

  // ------------------------------------------------------------
  // Per-screen tours (CR-052 follow-on — "help objects on every
  // screen"). Each main screen has its own short walk-through that
  // auto-starts the first time the user lands there, and can be
  // replayed from the help button. Same five-year-old voice.
  // ------------------------------------------------------------

  // tour.selfStudy.* — the Self-Study Editor (the writing screen).
  'tour.selfStudy.intro':
    "This is the screen where you write your school's story. Want a quick look around?",
  'tour.selfStudy.phases':
    "These are the four steps. You go left to right: bring in your file, check the drafts, write your story, then send it in.",
  'tour.selfStudy.import':
    "Step one. Bring in your school's paper here and let the helper read it for you.",
  'tour.selfStudy.drafts':
    "Step two. The helper makes drafts from your paper. You look at each one and say yes or no.",
  'tour.selfStudy.write':
    "Step three. This is where you write and fix your story, part by part, until each part is done.",
  'tour.selfStudy.submit':
    "Step four. When every part is done, you send your story in for someone to read.",
  'tour.selfStudy.lastStep':
    "That's the whole screen! Click the help button anytime to see this again.",

  // tour.readerReview.* — the Reader review queue + review screen.
  'tour.readerReview.intro':
    "This is where you read other schools' stories and say how well they did. Want a quick look?",
  'tour.readerReview.queue':
    "These are the schools waiting for you to read. Click one to open it.",
  'tour.readerReview.screen':
    "Here is one school's story. You read each part and give it a score.",
  'tour.readerReview.messages':
    "Need to ask a question? Click here to talk with the other people working on this school.",
  'tour.readerReview.lastStep':
    "That's it! Click the help button anytime to see this again.",

  // tour.leadCompilation.* — the Lead-Reader compilation screen.
  'tour.leadCompilation.intro':
    "This is where all the readers' scores come together so you can pick the final one. Want a quick look?",
  'tour.leadCompilation.toolbar':
    "Use these buttons to choose what you see and how you share it.",
  'tour.leadCompilation.export':
    "Click here to save all the scores as a file you can print or send.",
  'tour.leadCompilation.sendBoard':
    "When the scores are all set, click here to send this school to the board.",
  'tour.leadCompilation.lastStep':
    "That's it! Click the help button anytime to see this again.",

  // tour.adminSettings.* — the Admin settings screen.
  'tour.adminSettings.intro':
    "This is where you set up the people and rules for the portal. Want a quick look?",
  'tour.adminSettings.nav':
    "Pick a part here to change it. Each one opens its own page on the right.",
  'tour.adminSettings.lastStep':
    "That's it! Click the help button anytime to see this again.",

  // tour.siteVisit.* — the Site-Visit checklist + itinerary screens.
  'tour.siteVisit.intro':
    "This is your screen for the school visit. Want a quick look?",
  'tour.siteVisit.checklist':
    "This is your list of things to check while you are there. Tick each one off as you go.",
  'tour.siteVisit.itinerary':
    "This is the plan for your day — where you go and when. You can change the times here.",
  'tour.siteVisit.toolbar':
    "Use these buttons to save your work or to make a file you can print.",
  'tour.siteVisit.lastStep':
    "That's it! Click the help button anytime to see this again.",

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
  // Generic per-screen tour labels — shown when the current screen has its
  // own walk-through (anything other than the home/welcome tour).
  'help.menu.tourScreen': 'Show me around this screen',
  'help.menu.tourScreenAgain': 'Show me around this screen again',
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
