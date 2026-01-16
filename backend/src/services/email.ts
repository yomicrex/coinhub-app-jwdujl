import { Resend } from 'resend';

export interface EmailService {
  sendPasswordResetEmail(email: string, resetToken: string, frontendUrl: string): Promise<{ success: boolean; error?: string }>;
}

export function createEmailService(logger: any): EmailService {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@coinhub.app';
  const isEnabled = !!apiKey;

  if (!isEnabled) {
    logger.warn('Resend email service not configured - emails will not be sent. Set RESEND_API_KEY and RESEND_FROM_EMAIL environment variables.');
  }

  const resend = apiKey ? new Resend(apiKey) : null;

  return {
    async sendPasswordResetEmail(email: string, resetToken: string, frontendUrl: string) {
      const resetLink = `${frontendUrl}/auth?mode=reset&token=${encodeURIComponent(resetToken)}`;

      // If email service is not enabled, return error
      if (!isEnabled || !resend) {
        logger.error(
          { email, resetToken, resetLink },
          'Email service not configured - cannot send password reset email. Set RESEND_API_KEY environment variable.'
        );
        return {
          success: false,
          error: 'Email service is not configured. Please contact support.',
        };
      }

      try {
        logger.info({ email, resetLink }, 'Sending password reset email');

        const response = await resend.emails.send({
          from: fromEmail,
          to: email,
          subject: 'Reset Your CoinHub Password',
          html: generatePasswordResetEmailHtml(resetLink),
          text: generatePasswordResetEmailText(resetLink),
        });

        if (response.error) {
          logger.error(
            { email, error: response.error },
            'Failed to send password reset email via Resend'
          );
          return {
            success: false,
            error: `Failed to send password reset email: ${response.error.message || 'Unknown error'}`,
          };
        }

        logger.info(
          { email, messageId: response.data?.id },
          'Password reset email sent successfully'
        );

        return { success: true };
      } catch (error) {
        logger.error(
          { err: error, email },
          'Error sending password reset email'
        );
        return {
          success: false,
          error: 'Failed to send password reset email',
        };
      }
    },
  };
}

/**
 * Generate HTML email template for password reset
 */
function generatePasswordResetEmailHtml(resetLink: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb; }
    .email-wrapper { background-color: #ffffff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px 20px; text-align: center; }
    .header h1 { color: #ffffff; margin: 0; font-size: 24px; font-weight: 600; }
    .content { padding: 30px 20px; }
    .content h2 { color: #1f2937; font-size: 18px; margin: 0 0 15px 0; }
    .content p { color: #4b5563; margin: 0 0 15px 0; }
    .cta-button { display: inline-block; background-color: #667eea; color: #ffffff; text-decoration: none; padding: 12px 30px; border-radius: 6px; font-weight: 600; margin: 20px 0; }
    .cta-button:hover { background-color: #5568d3; }
    .reset-link { word-break: break-all; background-color: #f3f4f6; padding: 12px; border-radius: 4px; font-size: 12px; color: #4b5563; margin: 15px 0; }
    .warning-box { background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px; }
    .warning-box p { color: #92400e; margin: 0; }
    .footer { background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb; }
    .footer p { color: #6b7280; font-size: 12px; margin: 0; }
    .footer a { color: #667eea; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="email-wrapper">
      <div class="header">
        <h1>🪙 CoinHub</h1>
      </div>

      <div class="content">
        <h2>Reset Your Password</h2>

        <p>Hi there,</p>

        <p>We received a request to reset your CoinHub password. Click the button below to create a new password.</p>

        <p style="text-align: center;">
          <a href="${resetLink}" class="cta-button">Reset Password</a>
        </p>

        <p>Or copy and paste this link in your browser:</p>
        <div class="reset-link">${resetLink}</div>

        <div class="warning-box">
          <p><strong>⚠️ Important:</strong> This link will expire in 1 hour for security reasons.</p>
        </div>

        <div class="warning-box">
          <p><strong>🔒 Didn't request this?</strong> If you didn't request a password reset, you can safely ignore this email. Your account remains secure.</p>
        </div>

        <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">
          If you're having trouble clicking the button, copy and paste the link above into your web browser.
        </p>
      </div>

      <div class="footer">
        <p>© 2024 CoinHub. All rights reserved.</p>
        <p><a href="https://coinhub.app">Visit CoinHub</a> | <a href="https://coinhub.app/privacy">Privacy Policy</a></p>
      </div>
    </div>
  </div>
</body>
</html>
`;
}

/**
 * Generate plain text email template for password reset
 */
function generatePasswordResetEmailText(resetLink: string): string {
  return `CoinHub Password Reset

Hi there,

We received a request to reset your CoinHub password. Click the link below to create a new password.

${resetLink}

⚠️ Important: This link will expire in 1 hour for security reasons.

🔒 Didn't request this? If you didn't request a password reset, you can safely ignore this email. Your account remains secure.

---
© 2024 CoinHub. All rights reserved.
Visit us at https://coinhub.app
`;
}
