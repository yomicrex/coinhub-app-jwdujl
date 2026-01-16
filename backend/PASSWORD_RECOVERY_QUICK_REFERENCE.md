# Password Recovery - Quick Reference

Quick reference guide for implementing password recovery in your frontend.

## API Endpoints

### 1. Request Password Reset
```
POST /api/auth/request-password-reset
Content-Type: application/json

{
  "email": "user@example.com"
}

Response (200 OK - always):
{
  "message": "If an account exists with this email, a password reset link will be sent shortly",
  "debug": {  // Development only
    "token": "550e8400-e29b-41d4-a716-446655440000",
    "expiresAt": "2024-01-15T11:00:00Z",
    "resetLink": "http://localhost:3000/reset-password?token=..."
  }
}
```

### 2. Verify Reset Token
```
GET /api/auth/verify-reset-token/{token}

Response (200 OK - valid):
{
  "valid": true,
  "email": "user@example.com"
}

Response (200 OK - invalid/expired):
{
  "valid": false,
  "message": "This password reset link is invalid or has expired"
}
```

### 3. Reset Password
```
POST /api/auth/reset-password
Content-Type: application/json

{
  "token": "550e8400-e29b-41d4-a716-446655440000",
  "password": "newSecurePassword123"
}

Response (200 OK):
{
  "message": "Password has been reset successfully. Please sign in with your new password."
}

Error Responses:
400 - Invalid/expired token: { "error": "Invalid reset token", "message": "..." }
400 - Validation error: { "error": "Validation failed", "details": [...] }
500 - Server error: { "error": "Server error", "message": "..." }
```

## Frontend Implementation

### Basic Flow

```javascript
import { useState } from 'react';

// Step 1: Request password reset
async function handleForgotPassword(email) {
  const response = await fetch('/api/auth/request-password-reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  });

  if (response.ok) {
    // Show success message
    showMessage('Check your email for a password reset link');
    const data = await response.json();

    // Development: Show token for testing
    if (data.debug) {
      showDebugInfo(data.debug);
    }
  } else {
    const error = await response.json();
    showError(error.message);
  }
}

// Step 2: On password reset page, verify token
async function loadResetPage(token) {
  const response = await fetch(`/api/auth/verify-reset-token/${token}`);
  const data = await response.json();

  if (!data.valid) {
    showError(data.message);
    showLinkToRequestNewReset();
    return;
  }

  // Token is valid, show password reset form
  showPasswordResetForm(async (newPassword) => {
    await resetPassword(token, newPassword);
  });
}

// Step 3: Submit new password
async function handleResetPassword(token, newPassword) {
  const response = await fetch('/api/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token,
      password: newPassword
    })
  });

  if (response.ok) {
    showMessage('Password reset successfully! Redirecting to sign in...');
    setTimeout(() => {
      window.location.href = '/login';
    }, 2000);
  } else {
    const error = await response.json();
    showError(error.message);
  }
}
```

### React Component Example

