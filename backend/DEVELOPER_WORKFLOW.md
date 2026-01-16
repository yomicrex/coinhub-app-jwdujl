# Developer Workflow - Password Reset with Email

Complete developer guide for testing and implementing password reset functionality.

## Architecture Overview

```
Frontend                    Backend                     Email Service
┌─────────┐               ┌──────────┐               ┌──────────────┐
│ Sign In │               │ CoinHub  │               │ SMTP/SendGrid│
│ Page    │               │ Backend  │               │ /Resend      │
└────┬────┘               └────┬─────┘               └──────┬───────┘
     │                         │                            │
     │ Click "Forgot Password" │                            │
     ├────────────────────────→│                            │
     │                         │ Generate token            │
     │                         │ Store in DB               │
     │                         │                            │
     │                         ├───────────────────────────→│
     │                         │ Send email with reset link│
     │                         │←───────────────────────────┤
     │ Receive email           │                            │
     │←────────────────────────┤                            │
     │                         │                            │
     │ Click reset link        │                            │
     ├─────────────────────────→ Verify token              │
     │ Password form           │ Return valid              │
     │←────────────────────────┤                            │
     │                         │                            │
     │ Submit new password     │                            │
     ├────────────────────────→ Hash password             │
     │                         │ Update account            │
     │ Success message         │ Delete token              │
     │←────────────────────────┤ Invalidate sessions       │
     │                         │                            │
     │ Redirect to login       │                            │
     ├────────────────────────→ Sign in with new password  │
     │                         │                            │
```

## Development Setup (5 minutes)

### Step 1: Configure Environment

```bash
# .env
EMAIL_PROVIDER=console
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

Console mode logs emails to server logs instead of sending.

### Step 2: Start Server

```bash
npm run dev
```

### Step 3: Test Password Reset

```bash
# Request password reset
curl -X POST http://localhost:3000/api/auth/request-password-reset \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'

# Response:
{
  "success": true,
  "message": "If an account exists...",
  "debug": {
    "token": "550e8400-e29b-41d4-a716-446655440000",
    "expiresAt": "2024-01-15T11:00:00Z",
    "resetLink": "http://localhost:3000/auth?mode=reset&token=550e8400-e29b-41d4-a716-446655440000"
  }
}
```

### Step 4: Check Server Logs

Server logs show:
```
[INFO] EMAIL (Development mode - not sent): { to, subject, html }
```

Use the token from response for testing.

## Complete Test Flow

### 1. Create Test User

```bash
curl -X POST http://localhost:3000/api/auth/sign-up/email \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser@example.com",
    "password": "password123",
    "name": "Test User"
  }' \
  -c cookies.txt
```

Response:
```json
{
  "user": {
    "id": "user-123",
    "email": "testuser@example.com",
    "name": "Test User"
  },
  "session": { ... }
}
```

### 2. Request Password Reset

```bash
curl -X POST http://localhost:3000/api/auth/request-password-reset \
  -H "Content-Type: application/json" \
  -d '{"email":"testuser@example.com"}'
```

Response (with debug token):
```json
{
  "success": true,
  "message": "If an account exists with this email...",
  "debug": {
    "token": "550e8400-e29b-41d4-a716-446655440000",
    "expiresAt": "2024-01-15T11:00:00Z",
    "resetLink": "http://localhost:3000/auth?mode=reset&token=550e8400-e29b-41d4-a716-446655440000"
  }
}
```

Save the token:
```bash
TOKEN="550e8400-e29b-41d4-a716-446655440000"
```

### 3. Verify Reset Token

```bash
curl http://localhost:3000/api/auth/verify-reset-token/$TOKEN | jq
```

Response:
```json
{
  "valid": true,
  "email": "testuser@example.com"
}
```

### 4. Reset Password

```bash
curl -X POST http://localhost:3000/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d "{\"token\":\"$TOKEN\",\"password\":\"newPassword123\"}"
```

Response:
```json
{
  "message": "Password has been reset successfully. Please sign in with your new password."
}
```

### 5. Try Old Password (Should Fail)

```bash
curl -X POST http://localhost:3000/api/auth/sign-in/email \
  -H "Content-Type: application/json" \
  -d '{"email":"testuser@example.com","password":"password123"}'
