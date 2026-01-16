# Email Setup for Password Recovery

Quick setup guide for enabling password reset emails in CoinHub.

## 5-Minute Setup

### Step 1: Create Resend Account

1. Go to https://resend.com
2. Click "Sign up"
3. Create account with email
4. Verify your email

### Step 2: Get API Key

1. Log into Resend
2. Go to "API Keys" section
3. Click "Create API Key"
4. Copy the key (starts with `re_`)

### Step 3: Configure Backend

**Option A: Local Development (No Email)**

```bash
# No setup needed!
# Password reset works without RESEND_API_KEY
# Debug token returned in response
```

**Option B: Local Development (With Email)**

```bash
# Create .env file in /app/code/backend/
RESEND_API_KEY=re_your_key_here
RESEND_FROM_EMAIL=onboarding@resend.dev
RESEND_REPLY_TO_EMAIL=support@resend.dev
FRONTEND_URL=http://localhost:3000
```

**Option C: Production**

```bash
# Set environment variables in your hosting provider
# (Vercel, Railway, GitHub, etc.)

RESEND_API_KEY=re_your_production_key
RESEND_FROM_EMAIL=noreply@yourdomain.com
RESEND_REPLY_TO_EMAIL=support@yourdomain.com
FRONTEND_URL=https://coinhub.example.com
```

### Step 4: Test

```bash
# Request password reset
curl -X POST http://localhost:3000/api/auth/request-password-reset \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'

# Without RESEND_API_KEY:
# Response includes debug token
# Email not sent

# With RESEND_API_KEY:
# Email sent to test@example.com
# Check logs for: "Password reset email sent successfully"
```

## Environment Variables

### For Resend

```bash
# Required
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxx

# Optional (defaults provided)
RESEND_FROM_EMAIL=noreply@coinhub.example.com
RESEND_REPLY_TO_EMAIL=support@coinhub.example.com
```

### For Frontend Links

```bash
# Required in production
FRONTEND_URL=https://coinhub.example.com

# Optional (defaults to http://localhost:3000)
# Used for password reset links in emails
```

## Development Mode

### Without Resend Key

```bash
# .env file
# Don't set RESEND_API_KEY

# Password reset request returns:
{
  "message": "If an account exists with this email, a password reset link will be sent shortly",
  "debug": {
    "token": "550e8400-e29b-41d4-a716-446655440000",
    "expiresAt": "2024-01-15T11:00:00Z",
    "resetLink": "http://localhost:3000/auth?mode=reset&token=550e8400-e29b-41d4-a716-446655440000"
  }
}

# Copy token from response
# Use in frontend to test password reset flow
```

### With Resend Sandbox

```bash
# .env file
RESEND_API_KEY=re_test_key...
RESEND_FROM_EMAIL=onboarding@resend.dev

# Test emails work:
# delivered@resend.dev
# bounced@resend.dev
# oops@resend.dev
```

## Production Deployment

### Vercel

```bash
# Set environment variables in Vercel dashboard
# Settings → Environment Variables

RESEND_API_KEY=re_prod_key...
RESEND_FROM_EMAIL=noreply@yourdomain.com
RESEND_REPLY_TO_EMAIL=support@yourdomain.com
FRONTEND_URL=https://coinhub.example.com
```

### Railway

```bash
# Set environment variables in Railway dashboard
# Variables tab

RESEND_API_KEY=re_prod_key...
RESEND_FROM_EMAIL=noreply@yourdomain.com
RESEND_REPLY_TO_EMAIL=support@yourdomain.com
FRONTEND_URL=https://coinhub.example.com
```

### GitHub Actions

```yaml
# .github/workflows/deploy.yml

env:
  RESEND_API_KEY: ${{ secrets.RESEND_API_KEY }}
  RESEND_FROM_EMAIL: noreply@yourdomain.com
  FRONTEND_URL: https://coinhub.example.com
```

### Docker

```dockerfile
# Dockerfile
ENV RESEND_API_KEY=$RESEND_API_KEY
ENV RESEND_FROM_EMAIL=$RESEND_FROM_EMAIL
ENV FRONTEND_URL=$FRONTEND_URL
```

## Verify Email Service

### Check Logs

```bash
npm run dev

# Look for:
# [INFO] Password reset email sent successfully
# [INFO] messageId: e_xxx...
```

### Check Resend Dashboard

1. Go to https://resend.com
2. Click "Emails" tab
3. Should see sent emails
4. Status: "delivered" or "bounced"

### Check User Email

1. Request password reset with your email
2. Check inbox (and spam folder)
3. Click reset link
4. Confirm it works

## Troubleshooting

### Email Not Sent

**Check 1: API Key**
```bash
# Verify in logs
# [WARN] RESEND_API_KEY not configured
# → Add RESEND_API_KEY to .env

# [ERROR] Failed to send password reset email
# → Check API key is correct (starts with re_)
```

**Check 2: Sender Email**
```bash
# Verify RESEND_FROM_EMAIL matches verified domain
# In production, domain must be verified in Resend
```

**Check 3: Recipient Email**
```bash
# Verify email is in database
# User must have signed up first
```

### Email in Spam

```bash
# 1. Add noreply@yourdomain.com to contacts
# 2. Mark as "Not Spam"
# 3. This trains email filters
```

### Link Not Working

```bash
# 1. Verify token is in link
# 2. Verify FRONTEND_URL is correct
# 3. Check token hasn't expired (1 hour)
```

## Testing Checklist

- [ ] Sign up with test email
- [ ] Request password reset
- [ ] Check logs for email sent message
- [ ] Receive email in inbox
- [ ] Click reset link
- [ ] Reset password works
- [ ] Can sign in with new password
- [ ] Old password doesn't work

## Resend Features

### Test Emails (Sandbox)

```bash
# These emails work without verification:
delivered@resend.dev      # Success
bounced@resend.dev        # Bounce
oops@resend.dev           # Validation error
```

### Production Emails

```bash
# Add your domain:
# 1. Resend Dashboard → Domains
# 2. Add your domain
# 3. Copy DNS records
# 4. Add to your DNS provider
# 5. Wait for verification
```

### API Status

Check Resend status page:
https://status.resend.com

## Email Template Preview

The password reset email includes:

1. **Subject**: Reset Your CoinHub Password
2. **Greeting**: Hi [user@email.com]
3. **Message**: Explains password reset request
4. **Action Button**: "Reset Password" button
5. **Fallback Link**: Text version of link
6. **Expiration Notice**: "Link expires in 1 hour"
7. **Security Notice**: "Didn't request this? Ignore safely"
8. **Footer**: Copyright and support info

## Support

- **Resend Docs**: https://resend.com/docs
- **Backend Logs**: `npm run dev 2>&1 | grep email`
- **Email Configuration**: `EMAIL_CONFIGURATION.md`
- **API Reference**: `PASSWORD_RECOVERY_GUIDE.md`

## Next Steps

1. ✅ Add RESEND_API_KEY to .env
2. ✅ Test password reset flow
3. ✅ Verify email received
4. ✅ Verify reset link works
5. ✅ Add FRONTEND_URL in production
6. ✅ Verify domain in Resend (production)
7. ✅ Deploy with env variables
8. ✅ Monitor email delivery
