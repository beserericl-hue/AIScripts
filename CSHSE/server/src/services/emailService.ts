// CR — outbound mail goes through SendGrid when configured (clean, reverse-DNS-
// aligned sending IPs that strict receivers like Microsoft/.edu accept), and
// falls back to the self-hosted Postal server otherwise. Setting SENDGRID_API_KEY
// switches providers with no other change.
import { sendEmail as postalSendEmail, isPostalConfigured } from './postal';
import { sendEmail as sendgridSendEmail, isSendgridConfigured } from './sendgrid';

// Shared trust footer. A clear sender identity + a physical postal address are
// what inbox-placement filters (Microsoft/Gmail) and CAN-SPAM both look for, so
// every templated email carries the same block to improve deliverability and
// keep messages out of the junk folder. Source of record: CSHSE Member Handbook.
const ORG_NAME = 'Council for Standards in Human Service Education';
const ORG_ADDRESS = '9600 SW Oak Street, Ste 565, Tigard, OR 97223';
const ORG_EMAIL = 'info@cshse.org';
const ORG_WEBSITE = 'https://cshse.org';

const BRAND_FOOTER_HTML = `<div style="background-color: #e2e8f0; padding: 20px; text-align: center; font-size: 12px; color: #666; line-height: 1.6;">
          <p style="margin: 0 0 4px; font-weight: bold; color: #1a365d;">${ORG_NAME}</p>
          <p style="margin: 0 0 4px;">${ORG_ADDRESS}</p>
          <p style="margin: 0 0 8px;"><a href="mailto:${ORG_EMAIL}" style="color: #2563eb; text-decoration: none;">${ORG_EMAIL}</a> &nbsp;&middot;&nbsp; <a href="${ORG_WEBSITE}" style="color: #2563eb; text-decoration: none;">cshse.org</a></p>
          <p style="margin: 0; color: #888;">This is an automated message from the CSHSE Self-Study Portal. Questions? Reply to this email or contact <a href="mailto:${ORG_EMAIL}" style="color: #888;">${ORG_EMAIL}</a>.</p>
        </div>`;

const BRAND_FOOTER_TEXT = `--
${ORG_NAME}
${ORG_ADDRESS}
${ORG_EMAIL} · ${ORG_WEBSITE}

This is an automated message from the CSHSE Self-Study Portal.
Questions? Reply to this email or contact ${ORG_EMAIL}.`;

export interface EmailAttachment {
  /** File name shown in the email (e.g. "screenshot.png"). */
  name: string;
  /** MIME type (e.g. "image/png"). */
  contentType: string;
  /** base64-encoded bytes (no data: prefix). */
  data: string;
}

export interface EmailOptions {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  /** Per-user identity — replies route here; From stays branded (cshse@…). */
  replyTo?: string;
  /** Blind-copied recipients (e.g. the superuser on a submit notification). */
  bcc?: string | string[];
  attachments?: EmailAttachment[];
}

export interface InvitationEmailData {
  recipientName: string;
  recipientEmail: string;
  inviterName: string;
  role: string;
  institutionName?: string;
  invitationLink: string;
  expiresAt: Date;
}

export interface StandardSubmittedEmailData {
  leadReaderName: string;
  leadReaderEmail: string;
  programName: string;
  institutionName: string;
  standardCode: string;
  standardName: string;
  submitterName: string;
  submissionLink: string;
}

export interface ValidationResultEmailData {
  coordinatorName: string;
  coordinatorEmail: string;
  programName: string;
  standardCode: string;
  specCode: string;
  status: 'pass' | 'fail';
  feedback: string;
  suggestions?: string[];
  submissionLink: string;
}

export interface ReviewCompleteEmailData {
  coordinatorName: string;
  coordinatorEmail: string;
  programName: string;
  reviewerName: string;
  standardCode: string;
  decision: string;
  comments?: string;
  submissionLink: string;
}

export interface SelfStudySubmittedEmailData {
  leadReaderName: string;
  leadReaderEmail: string;
  programName: string;
  institutionName: string;
  submitterName: string;
  submissionLink: string;
  submittedAt: Date;
  /** Blind-copied on the notification (e.g. the superuser oversight mailbox). */
  bccEmails?: string[];
}

