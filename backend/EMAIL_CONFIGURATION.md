# Email Configuration Guide

Complete guide for configuring email sending in CoinHub password recovery system.

## Quick Start

### Setup Resend (Recommended)

1. **Create Resend Account**
   - Go to https://resend.com
   - Sign up for a free account
   - Verify your email

2. **Create API Key**
   - Go to API Keys section
   - Click "Create API Key"
   - Copy the API key (starts with `re_`)

3. **Add Environment Variables**
   ```bash
   # .env or production environment
   RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxx
   RESEND_FROM_EMAIL=noreply@yourdomain.com
   RESEND_REPLY_TO_EMAIL=support@yourdomain.com
   FRONTEND_URL=https://coinhub.example.com
   ```

4. **Verify Domain (Production)**
   - Add your domain to Resend
   - Follow DNS verification steps
   - Wait for verification (15 minutes - 48 hours)

## Environment Variables

### Required for Email Sending

```bash
# Resend API Key (get from https://resend.com)
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxx

# Frontend URL (for reset links)
FRONTEND_URL=https://coinhub.example.com
```

### Optional (Defaults Provided)

```bash
# From email address (default: noreply@coinhub.example.com)
RESEND_FROM_EMAIL=noreply@yourdomain.com

# Reply-to email (default: support@coinhub.example.com)
RESEND_REPLY_TO_EMAIL=support@yourdomain.com
```

### Development Mode

```bash
# Optional: Force development mode even in production
NODE_ENV=development

# In development, if RESEND_API_KEY is not set:
# - Emails are NOT sent
# - Debug token is returned in response
# - Password reset still works for testing
```

## Email Template

The password reset email includes:

### Subject
```
Reset Your CoinHub Password
```

### Content

1. **Professional Header**
   - CoinHub branding
   - Clear subject

2. **Greeting**
   - User's email address
   - Friendly tone

3. **Clear Instructions**
   - Explains password reset request
   - Action-oriented message

4. **Action Button**
   - Prominent "Reset Password" button
   - Links to: `{FRONTEND_URL}/auth?mode=reset&token={token}`

5. **Fallback Link**
   - Text version of reset link
   - For clients that don't render HTML

6. **Security Notices**
   - ⏱️ Token expires in 1 hour
   - 🔒 "Didn't request this? Ignore safely"
   - Security recommendations

7. **Footer**
   - Company copyright
   - Support contact info
   - Unsubscribe (if applicable)

## Reset Link Format

The password reset email contains a link in this format:

```
https://coinhub.example.com/auth?mode=reset&token=550e8400-e29b-41d4-a716-446655440000
```

Your frontend should:
1. Parse the `token` parameter
2. Display the reset password form
3. Submit the token + new password to `/api/auth/reset-password`

## Email Sending Flow

```
User requests password reset
  ↓
System generates UUID token (1-hour expiration)
  ↓
Token stored in database
  ↓
Email helper function checks RESEND_API_KEY
  ↓
If key configured:
  → Resend API called with HTML + text content
  → Email sent to user
  → Success logged with message ID
  ↓
If key not configured:
  → Development mode allowed
  → Email skipped (no-op)
  → Debug token returned in response
  ↓
Response sent to user
  → Generic message (no email enumeration)
  → Development: includes debug token
  ↓
User checks email and clicks reset link
  → Frontend validates token via `/api/auth/verify-reset-token/{token}`
  → Shows password reset form
  ↓
User submits new password
  ↓
Backend validates token and resets password
  ↓
All user sessions invalidated
  ↓
User signs in with new password
```

## Production Setup

### 1. Domain Configuration (Resend)

```bash
# In Resend Dashboard:
1. Go to Domains
2. Add your domain
3. Add DNS records (provided by Resend)
   - MX record
   - DKIM record
   - SPF record
4. Wait for verification
```

### 2. Environment Variables

```bash
# Production .env file
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxx
RESEND_FROM_EMAIL=noreply@coinhub.example.com
RESEND_REPLY_TO_EMAIL=support@coinhub.example.com
FRONTEND_URL=https://coinhub.example.com
NODE_ENV=production
```

### 3. Deployment

```bash
# Deploy backend with environment variables set
# (via GitHub Actions, Vercel, Railway, etc.)

# Verify email sending:
1. Test password reset request endpoint
2. Check logs for "Password reset email sent successfully"
3. Check Resend dashboard for email events
4. User receives email
5. Reset link works
```

### 4. Monitoring

Track these metrics:
- Password reset requests (count)
- Password reset emails sent (count)
- Email sending failures (alert if > 0)
- Email bounce rate
- Email delivery time

## Troubleshooting

### Issue: "RESEND_API_KEY not configured, skipping email send"

**Cause**: Environment variable not set

**Solution**:
1. Add `RESEND_API_KEY` to `.env` or environment
2. Restart application
3. Test password reset again

**Check**:
```bash
# In your application logs, you should see:
# [INFO] Password reset email sent successfully
# Not: [WARN] RESEND_API_KEY not configured
```

### Issue: "Failed to send password reset email via Resend"

**Cause**: API error (usually domain not verified or invalid key)

**Solution**:
1. Verify API key is correct (starts with `re_`)
2. Verify domain is added and verified in Resend
3. Check Resend dashboard for errors
4. Verify `RESEND_FROM_EMAIL` matches verified domain

**Check**:
```bash
# Test API key
curl -X POST https://api.resend.com/emails \
  -H "Authorization: Bearer re_xxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "from": "noreply@yourdomain.com",
    "to": "test@gmail.com",
    "subject": "Test",
    "html": "Test"
  }'
```

### Issue: User doesn't receive email

**Cause**: Multiple possibilities

