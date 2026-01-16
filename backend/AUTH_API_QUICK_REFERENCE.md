# Authentication API Quick Reference

## Sign Up (2-Step Process)

### Step 1: Create Account
```bash
POST /api/auth/sign-up/email
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "name": "Full Name"
}
```

### Step 2: Complete Profile
```bash
POST /api/auth/complete-profile
Authorization: Bearer <session-token>
Content-Type: application/json

{
  "username": "uniqueusername",
  "displayName": "Display Name",
  "inviteCode": "BETA2026",  // optional
  "bio": "User bio",          // optional
  "location": "City, Country" // optional
}
```

## Sign In
```bash
POST /api/auth/sign-in/email
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "rememberMe": true
}
```

## Get Current User
```bash
GET /api/auth/me
Authorization: Bearer <session-token>
```

Returns:
```json
{
  "user": {
    "id": "...",
    "email": "user@example.com",
    "name": "Full Name"
  },
  "profile": {
    "id": "...",
    "username": "uniqueusername",
    "displayName": "Display Name",
    "email": "user@example.com",
    "avatarUrl": "https://...",
    "bio": "...",
    "location": "...",
    "collectionPrivacy": "public",
    "role": "user"
  }
}
```

## Validate Invite Code
```bash
POST /api/auth/validate-invite
Content-Type: application/json

{
  "inviteCode": "BETA2026"
}
```

## Update Profile
```bash
PATCH /api/auth/profile
Authorization: Bearer <session-token>
Content-Type: application/json

{
  "displayName": "New Name",
  "bio": "New bio",
  "location": "New location",
  "collectionPrivacy": "private"
}
```

## Sign Out
```bash
POST /api/auth/sign-out
Authorization: Bearer <session-token>
```

## Field Validation

| Field | Min | Max | Required |
|-------|-----|-----|----------|
| email | 5 | 255 | Yes |
| password | 8 | 255 | Yes* |
| name | 1 | 255 | Yes** |
| username | 3 | 30 | Yes |
| displayName | 1 | 100 | Yes |
| bio | - | 500 | No |
| location | - | 100 | No |
| inviteCode | 1 | - | No |

*Required for sign up only
**Required for sign up, optional for updates

## Invite Code Validation

Code is valid if:
- ✓ Code exists in database
- ✓ isActive = true
- ✓ Not expired (expiresAt = null OR expiresAt > now)
- ✓ Usage available (usageLimit = null OR usageCount < usageLimit)

## Common Errors

| Code | Message | Solution |
|------|---------|----------|
| 400 | Username already taken | Choose different username |
| 400 | Invalid invite code | Check code spelling |
| 400 | Invite code expired | Request new code |
| 400 | Usage limit reached | Code has been fully used |
| 401 | Unauthorized | Include session token |
| 503 | Database error | Retry request |

## HTTP Headers

### Required Headers
```
Content-Type: application/json
Authorization: Bearer <session-token>  // For protected endpoints
```

### Set by Server
```
Set-Cookie: session=...; HttpOnly; Secure; Path=/
```

## Session Management

- Sessions auto-managed by Better Auth
- Stored in secure cookies (httpOnly, Secure flags)
- No manual token management needed
- Browser automatically sends cookies with requests
- Sessions expire after inactivity

## Complete Signup Example

```javascript
// 1. Sign up
const signUp = await fetch('/api/auth/sign-up/email', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'MySecurePass123!',
    name: 'John Collector'
  })
});

// 2. Validate invite (optional)
const validate = await fetch('/api/auth/validate-invite', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ inviteCode: 'BETA2026' })
});

// 3. Complete profile
const profile = await fetch('/api/auth/complete-profile', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    username: 'johncollector',
    displayName: 'John Collector',
    inviteCode: 'BETA2026',
    location: 'New York, USA'
  })
});

// 4. Get current user
const me = await fetch('/api/auth/me');
console.log(await me.json());
```

## Reset Password

Better Auth provides password reset endpoints:
```bash
POST /api/auth/forgot-password
POST /api/auth/reset-password
```

See Better Auth documentation for details.

## Email Verification

Better Auth includes email verification:
```bash
POST /api/auth/send-verification-email
POST /api/auth/verify-email
```

## Data Flow

```
Sign Up Request
       ↓
Better Auth Service
       ↓
Session Created & Token Issued
       ↓
Complete Profile Request + Token
       ↓
CoinHub User Profile Created
       ↓
User Can Access Protected Routes
```

## Authentication on Frontend

### React Example
```javascript
import { useEffect, useState } from 'react';

function useAuth() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(data => {
        setUser(data.user);
        setProfile(data.profile);
      });
  }, []);

  return { user, profile };
}

// Usage
function App() {
  const { user, profile } = useAuth();
  return profile ? <Dashboard /> : <SignUpForm />;
}
```

## Testing

### Create Test User
```bash
curl -X POST http://localhost:3000/api/auth/sign-up/email \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPass123!",
    "name": "Test User"
  }'
```

### Complete Profile
```bash
curl -X POST http://localhost:3000/api/auth/complete-profile \
  -H "Content-Type: application/json" \
  -b "session=<session-token>" \
  -d '{
    "username": "testuser",
    "displayName": "Test User",
    "inviteCode": "BETA2026"
  }'
```

### Get Current User
```bash
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer <session-token>"
```