class EmailService {
  /**
   * Send a templated email through Postal. The branded From (cshse@courseworx.media)
   * is fixed inside the Postal client; per-user identity rides in `replyTo`.
   * Fail-soft (returns false) so a mail hiccup never breaks the triggering request
   * — the Postal client itself logs the structured error.
   */
  async sendEmail(options: EmailOptions): Promise<boolean> {
    // Prefer SendGrid (deliverable to strict receivers); fall back to Postal.
    const useSendgrid = isSendgridConfigured();
    if (!useSendgrid && !isPostalConfigured()) {
      console.warn('Email not sent - no provider configured (SENDGRID_API_KEY / POSTAL_API_KEY missing)');
      return false;
    }
    const send = useSendgrid ? sendgridSendEmail : postalSendEmail;
    const provider = useSendgrid ? 'sendgrid' : 'postal';
    try {
      const { messageId } = await send({
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        replyTo: options.replyTo,
        bcc: options.bcc,
        attachments: options.attachments,
      });
      console.log(`Email sent to ${options.to}: ${options.subject} (${provider} ${messageId})`);
      return true;
    } catch (error) {
      console.error('Failed to send email:', error);
      return false;
    }
  }

  async sendInvitationEmail(data: InvitationEmailData): Promise<boolean> {
    const expiresFormatted = data.expiresAt.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #1a365d; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">CSHSE Self-Study Portal</h1>
        </div>
        <div style="padding: 30px; background-color: #f8f9fa;">
          <h2 style="color: #1a365d;">You've Been Invited!</h2>
          <p>Hello ${data.recipientName},</p>
          <p><strong>${data.inviterName}</strong> has invited you to join the CSHSE Self-Study Portal as a <strong>${data.role}</strong>${data.institutionName ? ` for ${data.institutionName}` : ''}.</p>
          <p>Click the button below to accept your invitation and set up your account:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.invitationLink}" style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Accept Invitation</a>
          </div>
          <p style="color: #666; font-size: 14px;">This invitation expires on ${expiresFormatted}.</p>
          <p style="color: #666; font-size: 14px;">If you didn't expect this invitation, you can safely ignore this email.</p>
        </div>
        ${BRAND_FOOTER_HTML}
      </div>
    `;

    const text = `
Hello ${data.recipientName},

${data.inviterName} has invited you to join the CSHSE Self-Study Portal as a ${data.role}${data.institutionName ? ` for ${data.institutionName}` : ''}.

Click the link below to accept your invitation and set up your account:
${data.invitationLink}

This invitation expires on ${expiresFormatted}.

If you didn't expect this invitation, you can safely ignore this email.

${BRAND_FOOTER_TEXT}
    `;

    return this.sendEmail({
      to: data.recipientEmail,
      subject: `You're invited to CSHSE Self-Study Portal`,
      html,
      text
    });
  }

  /** Password-reset email (site login only). Includes the spam-folder reminder
   *  the reset flow requires, since the mail is sent from the courseworx domain. */
  async sendPasswordResetEmail(data: { to: string; name?: string; resetLink: string }): Promise<boolean> {
    const hello = data.name ? `Hello ${data.name},` : 'Hello,';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #1a365d; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">CSHSE Self-Study Portal</h1>
        </div>
        <div style="padding: 30px; background-color: #f8f9fa;">
          <h2 style="color: #1a365d;">Reset your password</h2>
          <p>${hello}</p>
          <p>We received a request to reset the password for your CSHSE Self-Study Portal account. Click the button below to choose a new password:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.resetLink}" style="background-color: #157347; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset my password</a>
          </div>
          <p style="color: #666; font-size: 14px;">This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email — your password won't change.</p>
          <p style="background:#fff8e1;border:1px solid #f0e0a0;border-radius:6px;padding:12px 14px;color:#7a5b00;font-size:14px;">
            Don't see this email? Please <strong>check your spam or junk folder</strong> for a message from <strong>cshse.courseworx.media</strong>.
          </p>
        </div>
        ${BRAND_FOOTER_HTML}
      </div>
    `;
    const text = `${hello}

We received a request to reset the password for your CSHSE Self-Study Portal account.
Open the link below to choose a new password (expires in 1 hour):
${data.resetLink}

If you didn't request a password reset, you can safely ignore this email.

Don't see this email? Please check your spam or junk folder for a message from cshse.courseworx.media.