```

Response (401):
```json
{
  "error": "Invalid credentials"
}
```

### 6. Sign In with New Password (Should Succeed)

```bash
curl -X POST http://localhost:3000/api/auth/sign-in/email \
  -H "Content-Type: application/json" \
  -d '{"email":"testuser@example.com","password":"newPassword123"}' \
  -c new_cookies.txt
```

Response (200):
```json
{
  "user": {
    "id": "user-123",
    "email": "testuser@example.com",
    "name": "Test User"
  },
  "session": { ... }
}
```

✅ Password reset complete!

## Testing with Gmail

### Setup (One-time)

1. Create App Password: https://myaccount.google.com/apppasswords
2. Save the 16-character password
3. Update `.env`:

```bash
EMAIL_PROVIDER=smtp
EMAIL_FROM=your-email@gmail.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=xxxx-xxxx-xxxx-xxxx
FRONTEND_URL=http://localhost:3000
```

4. Restart server

### Test

```bash
curl -X POST http://localhost:3000/api/auth/request-password-reset \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

Check your Gmail inbox for the password reset email!

## Testing Error Cases

### Invalid Email Format

```bash
curl -X POST http://localhost:3000/api/auth/request-password-reset \
  -H "Content-Type: application/json" \
  -d '{"email":"invalid-email"}'
```

Expected response (400):
```json
{
  "success": false,
  "error": "Validation failed",
  "message": "Please provide a valid email address"
}
```

### Non-existent Email

```bash
curl -X POST http://localhost:3000/api/auth/request-password-reset \
  -H "Content-Type: application/json" \
  -d '{"email":"nonexistent@example.com"}'
```

Expected response (200 - for security):
```json
{
  "success": true,
  "message": "If an account exists with this email..."
}
```

Note: Does NOT reveal whether email exists.

### Expired Token

```bash
# Wait 1+ hour or manually update DB:
# UPDATE verification SET expires_at = NOW() - INTERVAL '1 hour' WHERE value = 'token';

curl -X POST http://localhost:3000/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d "{\"token\":\"$EXPIRED_TOKEN\",\"password\":\"newPassword\"}"
```

Expected response (400):
```json
{
  "error": "Reset link expired",
  "message": "This password reset link has expired. Please request a new one."
}
```

### Invalid Token

```bash
curl -X POST http://localhost:3000/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{"token":"invalid-token-here","password":"newPassword"}'
```

Expected response (400):
```json
{
  "error": "Invalid reset token",
  "message": "This password reset link is invalid or has expired"
}
```

### Short Password

```bash
curl -X POST http://localhost:3000/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d "{\"token\":\"$TOKEN\",\"password\":\"short\"}"
```

Expected response (400):
```json
{
  "error": "Validation failed",
  "message": "Please provide a valid reset token and password"
}
```

## Debugging Tips

### Check Server Logs

```bash
npm run dev 2>&1 | grep -i "password\|email\|reset"
```

### Check Database Directly

```sql
-- View password reset tokens
SELECT id, identifier, value, expires_at FROM verification;

-- Check user accounts
SELECT id, email FROM "user" WHERE email = 'test@example.com';

-- Check account passwords
SELECT user_id, provider_id, password IS NOT NULL FROM account;
```

### Monitor Email Service

**Gmail:**
- Check Sent folder for email sent
- Check Spam folder if not in Inbox
- Verify sender matches EMAIL_FROM

**SendGrid:**
- Dashboard → Activity → Search by email
- Check delivery status

**Resend:**
- Dashboard → Emails → Search by recipient

