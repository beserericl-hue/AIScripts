import mongoose, { Schema, Document } from 'mongoose';

/**
 * Persistent, short-lived OAuth `state` -> returnTo store for the MemberClick
 * sign-in handshake. Replaces the in-memory Map that did NOT survive a server
 * restart (single replica) or a future scale-out (multiple replicas): if the
 * container restarted — or the /login and /callback hit different instances —
 * between the authorize redirect and the callback, the state was lost and the
 * member got a silent "Sign-in link expired" page (the AACC/Julia symptom).
 *
 * A MongoDB TTL index purges each row automatically after the TTL, so this is
 * self-cleaning. The controller keeps an in-memory copy too as a fast-path
 * fallback if a Mongo read/write transiently fails.
 */
export interface IOAuthState extends Document {
  state: string;
  returnTo: string;
  createdAt: Date;
}

// TTL: 30 minutes. Long enough for a slow MemberClick login (password reset,
// hunting credentials) without expiring; the value is single-use (deleted on
// read) and a random 128-bit token, so the CSRF window stays safe.
const STATE_TTL_SECONDS = 30 * 60;

const OAuthStateSchema = new Schema<IOAuthState>({
  state: { type: String, required: true, unique: true, index: true },
  returnTo: { type: String, required: true, default: '/dashboard' },
  // `expires` on the field creates the TTL index (Mongo purges the doc
  // STATE_TTL_SECONDS after createdAt).
  createdAt: { type: Date, default: Date.now, expires: STATE_TTL_SECONDS },
});

export const OAuthState =
  (mongoose.models.OAuthState as mongoose.Model<IOAuthState>) ||
  mongoose.model<IOAuthState>('OAuthState', OAuthStateSchema);

export const OAUTH_STATE_TTL_MS = STATE_TTL_SECONDS * 1000;