${BRAND_FOOTER_TEXT}`;
    return this.sendEmail({
      to: data.to,
      subject: 'Reset your CSHSE Self-Study Portal password',
      html,
      text,
    });
  }

  async sendStandardSubmittedEmail(data: StandardSubmittedEmailData): Promise<boolean> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #1a365d; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">CSHSE Self-Study Portal</h1>
        </div>
        <div style="padding: 30px; background-color: #f8f9fa;">
          <h2 style="color: #1a365d;">Standard Ready for Review</h2>
          <p>Hello ${data.leadReaderName},</p>
          <p>A standard has been submitted for your review:</p>
          <div style="background-color: white; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <p><strong>Program:</strong> ${data.programName}</p>
            <p><strong>Institution:</strong> ${data.institutionName}</p>
            <p><strong>Standard:</strong> ${data.standardCode} - ${data.standardName}</p>
            <p><strong>Submitted by:</strong> ${data.submitterName}</p>
          </div>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.submissionLink}" style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Review Submission</a>
          </div>
        </div>
        ${BRAND_FOOTER_HTML}
      </div>
    `;

    const text = `
Hello ${data.leadReaderName},

A standard has been submitted for your review:

Program: ${data.programName}
Institution: ${data.institutionName}
Standard: ${data.standardCode} - ${data.standardName}
Submitted by: ${data.submitterName}

Review the submission here: ${data.submissionLink}

${BRAND_FOOTER_TEXT}
    `;

    return this.sendEmail({
      to: data.leadReaderEmail,
      subject: `Standard ${data.standardCode} Submitted for Review - ${data.programName}`,
      html,
      text
    });
  }

  async sendValidationResultEmail(data: ValidationResultEmailData): Promise<boolean> {
    const statusColor = data.status === 'pass' ? '#16a34a' : '#dc2626';
    const statusText = data.status === 'pass' ? 'Passed' : 'Needs Revision';

    const suggestionsHtml = data.suggestions && data.suggestions.length > 0
      ? `<div style="margin-top: 15px;"><strong>Suggestions:</strong><ul>${data.suggestions.map(s => `<li>${s}</li>`).join('')}</ul></div>`
      : '';

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #1a365d; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">CSHSE Self-Study Portal</h1>
        </div>
        <div style="padding: 30px; background-color: #f8f9fa;">
          <h2 style="color: #1a365d;">Validation Result</h2>
          <p>Hello ${data.coordinatorName},</p>
          <p>Your submission for <strong>Standard ${data.standardCode}, Specification ${data.specCode}</strong> has been validated:</p>
          <div style="background-color: ${statusColor}; color: white; padding: 15px; border-radius: 5px; text-align: center; margin: 20px 0;">
            <h3 style="margin: 0;">${statusText}</h3>
          </div>
          <div style="background-color: white; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <p><strong>Program:</strong> ${data.programName}</p>
            <p><strong>Feedback:</strong> ${data.feedback}</p>
            ${suggestionsHtml}
          </div>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.submissionLink}" style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">View Submission</a>
          </div>
        </div>
        ${BRAND_FOOTER_HTML}
      </div>
    `;

    const text = `
Hello ${data.coordinatorName},

Your submission for Standard ${data.standardCode}, Specification ${data.specCode} has been validated:

Status: ${statusText}

Program: ${data.programName}
Feedback: ${data.feedback}
${data.suggestions && data.suggestions.length > 0 ? `Suggestions:\n${data.suggestions.map(s => `- ${s}`).join('\n')}` : ''}

View your submission here: ${data.submissionLink}

