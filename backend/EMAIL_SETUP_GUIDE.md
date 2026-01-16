# Email Configuration Guide

Complete guide for setting up email sending in CoinHub for password reset notifications.

## Overview

CoinHub supports multiple email providers for sending password reset emails:

1. **Console** (Development) - Logs emails to console
2. **SMTP** - Standard email protocol (Gmail, Outlook, etc.)
3. **SendGrid** - Cloud email service
4. **Resend** - Modern email API for developers

## Quick Start

### Development Mode (Default)

In development, emails are logged to console and not actually sent:

```bash
# .env
EMAIL_PROVIDER=console
NODE_ENV=development
```

When you request a password reset, you'll see:
```
[INFO] EMAIL (Development mode - not sent): { to, subject, html }
```

Plus debug token in response:
```json
{
  "success": true,
  "message": "If an account exists...",
  "debug": {
    "token": "...",
    "resetLink": "http://localhost:3000/auth?mode=reset&token=..."
  }
}
```

### Production Mode

For production, configure one of the email providers below.

---

## Email Providers

### 1. SMTP (Gmail, Outlook, etc.)

Send emails using standard SMTP protocol. Works with any email provider.

#### Gmail Setup

**Step 1: Enable 2FA and create App Password**

1. Go to https://myaccount.google.com/security
2. Enable 2-Step Verification if not already enabled
3. Go to App Passwords (https://myaccount.google.com/apppasswords)
4. Select "Mail" and "Windows Computer" (or your device)
5. Google will generate a 16-character password

**Step 2: Configure environment variables**

```bash
# .env
EMAIL_PROVIDER=smtp
EMAIL_FROM=your-email@gmail.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-16-character-app-password  # From step 1
FRONTEND_URL=https://coinhub.example.com
```

**Step 3: Test**

```bash
curl -X POST http://localhost:3000/api/auth/request-password-reset \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

Expected: Email arrives in inbox

#### Outlook/Office365

```bash
EMAIL_PROVIDER=smtp
EMAIL_FROM=your-email@outlook.com
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@outlook.com
SMTP_PASSWORD=your-password
```

#### Self-Hosted SMTP

```bash
EMAIL_PROVIDER=smtp
EMAIL_FROM=noreply@coinhub.example.com
SMTP_HOST=mail.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=noreply@coinhub.example.com
SMTP_PASSWORD=your-smtp-password
```

### 2. SendGrid

Professional email service with excellent deliverability.

**Step 1: Create SendGrid account**

1. Sign up at https://sendgrid.com
2. Create an API key: Settings → API Keys → Create API Key
3. Choose "Full Access" for development, or restrict permissions for production

**Step 2: Configure environment variables**

```bash
EMAIL_PROVIDER=sendgrid
EMAIL_FROM=noreply@coinhub.example.com  # Must be verified sender
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxx
FRONTEND_URL=https://coinhub.example.com
```

**Step 3: Verify sender email**

1. In SendGrid dashboard, go to Sender Verification
2. Add your email address or domain
3. Click the verification link (you'll receive an email)

**Step 4: Test**

```bash
npm install @sendgrid/mail
```

Then test the endpoint.

### 3. Resend

Modern email API optimized for transactional emails.

**Step 1: Create Resend account**

1. Sign up at https://resend.com
2. Verify your domain (or use default resend.dev domain for testing)
3. Create an API key: https://resend.com/api-keys

**Step 2: Configure environment variables**

```bash
EMAIL_PROVIDER=resend
EMAIL_FROM=noreply@coinhub.example.com  # Must be verified domain
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxx
FRONTEND_URL=https://coinhub.example.com
```

**Step 3: Install dependency**

```bash
npm install resend
```

**Step 4: Test**

Test the endpoint to send a password reset email.

---

## Response Format

### Success Response

```json
{
  "success": true,
  "message": "If an account exists with this email, a password reset link has been sent"
}
```

In development mode, includes debug info:
```json
{
  "success": true,
  "message": "...",
  "debug": {
    "token": "550e8400-e29b-41d4-a716-446655440000",
    "expiresAt": "2024-01-15T11:00:00Z",
    "resetLink": "http://localhost:3000/auth?mode=reset&token=550e8400-e29b-41d4-a716-446655440000"
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": "Validation failed",
  "message": "Please provide a valid email address"
}
```

### Email Not Sent Error

```json
{
  "success": false,
  "error": "Failed to process password reset request",
  "message": "An error occurred while processing your request. Please try again later."
}
```

---

## Email Template

The email contains:

1. **Header** - CoinHub branding with gradient background
2. **Main Content** - Personalized greeting and explanation
3. **Call-to-Action Button** - "Reset Password" button linking to: `{FRONTEND_URL}/auth?mode=reset&token={TOKEN}`
4. **Backup Link** - Copy-paste URL if button doesn't work
5. **Expiration Notice** - "Link expires in 1 hour"
6. **Security Notice** - "If you didn't request this, ignore it"
7. **Footer** - Support link and copyright

### Link Format

Password reset links follow this format:
```
{FRONTEND_URL}/auth?mode=reset&token={RESET_TOKEN}
```

Example:
```
https://coinhub.example.com/auth?mode=reset&token=550e8400-e29b-41d4-a716-446655440000
```

---

## Environment Variables

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `EMAIL_PROVIDER` | Email service to use | `smtp`, `sendgrid`, `resend`, `console` |
| `EMAIL_FROM` | Sender email address | `noreply@coinhub.example.com` |
| `FRONTEND_URL` | Frontend URL for reset links | `https://coinhub.example.com` |

### For SMTP

| Variable | Description | Example |
|----------|-------------|---------|
| `SMTP_HOST` | SMTP server hostname | `smtp.gmail.com` |
| `SMTP_PORT` | SMTP port | `587` |
| `SMTP_SECURE` | Use TLS/SSL | `false` or `true` |
| `SMTP_USER` | SMTP username | `your-email@gmail.com` |
| `SMTP_PASSWORD` | SMTP password | `app-password-16-chars` |

### For SendGrid

| Variable | Description |
|----------|-------------|
| `SENDGRID_API_KEY` | SendGrid API key starting with `SG.` |

### For Resend

| Variable | Description |
|----------|-------------|
| `RESEND_API_KEY` | Resend API key starting with `re_` |

---

## Testing

### Test with cURL

```bash
# Request password reset
curl -X POST http://localhost:3000/api/auth/request-password-reset \
  -H "Content-Type: application/json" \
  -d '{"email":"your-email@example.com"}'
```

### Test with Development Mode

1. Set `EMAIL_PROVIDER=console` and `NODE_ENV=development`
2. Request password reset
3. Check server logs for email content and debug token
4. Copy token from logs
5. Test password reset: `POST /api/auth/reset-password` with token

### Test Email Delivery

**Gmail:**
1. Check your inbox
2. Look in Spam if not in Inbox
3. Verify sender address matches EMAIL_FROM

**SendGrid:**
1. Use SendGrid dashboard: Activity → Search
2. Filter by recipient email
3. Check "Delivered" status

**Resend:**
1. Use Resend dashboard: Emails
2. Filter by recipient
3. Check delivery status

---

## Troubleshooting

### Email Not Sent - SMTP

**Error: "connect ECONNREFUSED"**
- SMTP_HOST or SMTP_PORT is wrong
- Server is not accepting connections
- Firewall blocking the port
- Fix: Verify SMTP settings with your email provider

**Error: "Invalid login"**
- SMTP_USER or SMTP_PASSWORD is wrong
- For Gmail, use App Password (16 chars), not regular password
- Fix: Double-check credentials

**Error: "535 5.7.8 Username and password not accepted"**
- 2FA might be enabled without App Password
- App Password expired
- Fix: For Gmail, create new App Password

### Email Not Sent - SendGrid

**Error: "400 - Bad Request"**
- EMAIL_FROM is not a verified sender
- API key is invalid
- Fix: Verify sender in SendGrid dashboard

**Error: "401 - Unauthorized"**
- SENDGRID_API_KEY is wrong or expired
- Fix: Generate new API key

**Email bounces:**
- Recipient address is invalid
- Fix: Verify email format

### Email Not Sent - Resend

**Error: "401 - Unauthorized"**
- RESEND_API_KEY is wrong
- API key expired
- Fix: Generate new API key from Resend dashboard

**Error: "Invalid From Address"**
- EMAIL_FROM domain is not verified
- Fix: Verify domain in Resend dashboard

### No Response Field in Development

**Problem: `debug` field missing from response**

Solution:
- Check `NODE_ENV=development` is set
- Development mode required for debug info
- Production mode hides token for security

### Email Provider Not Loading

**Problem: "Unknown email provider"**

Solution:
- Check EMAIL_PROVIDER spelling
- Must be: `console`, `smtp`, `sendgrid`, or `resend`
- Install required package: `npm install @sendgrid/mail` or `npm install resend`

---

## Production Deployment

### Checklist

- [ ] Email provider configured (not `console`)
- [ ] EMAIL_FROM is verified with provider
- [ ] FRONTEND_URL points to your domain
- [ ] NODE_ENV set to `production`
- [ ] API keys stored securely (use secrets manager)
- [ ] SSL/TLS enabled for SMTP if SMTP_SECURE=true
- [ ] Rate limiting enabled on `/api/auth/request-password-reset`
- [ ] Monitoring/alerts set up for email failures
- [ ] Bounce handling configured
- [ ] Support email address configured (for "contact support" link)

### Rate Limiting

Recommended rate limits for password reset:
- 5 requests per email per hour
- 10 requests per IP per hour

### Monitoring

Set up alerts for:
- SMTP connection failures
- High email bounce rate (>5%)
- API authentication failures
- Email delivery delays

### Security

- Store API keys in secure secrets manager (AWS Secrets Manager, HashiCorp Vault, etc.)
- Don't commit `.env` files to version control
- Use different API keys for development and production
- Rotate API keys regularly
- Monitor for suspicious email sending patterns

---

## Email Service Comparison

| Feature | SMTP | SendGrid | Resend |
|---------|------|----------|--------|
| Setup Difficulty | Easy | Medium | Easy |
| Cost | Free* | $20/month | $20/month |
| Deliverability | Good | Excellent | Excellent |
| Features | Basic | Advanced | Advanced |
| Support | Email provider | Email + Chat | Chat + Email |
| Best for | Small projects | Enterprise | Modern stacks |

*SMTP cost depends on email provider (Gmail is free, etc.)

---

## Logging

All email sending is logged:

```javascript
// Sending email
[INFO] Sending email: { to, subject }

// Email sent successfully
[INFO] Email sent successfully: { to, messageId }

// Email failed
[WARN] Failed to send password reset email: { userId, email }
[ERROR] Failed to send email: { err, to }
```

Use logs to:
- Monitor email delivery
- Debug send failures
- Audit password reset requests
- Detect abuse patterns

---

## API Reference

### POST /api/auth/request-password-reset

Request a password reset email.

**Request:**
```json
{
  "email": "user@example.com"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "If an account exists with this email, a password reset link has been sent"
}
```

**Response (Development):**
```json
{
  "success": true,
  "message": "...",
  "debug": {
    "token": "...",
    "expiresAt": "...",
    "resetLink": "..."
  }
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": "Error type",
  "message": "User-friendly error message"
}
```

---

## Support

For issues with email setup:

1. Check the troubleshooting section above
2. Review server logs: `npm run dev 2>&1 | grep -i email`
3. Verify environment variables: `echo $EMAIL_PROVIDER`
4. Test email provider directly:
   - Gmail: Try sending from Gmail client
   - SendGrid: Use SendGrid dashboard
   - Resend: Use Resend dashboard
5. Check network connectivity: `ping smtp.host.com`

---

## References

- Gmail App Passwords: https://support.google.com/accounts/answer/185833
- SendGrid Setup: https://docs.sendgrid.com/
- Resend Documentation: https://resend.com/docs
- Nodemailer (SMTP): https://nodemailer.com/
