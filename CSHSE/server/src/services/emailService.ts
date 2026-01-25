import nodemailer from 'nodemailer';

export interface EmailOptions {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
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

class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private isConfigured = false;

  constructor() {
    this.initialize();
  }

  private initialize() {
    const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
    const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const smtpFrom = process.env.SMTP_FROM;

    if (!smtpUser || !smtpPass) {
      console.warn('Email service not configured: SMTP_USER and SMTP_PASS required');
      return;
    }

    this.transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass
      }
    });

    this.isConfigured = true;
    console.log(`Email service initialized (${smtpHost}:${smtpPort})`);
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    if (!this.isConfigured || !this.transporter) {
      console.warn('Email not sent - service not configured');
      return false;
    }

    const from = process.env.SMTP_FROM || process.env.SMTP_USER;

    try {
      await this.transporter.sendMail({
        from: `CSHSE Accreditation <${from}>`,
        to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
        subject: options.subject,
        text: options.text,
        html: options.html
      });
      console.log(`Email sent to ${options.to}: ${options.subject}`);
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
          <h1 style="margin: 0;">CSHSE Accreditation System</h1>
        </div>
        <div style="padding: 30px; background-color: #f8f9fa;">
          <h2 style="color: #1a365d;">You've Been Invited!</h2>
          <p>Hello ${data.recipientName},</p>
          <p><strong>${data.inviterName}</strong> has invited you to join the CSHSE Accreditation System as a <strong>${data.role}</strong>${data.institutionName ? ` for ${data.institutionName}` : ''}.</p>
          <p>Click the button below to accept your invitation and set up your account:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.invitationLink}" style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Accept Invitation</a>
          </div>
          <p style="color: #666; font-size: 14px;">This invitation expires on ${expiresFormatted}.</p>
          <p style="color: #666; font-size: 14px;">If you didn't expect this invitation, you can safely ignore this email.</p>
        </div>
        <div style="background-color: #e2e8f0; padding: 15px; text-align: center; font-size: 12px; color: #666;">
          <p>Council for Standards in Human Service Education</p>
        </div>
      </div>
    `;

    const text = `
Hello ${data.recipientName},

${data.inviterName} has invited you to join the CSHSE Accreditation System as a ${data.role}${data.institutionName ? ` for ${data.institutionName}` : ''}.

Click the link below to accept your invitation and set up your account:
${data.invitationLink}

This invitation expires on ${expiresFormatted}.

If you didn't expect this invitation, you can safely ignore this email.

- CSHSE Accreditation System
    `;

    return this.sendEmail({
      to: data.recipientEmail,
      subject: `You're invited to CSHSE Accreditation System`,
      html,
      text
    });
  }

  async sendStandardSubmittedEmail(data: StandardSubmittedEmailData): Promise<boolean> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #1a365d; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">CSHSE Accreditation System</h1>
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
        <div style="background-color: #e2e8f0; padding: 15px; text-align: center; font-size: 12px; color: #666;">
          <p>Council for Standards in Human Service Education</p>
        </div>
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

- CSHSE Accreditation System
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
          <h1 style="margin: 0;">CSHSE Accreditation System</h1>
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
        <div style="background-color: #e2e8f0; padding: 15px; text-align: center; font-size: 12px; color: #666;">
          <p>Council for Standards in Human Service Education</p>
        </div>
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

- CSHSE Accreditation System
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
          <h1 style="margin: 0;">CSHSE Accreditation System</h1>
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
        <div style="background-color: #e2e8f0; padding: 15px; text-align: center; font-size: 12px; color: #666;">
          <p>Council for Standards in Human Service Education</p>
        </div>
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

- CSHSE Accreditation System
    `;

    return this.sendEmail({
      to: data.coordinatorEmail,
      subject: `Review Complete: Standard ${data.standardCode} - ${data.programName}`,
      html,
      text
    });
  }

  async sendGenericNotification(
    to: string | string[],
    subject: string,
    message: string,
    actionUrl?: string,
    actionText?: string
  ): Promise<boolean> {
    const actionButton = actionUrl && actionText
      ? `<div style="text-align: center; margin: 30px 0;">
          <a href="${actionUrl}" style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">${actionText}</a>
        </div>`
      : '';

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #1a365d; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">CSHSE Accreditation System</h1>
        </div>
        <div style="padding: 30px; background-color: #f8f9fa;">
          <p>${message.replace(/\n/g, '<br>')}</p>
          ${actionButton}
        </div>
        <div style="background-color: #e2e8f0; padding: 15px; text-align: center; font-size: 12px; color: #666;">
          <p>Council for Standards in Human Service Education</p>
        </div>
      </div>
    `;

    return this.sendEmail({
      to,
      subject,
      html,
      text: message + (actionUrl ? `\n\n${actionText}: ${actionUrl}` : '')
    });
  }

  isEnabled(): boolean {
    return this.isConfigured;
  }
}

export const emailService = new EmailService();