**Solution**:
1. Check backend logs for "Password reset email sent successfully"
2. Check Resend dashboard (Emails tab)
3. Check user's spam folder
4. Verify sender email and domain
5. Check email address in database

**Debug**:
```bash
# Check Resend logs via API
curl https://api.resend.com/emails \
  -H "Authorization: Bearer re_xxxxxxxxxx"

# Should show:
# - status: "delivered" or "bounced"
# - to: user's email
# - from: noreply@yourdomain.com
```

### Issue: Reset link doesn't work

**Cause**: Token issue or frontend routing problem

**Solution**:
1. Verify token is in reset link
2. Verify `FRONTEND_URL` is correct
3. Check frontend routing for `/auth?mode=reset&token=...`
4. Verify token hasn't expired (1-hour window)

**Debug**:
```bash
# Manually test reset link
GET /api/auth/verify-reset-token/{token-from-email}

# Should return:
# { "valid": true, "email": "user@example.com" }
```

## Alternative Email Providers

### SendGrid

```bash
# Install package
npm install @sendgrid/mail

# Environment variables
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxx
```

**Implementation**:
```typescript
import sgMail from '@sendgrid/mail';

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

await sgMail.send({
  to: email,
  from: process.env.SENDGRID_FROM_EMAIL,
  subject: 'Reset Your CoinHub Password',
  html: htmlContent,
  text: textContent,
});
```

### AWS SES

```bash
# Install package
npm install @aws-sdk/client-ses

# Environment variables
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
AWS_REGION=us-east-1
```

### Gmail (SMTP)

```bash
# Environment variables
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

**Note**: Gmail requires app-specific password, not regular password.

## Development Testing

### Without Email Service

1. Set `NODE_ENV=development`
2. Don't set `RESEND_API_KEY`
3. Request password reset
4. Response includes debug token:
   ```json
   {
     "message": "...",
     "debug": {
       "token": "550e8400-e29b-41d4-a716-446655440000",
       "resetLink": "http://localhost:3000/auth?mode=reset&token=..."
     }
   }
   ```
5. Use token directly in frontend

### With Email Service (Testing)

1. Create test email (e.g., test@example.com)
2. Sign up with that email
3. Request password reset
4. Check email inbox
5. Click reset link
6. Reset password

### With Resend Test Mode

```bash
# Use test email for previewing
RESEND_FROM_EMAIL=onboarding@resend.dev

# Resend provides test emails:
# delivered@resend.dev
# hard-bounce@resend.dev
# soft-bounce@resend.dev
```

## Email Template Customization

Edit `/app/code/backend/src/routes/auth.ts` function `sendPasswordResetEmail`:

- `htmlContent`: HTML email design
- `textContent`: Plain text fallback
- `subject`: Email subject line
- `resetLink`: Format of reset URL

Changes apply to all new password reset emails.

## Rate Limiting (Production)

Consider adding rate limiting to prevent abuse:

```typescript
// Example: Max 5 requests per email per hour
const key = `password-reset:${normalizedEmail}`;
const attempts = await cache.get(key) || 0;

if (attempts >= 5) {
  return reply.status(429).send({
    error: 'Too many attempts',
    message: 'Please wait an hour before requesting another password reset'
  });
}

await cache.set(key, attempts + 1, 3600); // 1 hour
```

## Security Considerations

### Email Security

1. ✅ HTTPS only (in production)
2. ✅ Token is not sent via email subject/headers
3. ✅ Token expires in 1 hour
4. ✅ Token is one-time use only
5. ✅ Reset link requires user interaction
6. ✅ Email templates include security notices
7. ⚠️ TODO: Add email verification on account creation
8. ⚠️ TODO: Add email change confirmation

### API Security

1. ✅ No email enumeration (same response for all)
2. ✅ Token validation on reset
3. ✅ Password hashing with bcrypt
4. ✅ Session invalidation after reset
5. ✅ Comprehensive logging

### Provider Security

1. ✅ Resend uses HTTPS and encryption
2. ✅ API keys should never be committed
3. ✅ Use environment variables only
4. ✅ Rotate API keys regularly
5. ⚠️ TODO: Add request signing

## Monitoring & Analytics

### Track These Metrics

```
- Password reset requests per day
- Email sending success rate
- Email bounce rate
- Email delivery time
- Password reset completion rate
- Failed reset attempts
```

### Alerts to Configure

```
- Email sending failure rate > 5%
- Bounce rate > 2%
- API rate limit approached
- API errors occurring
- Domain verification issues
```

## Compliance

### GDPR

- ✅ Users can request password reset
- ✅ User email used only for authentication
- ✅ No marketing emails sent
- ⚠️ TODO: Delete old password reset tokens after 30 days
- ⚠️ TODO: Allow users to opt-out of emails (except required)

### CAN-SPAM

- ✅ Email has Clear identification
- ✅ Email has valid physical address (in footer)
- ✅ Email has reply-to address
- ✅ Email not marked as spam/phishing
- ⚠️ TODO: Honor unsubscribe requests

### CASL (Canada)

- ✅ Password reset is transactional (exempt from consent)
- ✅ User can opt-in to marketing
- ⚠️ TODO: Separate transactional vs marketing emails

## Support

For issues:

1. Check backend logs: `npm run dev 2>&1 | grep -i "email"`
2. Check Resend dashboard: https://resend.com
3. Verify environment variables are set
4. Test with curl to Resend API
5. Check email address in database

## Next Steps

1. ✅ Backend: Email sending implemented
2. 🔄 Frontend: Implement password reset page
3. 🔄 Frontend: Parse reset token from URL
4. 🔄 Frontend: Display reset form
5. 🔄 Frontend: Submit new password
6. ✅ Deploy with environment variables
7. ✅ Test end-to-end
8. ✅ Monitor in production
