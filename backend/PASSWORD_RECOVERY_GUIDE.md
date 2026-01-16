# CoinHub Password Recovery System

Complete guide for implementing and using password recovery functionality.

## Overview

CoinHub provides a secure password recovery system that allows users to reset forgotten passwords through email verification. The system uses time-limited tokens (1-hour expiration) stored in the database.

### Key Features

- ✅ Secure token generation with UUID
- ✅ 1-hour token expiration
- ✅ Email validation before token creation
- ✅ Email enumeration prevention (same response for existing/non-existing emails)
- ✅ Password hashing with bcrypt
- ✅ Session invalidation after password reset (user must sign in again)
- ✅ Comprehensive security logging
- ✅ Development mode debugging support

## Architecture

### Data Flow

```
User Request
    ↓
[POST /api/auth/request-password-reset] with email
    ↓
User exists check (case-insensitive)
    ↓
Generate UUID token (expires in 1 hour)
    ↓
Store in verification table with identifier
    ↓
Return generic success message (always)
    ↓
[User receives email with reset link] (in production)
    ↓
User clicks link → /reset-password?token=xxx
    ↓
[GET /api/auth/verify-reset-token/:token] - validate token
    ↓
[Display password reset form if token valid]
    ↓
User enters new password
    ↓
[POST /api/auth/reset-password] with token + new password
    ↓
Token validation & expiration check
    ↓
Hash new password with bcrypt
    ↓
Update user's password in account table
    ↓
Delete reset token
    ↓
Invalidate all user sessions
    ↓
Return success message
    ↓
User signs in with new password
```

## Database Schema

### Verification Table (Better Auth)

Used to store password reset tokens:

```sql
CREATE TABLE verification (
  id TEXT PRIMARY KEY,
  identifier TEXT NOT NULL,           -- Email address
  value TEXT NOT NULL,                -- Reset token (UUID)
  expiresAt TIMESTAMP NOT NULL,       -- Token expiration time
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW()
);
```

### Account Table (Better Auth)

Stores password hashes:

```sql
CREATE TABLE account (
  id TEXT PRIMARY KEY,
  accountId TEXT NOT NULL,
  providerId TEXT NOT NULL,           -- 'password' for email/password auth
  userId TEXT NOT NULL REFERENCES user(id),
  password TEXT,                      -- bcrypt hash
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW()
);
```

## API Endpoints

### 1. Request Password Reset

**POST** `/api/auth/request-password-reset`

User initiates password recovery by providing their email.

**Request**:
```json
{
  "email": "user@example.com"
}
```

**Request Headers**:
- `Content-Type: application/json`

**Response** (200 OK - ALWAYS returns 200 for security):
```json
{
  "message": "If an account exists with this email, a password reset link will be sent shortly"
}
```

**Development Mode Response** (includes debugging info):
```json
{
  "message": "If an account exists with this email, a password reset link will be sent shortly",
  "debug": {
    "token": "550e8400-e29b-41d4-a716-446655440000",
    "expiresAt": "2024-01-15T11:00:00Z",
    "resetLink": "http://localhost:3000/reset-password?token=550e8400-e29b-41d4-a716-446655440000"
  }
}
```

**Error Responses**:

| Code | Reason | Response |
|------|--------|----------|
| 400 | Invalid email format | `{ "error": "Validation failed", "message": "Please provide a valid email address" }` |
| 500 | Server error | `{ "error": "Server error", "message": "Failed to process password reset request" }` |

**Logging**:
- `app.logger.info({ email }, 'Password reset request received')`
- `app.logger.info({ userId, email }, 'Password reset token generation started')`
- `app.logger.info({ userId, email }, 'Password reset token generated and stored successfully')`
- `app.logger.warn({ email }, 'Password reset requested for non-existent email')`
- `app.logger.error({ userId, email }, 'Failed to generate password reset token')`

**Security Notes**:
- Always returns 200 with generic message (prevents email enumeration)
- Email is normalized to lowercase before checking
- Non-existent emails are still logged (for debugging)
- Reset tokens stored in database (not sent in response)

### 2. Verify Reset Token

**GET** `/api/auth/verify-reset-token/:token`

Validate that a reset token exists and hasn't expired. Use this before showing the password reset form.

**Request**:
```
GET /api/auth/verify-reset-token/550e8400-e29b-41d4-a716-446655440000
```

**Response** (200 OK - token valid):
```json
{
  "valid": true,
  "email": "user@example.com"
}
```

**Response** (200 OK - token invalid/expired):
```json
{
  "valid": false,
  "message": "This password reset link is invalid or has expired"
}
```

**Error Responses**:

| Code | Reason | Response |
|------|--------|----------|
| 500 | Server error | `{ "error": "Server error", "message": "Failed to verify reset token" }` |

