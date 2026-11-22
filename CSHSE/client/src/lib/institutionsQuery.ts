/**
 * GET /api/institutions pages at 50 by default (sorted by name). Admin pickers
 * and lists need EVERY institution: with more than 50, the ones later in the
 * alphabet silently vanished — e.g. the "Manage roles" dialog showed
 * "— select institution —" for a user's role at Kennesaw / Stevenson and those
 * schools could not be chosen at all (dev, 108 institutions, 2026-11-22).
 */
export const ALL_INSTITUTIONS_LIMIT = 5000;