### Inspect HTTP Traffic

```bash
# Use curl with verbose output
curl -v -X POST http://localhost:3000/api/auth/request-password-reset \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'

# Or use a tool like Postman, Insomnia, or VS Code REST Client
```

## Common Issues and Fixes

| Problem | Debug Command | Fix |
|---------|--------------|-----|
| Email not sent | Check logs | Verify EMAIL_PROVIDER |
| Token not in response | Check NODE_ENV | Set NODE_ENV=development |
| Invalid token error | Save token correctly | Copy full token, no quotes |
| Email delivery failed | Check SMTP settings | Verify credentials in .env |
| Password still valid | Check logs for "sessions invalidated" | Token might not have reset |

## Backend Code Structure

### Email Utility (src/utils/email.ts)

```typescript
// Send email using configured provider
sendEmail(app: App, options: EmailOptions): Promise<boolean>

// Send password reset email
sendPasswordResetEmail(app: App, options: PasswordResetEmailOptions): Promise<boolean>
```

### Password Reset Route (src/routes/auth.ts)

```typescript
// Request password reset
POST /api/auth/request-password-reset
  - Validates email format
  - Checks if user exists
  - Generates UUID token
  - Stores token in verification table (1 hour expiry)
  - Sends email
  - Returns success or error

// Verify reset token
GET /api/auth/verify-reset-token/:token
  - Checks if token exists
  - Checks if expired
  - Returns valid/invalid status

// Reset password
POST /api/auth/reset-password
  - Validates token
  - Checks expiration
  - Hashes new password
  - Updates account table
  - Deletes token
  - Invalidates sessions
  - Returns success or error
```

## Frontend Implementation Example

```javascript
// Request password reset
async function requestPasswordReset(email) {
  const response = await fetch('/api/auth/request-password-reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  });

  const data = await response.json();

  if (data.success) {
    showMessage('Check your email for password reset link');
  } else {
    showError(data.message);
  }
}

// On password reset page (URL: /auth?mode=reset&token=xxx)
async function handlePasswordResetPage() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');

  // Verify token
  const response = await fetch(`/api/auth/verify-reset-token/${token}`);
  const data = await response.json();

  if (!data.valid) {
    showError('This password reset link has expired');
    return;
  }

  // Show password form
  const newPassword = await showPasswordForm();

  // Reset password
  const resetResponse = await fetch('/api/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, password: newPassword })
  });

  const resetData = await resetResponse.json();

  if (resetResponse.ok) {
    showMessage('Password reset successfully! Redirecting to sign in...');
    setTimeout(() => window.location.href = '/login', 2000);
  } else {
    showError(resetData.message);
  }
}
```

## Production Deployment Checklist

Before deploying:

- [ ] EMAIL_PROVIDER set to `smtp`, `sendgrid`, or `resend` (not `console`)
- [ ] EMAIL_FROM verified with email provider
- [ ] FRONTEND_URL points to production domain
- [ ] NODE_ENV set to `production`
- [ ] API keys in secure secrets manager
- [ ] SMTP credentials correct
- [ ] Rate limiting configured
- [ ] Monitoring alerts set up
- [ ] Email templates reviewed
- [ ] Support email configured
- [ ] Privacy policy updated
- [ ] Terms of service updated

## References

- **EMAIL_SETUP_GUIDE.md** - Full email provider setup
- **EMAIL_QUICK_START.md** - Quick reference
- **PASSWORD_RECOVERY_GUIDE.md** - System architecture
- **AUTHENTICATION_TROUBLESHOOTING.md** - General auth issues
- **.env.example** - Configuration template

## Support

For issues:
1. Check server logs: `npm run dev 2>&1 | grep -i email`
2. Review EMAIL_SETUP_GUIDE.md troubleshooting section
3. Verify environment variables: `cat .env | grep EMAIL`
4. Test email provider directly (Gmail/SendGrid/Resend dashboard)