**Logging**:
- `app.logger.info({ token }, 'Verifying password reset token')`
- `app.logger.warn({ token }, 'Reset token not found')`
- `app.logger.warn({ token, expiresAt }, 'Reset token has expired')`
- `app.logger.info({ token }, 'Reset token is valid')`
- `app.logger.error({ token }, 'Failed to verify reset token')`

**Frontend Usage**:
```javascript
// Check token validity before showing password reset form
const response = await fetch(`/api/auth/verify-reset-token/${token}`);
const data = await response.json();

if (data.valid) {
  // Show password reset form
  showResetForm(data.email);
} else {
  // Show error message
  showError('This password reset link is invalid or has expired. Please request a new one.');
}
```

### 3. Reset Password

**POST** `/api/auth/reset-password`

Submit new password with reset token to complete password recovery.

**Request**:
```json
{
  "token": "550e8400-e29b-41d4-a716-446655440000",
  "password": "newSecurePassword123"
}
```

**Request Headers**:
- `Content-Type: application/json`

**Response** (200 OK - password reset successfully):
```json
{
  "message": "Password has been reset successfully. Please sign in with your new password."
}
```

**Error Responses**:

| Code | Reason | Response |
|------|--------|----------|
| 400 | Invalid/missing token | `{ "error": "Invalid reset token", "message": "This password reset link is invalid or has expired" }` |
| 400 | Token expired | `{ "error": "Reset link expired", "message": "This password reset link has expired. Please request a new one." }` |
| 400 | Validation error | `{ "error": "Validation failed", "details": [...], "message": "Please provide a valid reset token and password" }` |
| 500 | Server error | `{ "error": "Server error", "message": "Failed to reset password" }` |

**Logging**:
- `app.logger.info({ tokenProvided }, 'Password reset attempt')`
- `app.logger.info({ userId, email }, 'Resetting password for user')`
- `app.logger.info({ userId }, 'Password updated in existing account')`
- `app.logger.info({ userId }, 'All sessions invalidated after password reset')`
- `app.logger.info({ userId, email }, 'Password reset completed successfully')`
- `app.logger.warn({ token }, 'Password reset token not found')`
- `app.logger.warn({ token, expiresAt }, 'Password reset token has expired')`
- `app.logger.error({ userId }, 'Failed to hash new password')`

**What Happens**:
1. Token is validated and checked for expiration
2. User is looked up by email (from verification record)
3. New password is hashed using bcrypt
4. Password hash is updated in account table
5. Reset token is deleted from verification table
6. All user sessions are invalidated (forces user to sign in again)
7. Success response is returned

**Security Notes**:
- Password must be at least 6 characters
- Old sessions are invalidated (logged-out everywhere)
- Token is deleted after use (one-time use only)
- Expired tokens are automatically cleaned up

## Frontend Implementation

### Example: Complete Password Recovery Flow

```javascript
// Step 1: Request password reset
async function requestPasswordReset(email) {
  const response = await fetch('/api/auth/request-password-reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  });

  if (response.ok) {
    showMessage('If an account exists with this email, a reset link will be sent shortly');
    // In development, response.debug will contain the reset token
  } else {
    const error = await response.json();
    showError(error.message);
  }
}

// Step 2: Verify token before showing form
async function verifyResetToken(token) {
  const response = await fetch(`/api/auth/verify-reset-token/${token}`);
  const data = await response.json();
  return data;
}

// Step 3: Reset password
async function resetPassword(token, password) {
  const response = await fetch('/api/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, password })
  });

  if (response.ok) {
    showMessage('Password reset successfully! Please sign in with your new password.');
    redirect('/login');
  } else {
    const error = await response.json();
    showError(error.message);
  }
}

// On password reset page load
async function handlePasswordResetPage(token) {
  const verification = await verifyResetToken(token);

  if (!verification.valid) {
    showError(verification.message);
    showLinkToRequestNewReset();
    return;
  }

  // Show password reset form
  showPasswordResetForm(async (newPassword) => {
    await resetPassword(token, newPassword);
  });
}
```

### Complete UI Flow

