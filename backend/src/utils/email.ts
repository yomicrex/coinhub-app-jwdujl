/**
 * Email utility for sending password reset and other transactional emails
 * Supports both development (console) and production (SMTP) modes
 */

import type { App } from '../index.js';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

interface PasswordResetEmailOptions {
  to: string;
  userName: string;
  resetLink: string;
  expiresAt: Date;
}

/**
 * Send an email using configured email service
 */
export async function sendEmail(app: App, options: EmailOptions): Promise<boolean> {
  app.logger.info({ to: options.to, subject: options.subject }, 'Sending email');

  try {
    // Check if email is configured
    const emailProvider = process.env.EMAIL_PROVIDER || 'console';
    const emailFrom = process.env.EMAIL_FROM || 'noreply@coinhub.example.com';

    if (emailProvider === 'console' || process.env.NODE_ENV === 'development') {
      // Development mode: just log the email
      app.logger.info(
        { to: options.to, subject: options.subject, html: options.html },
        'EMAIL (Development mode - not sent)'
      );
      return true;
    }

    if (emailProvider === 'smtp') {
      // Production mode: use nodemailer with SMTP
      const nodemailer = await import('nodemailer');
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD,
        },
      });

      const result = await transporter.sendMail({
        from: emailFrom,
        to: options.to,
        subject: options.subject,
        text: options.text || 'Email',
        html: options.html,
      });

      app.logger.info(
        { to: options.to, messageId: result.messageId },
        'Email sent successfully'
      );
      return true;
    }

    if (emailProvider === 'sendgrid') {
      // SendGrid via their Node.js library
      const sgMail = (await import('@sendgrid/mail')).default as any;
      sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

      const result = await sgMail.send({
        to: options.to,
        from: emailFrom,
        subject: options.subject,
        text: options.text || 'Email',
        html: options.html,
      });

      app.logger.info(
        { to: options.to, messageId: result[0].headers['x-message-id'] },
        'Email sent successfully via SendGrid'
      );
      return true;
    }

    if (emailProvider === 'resend') {
      // Resend.com email service
      const { Resend } = await import('resend');
      const resend = new Resend(process.env.RESEND_API_KEY);

      const result = await resend.emails.send({
        from: emailFrom,
        to: options.to,
        subject: options.subject,
        html: options.html,
      });

      if (result.error) {
        app.logger.error({ error: result.error }, 'Failed to send email via Resend');
        return false;
      }

      app.logger.info(
        { to: options.to, id: result.data?.id },
        'Email sent successfully via Resend'
      );
      return true;
    }

    app.logger.warn({ provider: emailProvider }, 'Unknown email provider, email not sent');
    return false;
  } catch (error) {
    app.logger.error(
      { err: error, to: options.to },
      'Failed to send email'
    );
    return false;
  }
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(
  app: App,
  options: PasswordResetEmailOptions
): Promise<boolean> {
  const { to, userName, resetLink, expiresAt } = options;

  const hoursUntilExpiry = Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60));

  const htmlEmail = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; background-color: #f5f5f5; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1); overflow: hidden; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 28px; font-weight: 600; }
    .content { padding: 40px 30px; }
    .content h2 { color: #333; font-size: 20px; margin-top: 0; margin-bottom: 16px; }
    .content p { color: #666; line-height: 1.6; margin: 12px 0; font-size: 14px; }
    .button-container { text-align: center; margin: 30px 0; }
    .button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; transition: opacity 0.2s; }
    .button:hover { opacity: 0.9; }
    .link-container { background-color: #f9f9f9; padding: 16px; border-radius: 6px; margin: 20px 0; word-break: break-all; }
    .link-container p { color: #999; font-size: 12px; margin: 8px 0; }
    .link-container a { color: #667eea; text-decoration: none; font-weight: 500; font-size: 13px; }
    .warning { background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 16px; margin: 20px 0; border-radius: 4px; }
    .warning p { color: #856404; margin: 8px 0; font-size: 14px; }
    .footer { background-color: #f5f5f5; padding: 24px 30px; text-align: center; border-top: 1px solid #e0e0e0; }
    .footer p { color: #999; font-size: 12px; margin: 4px 0; }
    .logo { font-size: 24px; font-weight: 700; margin-bottom: 8px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">🪙 CoinHub</div>
      <h1>Reset Your Password</h1>
    </div>

    <div class="content">
      <h2>Hi ${userName || 'there'},</h2>

      <p>We received a request to reset your CoinHub password. Click the button below to create a new password.</p>

      <div class="button-container">
        <a href="${resetLink}" class="button">Reset Password</a>
      </div>

      <p style="text-align: center; color: #999; font-size: 13px;">Or copy and paste this link in your browser:</p>

      <div class="link-container">
        <a href="${resetLink}">${resetLink}</a>
      </div>

      <div class="warning">
        <p><strong>⏰ This link expires in ${hoursUntilExpiry} hour${hoursUntilExpiry !== 1 ? 's' : ''}</strong></p>
        <p style="margin-bottom: 0;">For security reasons, the password reset link will only work for a limited time.</p>
      </div>

      <div class="warning" style="background-color: #f0f7ff; border-left-color: #2196F3;">
        <p style="color: #1565c0; margin: 0;"><strong>🔒 Didn't request a password reset?</strong></p>
        <p style="color: #1565c0; margin: 8px 0 0 0;">You can safely ignore this email. Your account is secure. If you didn't request this reset and believe your account may have been compromised, please <a href="https://coinhub.example.com/support" style="color: #1565c0; text-decoration: underline;">contact support</a>.</p>
      </div>
    </div>

    <div class="footer">
      <p><strong>CoinHub</strong></p>
      <p>The community for serious coin collectors</p>
      <p style="margin-top: 12px; border-top: 1px solid #e0e0e0; padding-top: 12px;">
        <a href="https://coinhub.example.com" style="color: #667eea; text-decoration: none; font-size: 12px;">Visit CoinHub</a> •
        <a href="https://coinhub.example.com/support" style="color: #667eea; text-decoration: none; font-size: 12px;">Support</a>
      </p>
      <p style="font-size: 11px; margin-top: 8px;">© 2024 CoinHub. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `;

  const textEmail = `
CoinHub - Password Reset

Hi ${userName || 'there'},

We received a request to reset your CoinHub password. Click the link below to create a new password:

${resetLink}

This link expires in ${hoursUntilExpiry} hour${hoursUntilExpiry !== 1 ? 's' : ''}.

Didn't request a password reset?
You can safely ignore this email. Your account is secure. If you believe your account may have been compromised, please contact support at https://coinhub.example.com/support.

---
CoinHub - The community for serious coin collectors
© 2024 CoinHub. All rights reserved.
  `;

  return sendEmail(app, {
    to,
    subject: 'CoinHub Password Reset - Expires in 1 Hour',
    html: htmlEmail,
    text: textEmail,
  });
}
