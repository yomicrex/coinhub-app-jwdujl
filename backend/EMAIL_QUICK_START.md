# Email Setup - Quick Start

Get password reset emails working in 5 minutes.

## 1. Development (Console Mode - No Setup Required)

Works immediately, emails logged to console:

```bash
# .env
EMAIL_PROVIDER=console
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

Test:
```bash
curl -X POST http://localhost:3000/api/auth/request-password-reset \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

Response includes `debug.resetLink` for testing.

---

## 2. Development with Gmail (SMTP)

Actual emails sent, but to your development account:

### Step 1: Create Gmail App Password

1. Go to https://myaccount.google.com/apppasswords
2. Select "Mail" and "Windows Computer"
3. Copy the 16-character password

### Step 2: Configure

```bash
# .env
EMAIL_PROVIDER=smtp
EMAIL_FROM=your-email@gmail.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=xxxx-xxxx-xxxx-xxxx
FRONTEND_URL=http://localhost:3000
```

### Step 3: Test

```bash
curl -X POST http://localhost:3000/api/auth/request-password-reset \
  -H "Content-Type: application/json" \
  -d '{"email":"your-email@gmail.com"}'
```

Check Gmail inbox for password reset email.

---

## 3. Production with SendGrid

Best for production - excellent deliverability.

### Step 1: Create SendGrid Account

1. Sign up: https://sendgrid.com
2. Create API Key (Settings → API Keys)
3. Note: Must be "Full Access"

### Step 2: Verify Sender Email

1. Settings → Sender Verification
2. Add your domain or email
3. Click verification link (you'll receive email)

### Step 3: Configure

```bash
# .env
EMAIL_PROVIDER=sendgrid
EMAIL_FROM=noreply@coinhub.example.com
SENDGRID_API_KEY=SG.xxxxxxxxxxxxx...
FRONTEND_URL=https://coinhub.example.com
```

### Step 4: Install Dependency

```bash
npm install @sendgrid/mail
```

---

## 4. Production with Resend

Modern API, great for transactional emails.

### Step 1: Create Resend Account

1. Sign up: https://resend.com
2. Create API Key: https://resend.com/api-keys

### Step 2: Verify Domain

1. Add domain to Resend (free tier uses resend.dev)
2. Add DNS records for verification
3. Or use: `noreply@resend.dev` for testing

### Step 3: Configure

```bash
# .env
EMAIL_PROVIDER=resend
EMAIL_FROM=noreply@coinhub.example.com
RESEND_API_KEY=re_xxxxxxxxxxxxx...
FRONTEND_URL=https://coinhub.example.com
```

### Step 4: Install Dependency

```bash
npm install resend
```

---

## Environment Variables

Copy to `.env`:

```bash
# Required
EMAIL_PROVIDER=console  # or: smtp, sendgrid, resend
EMAIL_FROM=noreply@coinhub.example.com
FRONTEND_URL=http://localhost:3000

# For SMTP only
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=app-password-here

# For SendGrid only
SENDGRID_API_KEY=SG.xxxxx

# For Resend only
RESEND_API_KEY=re_xxxxx
```

---

## Response Format

### Success
```json
{
  "success": true,
  "message": "If an account exists with this email, a password reset link has been sent"
}
```

### Development (includes token)
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

### Error
```json
{
  "success": false,
  "error": "Validation failed",
  "message": "Please provide a valid email address"
}
```

---

## Frontend Integration

Password reset link format:
```
{FRONTEND_URL}/auth?mode=reset&token={RESET_TOKEN}
```

Example:
```
https://coinhub.example.com/auth?mode=reset&token=550e8400-e29b-41d4-a716-446655440000
```

Frontend should:
1. Extract `token` from URL query param
2. Call `GET /api/auth/verify-reset-token/:token` to validate
3. Show password form if valid
4. Call `POST /api/auth/reset-password` to complete

---

## Testing

### Step 1: Request Reset

```bash
curl -X POST http://localhost:3000/api/auth/request-password-reset \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com"}' | jq
```

### Step 2: Get Token

- **Console mode**: Check server logs for token
- **Gmail mode**: Check inbox for email with link
- **SendGrid mode**: Check SendGrid dashboard or inbox
- **Resend mode**: Check Resend dashboard or inbox

### Step 3: Verify Token

```bash
TOKEN="..."
curl http://localhost:3000/api/auth/verify-reset-token/$TOKEN | jq
```

### Step 4: Reset Password

```bash
TOKEN="..."
curl -X POST http://localhost:3000/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d "{\"token\":\"$TOKEN\",\"password\":\"newPassword123\"}" | jq
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `Unknown email provider` | Check `EMAIL_PROVIDER` spelling |
| `Cannot find module` | Run `npm install @sendgrid/mail` or `npm install resend` |
| `Invalid login` (SMTP) | Use Gmail App Password (16 chars), not regular password |
| `Email not delivered` | Check spam folder, verify sender |
| `Sender not verified` | Verify domain/email in provider dashboard |
| No `debug` field | Check `NODE_ENV=development` |

---

## Full Documentation

For more details, see: `EMAIL_SETUP_GUIDE.md`

For authentication docs, see: `AUTHENTICATION_TROUBLESHOOTING.md`