```
┌─────────────────────────────────────────┐
│  Sign In Page                           │
│  [Email] [Password]                     │
│  [Sign In Button]                       │
│  [Forgot Password Link]                 │
└─────────────────────────────────────────┘
           ↓ Click "Forgot Password"
┌─────────────────────────────────────────┐
│  Request Password Reset Page            │
│  [Enter your email]                     │
│  [Email Input Field]                    │
│  [Send Reset Link Button]               │
└─────────────────────────────────────────┘
           ↓ Submit email
┌─────────────────────────────────────────┐
│  Success Message                        │
│  "Check your email for reset link"      │
│  [Back to Sign In]                      │
└─────────────────────────────────────────┘
           ↓ User checks email and clicks link
┌─────────────────────────────────────────┐
│  Reset Password Page                    │
│  (token from URL: ?token=xxx)           │
│                                         │
│  [Verify token with API]                │
│  ↓                                       │
│  If valid:                              │
│  [New Password Input]                   │
│  [Confirm Password Input]               │
│  [Reset Password Button]                │
│                                         │
│  If invalid:                            │
│  "This link has expired"                │
│  [Request new reset link]               │
└─────────────────────────────────────────┘
           ↓ Submit new password
┌─────────────────────────────────────────┐
│  Success Message                        │
│  "Password reset successfully!"         │
│  "Sign in with your new password"       │
│  [Redirect to Sign In in 3 seconds]     │
└─────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────┐
│  Sign In Page (fresh session)           │
│  [Email] [Password]                     │
│  [Sign In Button]                       │
└─────────────────────────────────────────┘
```

## Email Template (Production)

When implemented with email sending, the password reset email should include:

```html
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .button { background-color: #4CAF50; color: white; padding: 12px 30px;
              text-decoration: none; border-radius: 4px; display: inline-block; }
    .warning { color: #d32f2f; margin: 10px 0; }
    .footer { color: #666; font-size: 12px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <h2>Password Reset Request</h2>

    <p>Hi [User Name],</p>

    <p>We received a request to reset your CoinHub password.
       Click the button below to create a new password.</p>

    <p style="text-align: center; margin: 30px 0;">
      <a href="https://coinhub.example.com/reset-password?token=[TOKEN]" class="button">
        Reset Password
      </a>
    </p>

    <p>Or copy and paste this link in your browser:</p>
    <p style="word-break: break-all; background: #f5f5f5; padding: 10px;">
      https://coinhub.example.com/reset-password?token=[TOKEN]
    </p>

    <p class="warning">
      ⚠️ This link will expire in 1 hour for security reasons.
    </p>

    <p class="warning">
      ⚠️ If you didn't request a password reset, you can safely ignore this email.
      Your account is secure.
    </p>

    <hr>

    <p class="footer">
      This is an automated message from CoinHub. Please do not reply to this email.<br>
      © 2024 CoinHub. All rights reserved.
    </p>
  </div>
</body>
</html>
```

**Email Subject**:
```
CoinHub Password Reset - Expires in 1 Hour
```

## Security Considerations

### 1. Token Security
- ✅ Tokens are random UUIDs (128-bit entropy)
- ✅ Tokens expire after 1 hour
- ✅ Tokens are stored in database, not sent via email query parameter (frontend receives via URL for usability)
- ✅ Tokens are deleted after use
- ⚠️ TODO: Consider using shorter random strings or JWTs for production

### 2. Email Security
- ✅ Email lookup is case-insensitive
- ✅ Same response for existing/non-existing emails (prevents enumeration)
- ⚠️ TODO: Implement SMTP with TLS for production
- ⚠️ TODO: Add rate limiting (prevent spam/abuse)

### 3. Password Security
- ✅ New passwords are hashed with bcrypt (rounds: 10)
- ✅ Old sessions are invalidated (forced sign-in)
- ✅ Minimum password length enforced (6 characters)
- ⚠️ TODO: Add password strength requirements in production

### 4. Session Security
- ✅ All user sessions deleted after password reset
- ✅ User must sign in again with new password
- ⚠️ TODO: Consider sending email notification when password is changed

### 5. Logging Security
- ✅ All requests logged with context
- ✅ Email addresses logged (for audit trails)
- ✅ No passwords logged
- ✅ No tokens logged in response body
- ⚠️ TODO: Implement log retention policy
- ⚠️ TODO: Anonymize logs after 90 days

## Debugging Password Reset Issues

### Issue 1: "Password reset token not found"

**Cause**: Token doesn't exist in verification table or was already used.

**Debug Steps**:
1. Check if token was generated: `SELECT * FROM verification WHERE value = 'token-here';`
2. Verify token hasn't been used: Token should still exist
3. Check token expiration: `SELECT expiresAt FROM verification WHERE value = 'token-here';`

**Fix**:
- Have user request a new password reset
- Check logs for "Password reset token generation" messages

### Issue 2: "Reset link has expired"

**Cause**: Token's expiresAt timestamp is in the past.

**Debug Steps**:
1. Check token expiration: `SELECT expiresAt, NOW() FROM verification WHERE value = 'token-here';`
2. Verify 1-hour expiration window: `expiresAt` should be 1 hour after creation

**Fix**:
- Have user request a new password reset
- Check system clock synchronization

### Issue 3: "User not found for password reset token"

**Cause**: Verification record exists but user email doesn't match any account.

