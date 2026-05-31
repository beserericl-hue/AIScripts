import mongoose from 'mongoose';
import { Notification, INotification, NotificationType } from '../models/Notification';
import { User } from '../models/User';
import { emailService } from './emailService';

// ---------------------------------------------------------------------------
// Notification service — the single producer for in-app notifications and
// their optional email twin (the notification pass: CR-010 DM + CR-053 cycle).
//
// `notify` always tries to write the in-app row; if `email` is set it also
// fires emailService.sendGenericNotification fire-and-forget. Both halves are
// fail-soft — a notification (or its email) failing must never break the
// user-facing action that produced it. This mirrors the auditLog contract.
// ---------------------------------------------------------------------------

export interface NotifyOptions {
  recipientId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  submissionId?: string;
  /** When set, at most one notification per (recipient, dedupeKey) is created. */
  dedupeKey?: string;
  /** When true, also email the recipient (looked up by id). */
  email?: boolean;
}

const APP_BASE_URL = (): string =>
  process.env.APP_BASE_URL || process.env.CLIENT_URL || 'https://cshse-develop.up.railway.app';

function _absoluteLink(link?: string): string | undefined {
  if (!link) return undefined;
  if (/^https?:\/\//i.test(link)) return link;
  return `${APP_BASE_URL().replace(/\/$/, '')}${link.startsWith('/') ? '' : '/'}${link}`;
}

/**
 * Create one in-app notification (and optionally email the recipient).
 * Returns the created row, or null when nothing was created (dedupe hit or
 * a swallowed failure).
 */
export async function notify(opts: NotifyOptions): Promise<INotification | null> {
  let created: INotification | null = null;
  try {
    if (opts.dedupeKey) {
      const existing = await Notification.findOne({
        recipientId: new mongoose.Types.ObjectId(opts.recipientId),
        dedupeKey: opts.dedupeKey
      })
        .select('_id')
        .lean();
      if (existing) return null; // already delivered for this key
    }

    created = await Notification.create({
      recipientId: new mongoose.Types.ObjectId(opts.recipientId),
      type: opts.type,
      title: opts.title,
      body: opts.body,
      link: opts.link,
      submissionId: opts.submissionId
        ? new mongoose.Types.ObjectId(opts.submissionId)
        : undefined,
      dedupeKey: opts.dedupeKey,
      read: false
    });
  } catch (err: any) {
    // E11000 = the unique (recipient, dedupeKey) index caught a race — treat
    // as a dedupe hit, not an error.
    if (err?.code === 11000) return null;
    console.error('[notificationService] failed to create notification', opts.type, err);
    return null;
  }

  if (opts.email) {
    void _sendEmail(opts).catch((err) =>
      console.error('[notificationService] email failed', opts.type, err)
    );
  }

  return created;
}

/** Fan out the same notification to several recipients (e.g. DM participants). */
export async function notifyMany(
  recipientIds: string[],
  opts: Omit<NotifyOptions, 'recipientId'>
): Promise<void> {
  const unique = Array.from(new Set(recipientIds.map(String)));
  await Promise.all(
    unique.map((recipientId) =>
      notify({ ...opts, recipientId }).catch((err) =>
        console.error('[notificationService] notifyMany member failed', err)
      )
    )
  );
}

async function _sendEmail(opts: NotifyOptions): Promise<void> {
  if (!emailService.isEnabled()) return;
  const user = await User.findById(opts.recipientId).select('email').lean();
  if (!user?.email) return;
  await emailService.sendGenericNotification(
    user.email,
    opts.title,
    opts.body,
    _absoluteLink(opts.link),
    opts.link ? 'Open in portal' : undefined
  );
}