${BRAND_FOOTER_TEXT}
    `;

    return this.sendEmail({
      to: data.coordinatorEmail,
      subject: `Validation ${statusText}: Standard ${data.standardCode}.${data.specCode} - ${data.programName}`,
      html,
      text
    });
  }

  async sendReviewCompleteEmail(data: ReviewCompleteEmailData): Promise<boolean> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #1a365d; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">CSHSE Self-Study Portal</h1>
        </div>
        <div style="padding: 30px; background-color: #f8f9fa;">
          <h2 style="color: #1a365d;">Review Complete</h2>
          <p>Hello ${data.coordinatorName},</p>
          <p>A review has been completed for your submission:</p>
          <div style="background-color: white; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <p><strong>Program:</strong> ${data.programName}</p>
            <p><strong>Standard:</strong> ${data.standardCode}</p>
            <p><strong>Reviewer:</strong> ${data.reviewerName}</p>
            <p><strong>Decision:</strong> ${data.decision}</p>
            ${data.comments ? `<p><strong>Comments:</strong> ${data.comments}</p>` : ''}
          </div>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.submissionLink}" style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">View Details</a>
          </div>
        </div>
        ${BRAND_FOOTER_HTML}
      </div>
    `;

    const text = `
Hello ${data.coordinatorName},

A review has been completed for your submission:

Program: ${data.programName}
Standard: ${data.standardCode}
Reviewer: ${data.reviewerName}
Decision: ${data.decision}
${data.comments ? `Comments: ${data.comments}` : ''}

View details here: ${data.submissionLink}

${BRAND_FOOTER_TEXT}
    `;

    return this.sendEmail({
      to: data.coordinatorEmail,
      subject: `Review Complete: Standard ${data.standardCode} - ${data.programName}`,
      html,
      text
    });
  }

  async sendSelfStudySubmittedEmail(data: SelfStudySubmittedEmailData): Promise<boolean> {
    const submittedFormatted = data.submittedAt.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #1a365d; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">CSHSE Self-Study Portal</h1>
        </div>
        <div style="padding: 30px; background-color: #f8f9fa;">
          <h2 style="color: #1a365d;">Self-Study Submitted for Review</h2>
          <p>Hello ${data.leadReaderName},</p>
          <p>A complete self-study has been submitted and is ready for your review:</p>
          <div style="background-color: white; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <p><strong>Program:</strong> ${data.programName}</p>
            <p><strong>Institution:</strong> ${data.institutionName}</p>
            <p><strong>Submitted by:</strong> ${data.submitterName}</p>
            <p><strong>Submitted on:</strong> ${submittedFormatted}</p>
          </div>
          <p>All standards and specifications have been validated. Please review the self-study and assign readers when ready.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.submissionLink}" style="background-color: #0d9488; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Review Self-Study</a>
          </div>
        </div>
        ${BRAND_FOOTER_HTML}
      </div>
    `;

    const text = `
Hello ${data.leadReaderName},

A complete self-study has been submitted and is ready for your review:

Program: ${data.programName}
Institution: ${data.institutionName}
Submitted by: ${data.submitterName}
Submitted on: ${submittedFormatted}

All standards and specifications have been validated. Please review the self-study and assign readers when ready.

Review the self-study here: ${data.submissionLink}