**Debug Steps**:
1. Check verification record: `SELECT * FROM verification WHERE value = 'token-here';`
2. Look up user by identifier: `SELECT * FROM "user" WHERE email = '[identifier]';`
3. Check email case: `SELECT * FROM "user" WHERE LOWER(email) = LOWER('[identifier]');`

**Fix**:
- Check email in verification table
- Ensure database has user with that email
- Consider case-sensitivity issues

### Issue 4: "No password account found for user"

**Cause**: User exists but has no password account (OAuth only user).

**Debug Steps**:
1. Check accounts for user: `SELECT * FROM account WHERE user_id = 'user-id';`
2. Check providerId: Should have 'password' provider

**Fix**:
- This is handled gracefully (creates new password account)
- Check logs for "creating one" message

### Issue 5: "Failed to hash new password"

**Cause**: bcrypt library error or password too long.

**Debug Steps**:
1. Check password length: Max 72 characters for bcrypt
2. Check bcryptjs availability: `npm list bcryptjs`
3. Check system memory: Hashing requires memory

**Fix**:
- Ensure password is under 72 characters
- Reinstall bcryptjs: `npm install bcryptjs`
- Check available memory

## Development vs Production

### Development Mode

```javascript
// Password reset request returns debug info
POST /api/auth/request-password-reset
→ {
    message: "...",
    debug: {
      token: "...",
      expiresAt: "...",
      resetLink: "http://localhost:3000/reset-password?token=..."
    }
  }
```

**Enabled when**: `process.env.NODE_ENV === 'development'`

**Use for**: Testing password recovery without email setup

### Production Mode

- Debug info is NOT returned
- Email sending is enabled
- Rate limiting should be enabled
- Tokens expire in 1 hour
- All requests are logged to database/service

## Production Checklist

Before deploying password recovery to production:

- [ ] Email service configured (SMTP, SendGrid, AWS SES, etc.)
- [ ] Email templates designed and tested
- [ ] Reset link domain configured correctly
- [ ] Rate limiting implemented (e.g., max 5 reset requests per email per hour)
- [ ] Tokens stored securely (already in database)
- [ ] Password hashing verified (bcryptjs rounds: 10)
- [ ] Session invalidation working
- [ ] Logs aggregated to service (Datadog, CloudWatch, etc.)
- [ ] User notification on suspicious password changes
- [ ] HTTPS enforced
- [ ] Database backups working
- [ ] Monitoring alerts configured
- [ ] Privacy policy updated
- [ ] Terms of service updated

## Testing Password Recovery

### Test 1: Valid Password Reset

```bash
# Request reset
curl -X POST http://localhost:3000/api/auth/request-password-reset \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'

# Extract token from response (development mode)
TOKEN="..."

# Verify token
curl http://localhost:3000/api/auth/verify-reset-token/$TOKEN

# Reset password
curl -X POST http://localhost:3000/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d "{\"token\":\"$TOKEN\",\"password\":\"newPassword123\"}"

# Try signing in with new password
curl -X POST http://localhost:3000/api/auth/sign-in/email \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"newPassword123"}'
```

Expected: Success response, user signed in

### Test 2: Expired Token

```bash
# Request reset and wait 1 hour (or set CURRENT_TIMESTAMP to 1+ hours later in DB)
# Then try to reset password with expired token

curl -X POST http://localhost:3000/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d "{\"token\":\"$TOKEN\",\"password\":\"newPassword123\"}"
```

Expected: 400 error "Reset link expired"

### Test 3: Invalid Token

```bash
curl -X POST http://localhost:3000/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{"token":"invalid-token-here","password":"newPassword123"}'
```

Expected: 400 error "Invalid reset token"

### Test 4: Non-existent Email

```bash
curl -X POST http://localhost:3000/api/auth/request-password-reset \
  -H "Content-Type: application/json" \
  -d '{"email":"nonexistent@example.com"}'
```

Expected: 200 success (generic message, no indication email doesn't exist)

## Common Issues and Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| Tokens not storing | DB permission issue | Check `verification` table exists and permissions |
| Emails not sending | SMTP not configured | Implement email service, test in development mode |
| Sessions not invalidating | Query issue | Verify `DELETE FROM session WHERE user_id = '...'` works |
| Old password still works | Hash not updated | Check `account.password` is being updated |
| Token expires too fast | Wrong expiration time | Verify: `Date.now() + 3600000` (1 hour = 3,600,000 ms) |
| Can't sign in after reset | Session still cached | Clear browser cookies/cache |

## References

- Better Auth Documentation: https://better-auth.com/docs
- bcryptjs: https://github.com/dcodeIO/bcrypt.js
- OWASP Password Reset: https://owasp.org/www-community/controls/Password_reset
- RFC 6238 (OTP): https://tools.ietf.org/html/rfc6238