```jsx
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

export function PasswordResetPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [step, setStep] = useState('initial'); // initial, verify, form, success
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Verify token on page load
  useEffect(() => {
    if (token) {
      verifyToken();
    }
  }, [token]);

  async function verifyToken() {
    setLoading(true);
    try {
      const response = await fetch(`/api/auth/verify-reset-token/${token}`);
      const data = await response.json();

      if (data.valid) {
        setEmail(data.email);
        setStep('form');
      } else {
        setError(data.message);
        setStep('invalid');
      }
    } catch (err) {
      setError('Failed to verify reset link');
      setStep('error');
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword(e) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/request-password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      if (response.ok) {
        setStep('email-sent');
      } else {
        const data = await response.json();
        setError(data.message);
      }
    } catch (err) {
      setError('Failed to request password reset');
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword(e) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password })
      });

      if (response.ok) {
        setStep('success');
        setTimeout(() => {
          window.location.href = '/login';
        }, 3000);
      } else {
        const data = await response.json();
        setError(data.message);
      }
    } catch (err) {
      setError('Failed to reset password');
    } finally {
      setLoading(false);
    }
  }

  if (step === 'initial') {
    return (
      <div className="reset-container">
        <h2>Forgot Your Password?</h2>
        <form onSubmit={handleForgotPassword}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            required
          />
          <button type="submit" disabled={loading}>
            {loading ? 'Sending...' : 'Send Reset Link'}
          </button>
        </form>
        {error && <div className="error">{error}</div>}
      </div>
    );
  }

  if (step === 'email-sent') {
    return (
      <div className="reset-container">
        <h2>Check Your Email</h2>
        <p>We've sent a password reset link to:</p>
        <p className="email">{email}</p>
        <p>Click the link in the email to reset your password.</p>
        <p className="note">⚠️ The link expires in 1 hour for security.</p>
        <button onClick={() => setStep('initial')}>
          Didn't receive email? Try again
        </button>
      </div>
    );
  }

  if (step === 'form' && token) {
    return (
      <div className="reset-container">
        <h2>Reset Your Password</h2>
        <form onSubmit={handleResetPassword}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter new password"
            minLength={6}
            required
          />
          <button type="submit" disabled={loading}>
            {loading ? 'Resetting...' : 'Reset Password'}
          </button>
        </form>
        {error && <div className="error">{error}</div>}
      </div>
    );
  }

  if (step === 'success') {
    return (
      <div className="reset-container">
        <h2>Success!</h2>
        <p>Your password has been reset successfully.</p>
        <p>Redirecting to sign in...</p>
      </div>
    );
  }

  if (step === 'invalid') {
    return (
      <div className="reset-container">
        <h2>Invalid Reset Link</h2>
        <p className="error">{error}</p>
        <a href="/forgot-password">Request a new password reset</a>
      </div>
    );
  }

  return <div className="reset-container"><p>Loading...</p></div>;
}
```

## Testing Checklist

- [ ] Request reset with valid email → Get success response
- [ ] Request reset with invalid email → Get success response (no leak)
- [ ] Get token from development response
- [ ] Verify token → Valid response with email
- [ ] Reset password with valid token → Success
- [ ] Try to reset again with same token → Fails (token deleted)
- [ ] Try to reset with invalid token → Error
- [ ] Try to reset after 1 hour → Token expired error
- [ ] After reset, sign in with old password → Fails
- [ ] After reset, sign in with new password → Success
- [ ] Check all sessions invalidated after reset

## Common Issues

**Token not returning in response**
→ Node not in development mode, or debug tokens disabled

**Password reset succeeds but old password still works**
→ Password hash not being updated, check account table

**"This password reset link is invalid"**
→ Token doesn't exist or was already used

**Password reset hangs or times out**
→ Check bcrypt installation: `npm list bcryptjs`

**Can't sign in after password reset**
→ Sessions were invalidated, sign in again with new password

## Security Checklist

- [ ] Token generated as random UUID (128-bit entropy)
- [ ] Token expires after 1 hour
- [ ] Token deleted after successful use
- [ ] Password hashed with bcrypt (10 rounds)
- [ ] Password never logged or exposed
- [ ] All sessions invalidated after reset
- [ ] Email not revealed if non-existent
- [ ] HTTPS required in production
- [ ] Rate limiting implemented
- [ ] Email notifications sent (production)

## curl Commands for Testing

```bash
# Request password reset
curl -X POST http://localhost:3000/api/auth/request-password-reset \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'

# Extract token from response (development mode)
TOKEN="550e8400-e29b-41d4-a716-446655440000"

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

## Email Template (Plain Text)

```
Subject: CoinHub Password Reset - Expires in 1 Hour

Hi User,

We received a request to reset your CoinHub password.
Click the link below to create a new password.

https://coinhub.example.com/reset-password?token=550e8400-e29b-41d4-a716-446655440000

This link will expire in 1 hour for security reasons.

⚠️ If you didn't request a password reset, you can safely ignore this email.
Your account is secure.

---

This is an automated message from CoinHub.
Do not reply to this email.

© 2024 CoinHub. All rights reserved.
```

## Email Template (HTML)

See `PASSWORD_RECOVERY_GUIDE.md` for full HTML template with styling.

## Next Steps

1. **Implement frontend**: Use React component example above
2. **Test with curl**: Run commands to verify each step
3. **Set up email** (production): Send reset emails with link
4. **Add rate limiting**: Prevent abuse of reset endpoint
5. **Monitor resets**: Track password reset metrics
6. **Update privacy policy**: Describe password recovery process