${BRAND_FOOTER_TEXT}
    `;

    return this.sendEmail({
      to: data.leadReaderEmail,
      subject: `Self-Study Submitted for Review - ${data.programName}`,
      html,
      text,
      bcc: data.bccEmails && data.bccEmails.length ? data.bccEmails : undefined
    });
  }

  async sendGenericNotification(
    to: string | string[],
    subject: string,
    message: string,
    actionUrl?: string,
    actionText?: string,
    // Per-user identity (e.g. the actor who triggered this notification) so
    // replies route to that person rather than the branded mailbox.
    replyTo?: string
  ): Promise<boolean> {
    const actionButton = actionUrl && actionText
      ? `<div style="text-align: center; margin: 30px 0;">
          <a href="${actionUrl}" style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">${actionText}</a>
        </div>`
      : '';

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #1a365d; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">CSHSE Self-Study Portal</h1>
        </div>
        <div style="padding: 30px; background-color: #f8f9fa;">
          <p>${message.replace(/\n/g, '<br>')}</p>
          ${actionButton}
        </div>
        ${BRAND_FOOTER_HTML}
      </div>
    `;

    return this.sendEmail({
      to,
      subject,
      html,
      text: message + (actionUrl ? `\n\n${actionText}: ${actionUrl}` : '') + `\n\n${BRAND_FOOTER_TEXT}`,
      replyTo
    });
  }

  /**
   * Email an in-app bug report (text + optional screenshot) to the support
   * inboxes. The reporter's email becomes the Reply-To so support can respond
   * directly. Fail-soft — the report is already persisted; a mail hiccup must
   * not fail the request.
   */
  async sendBugReportEmail(data: {
    reference: string;
    description: string;
    route: string;
    userAgent: string;
    buildSha?: string;
    reporterName?: string;
    reporterEmail?: string;
    reporterRole?: string;
    recentConsoleErrors?: Array<{ message: string; ts?: Date | string }>;
    /** data:image/...;base64,... URL captured on the client. */
    screenshot?: string;
    createdAt?: Date;
  }): Promise<boolean> {
    const to = ['eric@agileadtesting.com', 'info@cshse.org'];
    const esc = (s: string) =>
      String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const when = (data.createdAt || new Date()).toLocaleString('en-US');
    const errorsList = (data.recentConsoleErrors || []).slice(-10);

    // Parse the screenshot data URL into a real file attachment.
    let attachments: EmailAttachment[] | undefined;
    let inlineNote = 'No screenshot was attached.';
    if (data.screenshot) {
      const m = /^data:(image\/(png|jpeg|jpg|webp));base64,(.+)$/i.exec(data.screenshot);
      if (m) {
        const contentType = m[1].toLowerCase();
        const ext = contentType.split('/')[1].replace('jpeg', 'jpg');
        attachments = [{ name: `screenshot-${data.reference}.${ext}`, contentType, data: m[3] }];
        inlineNote = 'A screenshot is attached to this email.';
      }
    }

    const text = [
      `New bug report from the CSHSE Self-Study Portal`,
      ``,
      `Reference: ${data.reference}`,
      `When: ${when}`,
      `Reporter: ${data.reporterName || 'unknown'}${data.reporterEmail ? ` <${data.reporterEmail}>` : ''}${data.reporterRole ? ` (${data.reporterRole})` : ''}`,
      `Page: ${data.route}`,
      `Build: ${data.buildSha || 'n/a'}`,
      `Browser: ${data.userAgent}`,
      ``,
      `What happened:`,
      data.description,
      ``,
      errorsList.length ? `Recent console errors:\n${errorsList.map((e) => `- ${e.message}`).join('\n')}` : `No recent console errors captured.`,
      ``,
      inlineNote,
      ``,
      BRAND_FOOTER_TEXT,
    ].join('\n');

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto;">
        <div style="background-color: #7f1d1d; color: white; padding: 16px 20px;">
          <h1 style="margin: 0; font-size: 18px;">🐛 New bug report — CSHSE Self-Study Portal</h1>
        </div>
        <div style="padding: 20px; background-color: #f8f9fa;">
          <table style="font-size: 14px; color: #1f2937; border-collapse: collapse;">
            <tr><td style="padding:2px 10px 2px 0; color:#6b7280;">Reference</td><td><code>${esc(data.reference)}</code></td></tr>
            <tr><td style="padding:2px 10px 2px 0; color:#6b7280;">When</td><td>${esc(when)}</td></tr>
            <tr><td style="padding:2px 10px 2px 0; color:#6b7280;">Reporter</td><td>${esc(data.reporterName || 'unknown')}${data.reporterEmail ? ` &lt;${esc(data.reporterEmail)}&gt;` : ''}${data.reporterRole ? ` (${esc(data.reporterRole)})` : ''}</td></tr>
            <tr><td style="padding:2px 10px 2px 0; color:#6b7280;">Page</td><td>${esc(data.route)}</td></tr>
            <tr><td style="padding:2px 10px 2px 0; color:#6b7280;">Build</td><td>${esc(data.buildSha || 'n/a')}</td></tr>
            <tr><td style="padding:2px 10px 2px 0; color:#6b7280; vertical-align:top;">Browser</td><td style="color:#6b7280;">${esc(data.userAgent)}</td></tr>
          </table>
          <h3 style="color:#1a365d; margin:18px 0 6px;">What happened</h3>
          <div style="background:#fff; border:1px solid #e5e7eb; border-radius:6px; padding:12px; white-space:pre-wrap;">${esc(data.description)}</div>
          ${errorsList.length ? `<h3 style="color:#1a365d; margin:18px 0 6px;">Recent console errors</h3><ul style="font-size:13px; color:#374151;">${errorsList.map((e) => `<li><code>${esc(String(e.message))}</code></li>`).join('')}</ul>` : ''}
          <p style="font-size:13px; color:#6b7280; margin-top:16px;">${esc(inlineNote)}</p>
        </div>
        ${BRAND_FOOTER_HTML}
      </div>`;

    return this.sendEmail({
      to,
      subject: `🐛 Bug report: ${(data.description || '').slice(0, 60)}${(data.description || '').length > 60 ? '…' : ''} [${data.route}]`,
      html,
      text,
      replyTo: data.reporterEmail,
      attachments,
    });
  }

  isEnabled(): boolean {
    return isSendgridConfigured() || isPostalConfigured();
  }
}

export const emailService = new EmailService();
