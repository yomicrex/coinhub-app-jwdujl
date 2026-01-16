# CoinHub Authentication API Reference

Complete reference for all authentication-related endpoints.

## Better Auth Endpoints (Auto-Provided)

These endpoints are automatically provided by Better Auth and **MUST NOT** be manually created.

### Sign-Up

**POST** `/api/auth/sign-up/email`

Create a new user account with email and password.

**Request**:
```json
{
  "email": "user@example.com",
  "password": "secure_password",
  "name": "John Doe"
}
```

**Request Headers**:
- `Content-Type: application/json`

**Response** (200 OK):
```json
{
  "user": {
    "id": "clxt123abc...",
    "email": "user@example.com",
    "name": "John Doe",
    "emailVerified": false,
    "image": null,
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  },
  "session": {
    "id": "session123...",
    "token": "eyJhbGc...",
    "expiresAt": "2024-02-15T10:30:00Z",
    "ipAddress": "192.168.1.1",
    "userAgent": "Mozilla/5.0..."
  }
}
```

**Response Headers**:
- `Set-Cookie: session-token-xxx=...; Path=/; HttpOnly; Secure; SameSite=Strict`

**Error Responses**:

| Code | Reason | Response |
|------|--------|----------|
| 400 | Invalid email format | `{ "error": "Invalid email" }` |
| 400 | Password too short | `{ "error": "Password must be at least 8 characters" }` |
| 409 | Email already registered | `{ "error": "Email already exists" }` |
| 500 | Server error | `{ "error": "Internal server error" }` |

**Logging**:
- Framework logs: "User sign up with email: user@example.com"
- Success: User created in database, session created, HTTPOnly cookie set

### Sign-In

**POST** `/api/auth/sign-in/email`

Authenticate with email and password to create a new session.

**Request**:
```json
{
  "email": "user@example.com",
  "password": "secure_password"
}
```

**Request Headers**:
- `Content-Type: application/json`

**Response** (200 OK):
```json
{
  "user": {
    "id": "clxt123abc...",
    "email": "user@example.com",
    "name": "John Doe",
    "emailVerified": false,
    "image": null,
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  },
  "session": {
    "id": "session456...",
    "token": "eyJhbGc...",
    "expiresAt": "2024-02-15T11:00:00Z",
    "ipAddress": "192.168.1.1",
    "userAgent": "Mozilla/5.0..."
  }
}
```

**Response Headers**:
- `Set-Cookie: session-token-xxx=...; Path=/; HttpOnly; Secure; SameSite=Strict`

**Error Responses**:

| Code | Reason | Response |
|------|--------|----------|
| 400 | Invalid email | `{ "error": "Invalid credentials" }` |
| 400 | Invalid password | `{ "error": "Invalid credentials" }` |
| 404 | User not found | `{ "error": "Invalid credentials" }` |
| 500 | Server error | `{ "error": "Internal server error" }` |

**Logging**:
- Framework logs: "User sign in with email: user@example.com"
- Success: New session created, HTTPOnly cookie set

### Sign-Out

**POST** `/api/auth/sign-out`

Sign out the current user and invalidate their session.

**Request**: (empty body)

**Request Headers**:
- `Content-Type: application/json`
- `Cookie: session-token-xxx=...` (automatically sent by browser)

**Response** (200 OK):
```json
{
  "ok": true
}
```

**Response Headers**:
- `Set-Cookie: session-token-xxx=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`

**Error Responses**:

| Code | Reason | Response |
|------|--------|----------|
| 401 | No active session | `{ "error": "Unauthorized" }` |
| 500 | Server error | `{ "error": "Internal server error" }` |

**Logging**:
- Framework logs: "User sign out: [userId]"
- Success: Session invalidated in database, cookie cleared

## CoinHub Custom Endpoints

These are custom endpoints that extend Better Auth with CoinHub-specific functionality.

### Validate Invite Code

**POST** `/api/auth/validate-invite`

Validate an invite code before registration (optional, for frontend validation).

**Request**:
```json
{
  "inviteCode": "BETA2026"
}
```

**Request Headers**:
- `Content-Type: application/json`

**Response** (200 OK):
```json
{
  "valid": true,
  "message": "Invite code is valid"
}
```

**Error Responses**:

| Code | Reason | Response |
|------|--------|----------|
| 400 | Invalid code | `{ "error": "Invalid invite code" }` |
| 400 | Code expired | `{ "error": "Invite code has expired" }` |
| 400 | Usage limit reached | `{ "error": "Invite code usage limit reached" }` |
| 400 | Code not active | `{ "error": "Invite code is not active" }` |
| 503 | Database error | `{ "error": "Database error" }` |

**Logging**:
- `app.logger.info({ code: "BETA2026" }, "Validating invite code")`
- Success: `app.logger.info({ code: "BETA2026" }, "Invite code validated successfully")`

**Notes**:
- This endpoint does NOT require authentication
- Use this to validate invite codes before showing the profile completion form
- Does not increment usage count (only complete-profile does)

### Get Current User (Protected)

**GET** `/api/auth/me`

Get the currently authenticated user's profile with full CoinHub data.

**Request Headers**:
- `Content-Type: application/json`
- `Cookie: session-token-xxx=...` (automatically sent by browser)

**Response** (200 OK):
```json
{
  "user": {
    "id": "clxt123abc...",
    "email": "user@example.com",
    "name": "John Doe"
  },
  "profile": {
    "id": "clxt123abc...",
    "email": "user@example.com",
    "username": "johndoe",
    "displayName": "John Doe",
    "avatarUrl": "https://storage.example.com/avatars/abc123.jpg?expires=...",
    "bio": "Coin collector from San Francisco",
    "location": "San Francisco",
    "collectionPrivacy": "public",
    "role": "user",
    "inviteCodeUsed": "BETA2026",
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}
```

**Error Responses**:

| Code | Reason | Response |
|------|--------|----------|
| 401 | No active session | `{ "error": "Unauthorized" }` |
| 500 | Server error | `{ "error": "Server error" }` |

**Logging**:
- Attempt: `app.logger.info("Session validation attempt")`
- Success: `app.logger.info({ userId: "...", email: "..." }, "Session validation successful")`
- Failure: `app.logger.info("Session validation failed - no active session")`

**Notes**:
- Requires active session (HTTPOnly cookie)
- Returns both Better Auth user data and CoinHub profile
- Avatar URL is a temporary signed URL that expires in ~15 minutes
- Use this endpoint on app load to restore user state

### Complete Profile (Protected)

**POST** `/api/auth/complete-profile`

Complete the user's CoinHub profile after sign-up. This is required to use CoinHub features.

**Request**:
```json
{
  "username": "johndoe",
  "displayName": "John Doe",
  "inviteCode": "BETA2026",
  "bio": "Coin collector",
  "location": "San Francisco",
  "avatarUrl": "https://storage.example.com/avatars/abc123.jpg"
}
```

**Request Headers**:
- `Content-Type: application/json`
- `Cookie: session-token-xxx=...` (automatically sent by browser)

**Request Body**:
- `username` (required): 3-30 characters, alphanumeric + underscore/hyphen, must be unique
- `displayName` (required): 1-100 characters, can include spaces
- `inviteCode` (optional): Valid invite code to track signup source
- `bio` (optional): Up to 500 characters
- `location` (optional): Up to 100 characters
- `avatarUrl` (optional): Storage key for avatar image

**Response** (200 OK):
```json
{
  "id": "clxt123abc...",
  "email": "user@example.com",
  "username": "johndoe",
  "displayName": "John Doe",
  "avatarUrl": null,
  "bio": "Coin collector",
  "location": "San Francisco",
  "collectionPrivacy": "public",
  "role": "user",
  "inviteCodeUsed": "BETA2026",
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

**Error Responses**:

| Code | Reason | Response |
|------|--------|----------|
| 400 | Validation error | `{ "error": "Validation failed", "details": [...], "message": "Please provide username and displayName" }` |
| 400 | Username invalid | `{ "error": "Validation failed", "message": "Username must be 3-30 characters" }` |
| 400 | Invalid invite code | `{ "error": "Invalid invite code", "message": "The invite code is not valid" }` |
| 400 | Code expired | `{ "error": "Invite code has expired", "message": "This invite code is no longer valid" }` |
| 400 | Usage limit reached | `{ "error": "Invite code usage limit reached", "message": "This invite code has reached its usage limit" }` |
| 401 | Not authenticated | `{ "error": "Unauthorized", "message": "Authentication required" }` |
| 409 | Username taken | `{ "error": "Username already taken", "message": "This username is already in use" }` |
| 500 | Server error | `{ "error": "Server error", "message": "Failed to complete profile" }` |

**Logging**:
- Start: `app.logger.info({ userId: "...", email: "...", username: "johndoe" }, "Profile completion started")`
- Invite validation: `app.logger.info({ userId: "...", code: "BETA2026" }, "Validating invite code")`
- Invite success: `app.logger.info({ userId: "...", code: "BETA2026", newCount: 1 }, "Invite code used successfully")`
- Profile created: `app.logger.info({ userId: "...", username: "johndoe", email: "...", inviteCodeUsed: "BETA2026" }, "User profile created successfully")`
- Complete: `app.logger.info({ userId: "...", username: "johndoe", inviteCodeUsed: "BETA2026", email: "..." }, "Profile completion finished successfully")`

**Notes**:
- Requires active session
- Invite code is optional but recommended
- Username must be globally unique
- Can be called multiple times to update profile (except email)
- Increments invite code usage count on first use

### Update Profile (Protected)

**PATCH** `/api/auth/profile`

Update an existing user's CoinHub profile.

**Request**:
```json
{
  "displayName": "John D",
  "bio": "Passionate coin collector",
  "location": "New York",
  "collectionPrivacy": "private"
}
```

**Request Headers**:
- `Content-Type: application/json`
- `Cookie: session-token-xxx=...` (automatically sent by browser)

**Request Body** (all optional):
- `displayName`: 1-100 characters
- `bio`: Up to 500 characters, can be null
- `location`: Up to 100 characters, can be null
- `avatarUrl`: Storage key for avatar, can be null
- `collectionPrivacy`: 'public' or 'private'

**Response** (200 OK):
```json
{
  "id": "clxt123abc...",
  "email": "user@example.com",
  "username": "johndoe",
  "displayName": "John D",
  "avatarUrl": null,
  "bio": "Passionate coin collector",
  "location": "New York",
  "collectionPrivacy": "private",
  "role": "user",
  "inviteCodeUsed": "BETA2026",
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:35:00Z"
}
```

**Error Responses**:

| Code | Reason | Response |
|------|--------|----------|
| 400 | No fields to update | `{ "error": "No fields to update", "message": "Provide at least one field to update" }` |
| 400 | Validation error | `{ "error": "Validation failed", "details": [...], "message": "Please check the fields and try again" }` |
| 401 | Not authenticated | `{ "error": "Unauthorized", "message": "Authentication required" }` |
| 500 | Server error | `{ "error": "Server error", "message": "Failed to update profile" }` |

**Logging**:
- Start: `app.logger.info({ userId: "..." }, "Profile update started")`
- Success: `app.logger.info({ userId: "...", updatedFields: ["displayName", "bio"] }, "Profile updated successfully")`

**Notes**:
- Requires active session
- At least one field is required
- Does not update username or email (use different endpoints for those)
- All fields are optional, only provided fields are updated

### Health Check (Public)

**GET** `/api/auth/health`

Check if the authentication system is operational.

**Response** (200 OK):
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

**Error Responses**:

| Code | Reason | Response |
|------|--------|----------|
| 503 | Database error | `{ "status": "unhealthy", "error": "Database connectivity issue", "timestamp": "..." }` |

**Notes**:
- Does not require authentication
- Use this to verify backend is running and database is connected
- Good for monitoring and health checks

## Frontend Integration Examples

### Example 1: Sign Up & Complete Profile

```javascript
// Step 1: Sign up
const signUpResponse = await fetch('http://localhost:3000/api/auth/sign-up/email', {
  method: 'POST',
  credentials: 'include', // Important: include cookies
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'secure_password',
    name: 'John Doe'
  })
});

const signUpData = await signUpResponse.json();
// signUpData.user contains the newly created user

// Step 2: Complete profile
const profileResponse = await fetch('http://localhost:3000/api/auth/complete-profile', {
  method: 'POST',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    username: 'johndoe',
    displayName: 'John Doe',
    inviteCode: 'BETA2026',
    bio: 'Coin collector',
    location: 'San Francisco'
  })
});

const profileData = await profileResponse.json();
// profileData contains the complete profile
```

### Example 2: Sign In & Get Profile

```javascript
// Step 1: Sign in
const signInResponse = await fetch('http://localhost:3000/api/auth/sign-in/email', {
  method: 'POST',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'secure_password'
  })
});

const signInData = await signInResponse.json();

// Step 2: Get full profile
const meResponse = await fetch('http://localhost:3000/api/auth/me', {
  method: 'GET',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' }
});

const meData = await meResponse.json();
// meData.user and meData.profile contain everything needed
```

### Example 3: Check Authentication on App Load

```javascript
async function checkAuth() {
  try {
    const response = await fetch('http://localhost:3000/api/auth/me', {
      method: 'GET',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' }
    });

    if (response.status === 401) {
      // Not authenticated
      return null;
    }

    const data = await response.json();
    return data; // { user, profile }
  } catch (error) {
    console.error('Auth check failed:', error);
    return null;
  }
}

// On app load
const auth = await checkAuth();
if (auth) {
  // User is logged in, set user state
  setUser(auth.user);
  setProfile(auth.profile);
} else {
  // User is not logged in, show login page
  showLoginPage();
}
```

### Example 4: Sign Out

```javascript
async function signOut() {
  const response = await fetch('http://localhost:3000/api/auth/sign-out', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' }
  });

  if (response.ok) {
    // Clear user state
    setUser(null);
    setProfile(null);
    // Redirect to login
    navigate('/login');
  } else {
    console.error('Sign out failed');
  }
}
```

## Error Handling Best Practices

### 401 Unauthorized

```javascript
if (response.status === 401) {
  // Session expired or invalid
  // Clear local user state
  // Redirect to login page
  navigate('/login');
}
```

### 409 Conflict

```javascript
if (response.status === 409) {
  // Email or username already taken
  // Show error message to user
  // Suggest alternative username/email
  const data = await response.json();
  showError(data.message);
}
```

### 400 Bad Request

```javascript
if (response.status === 400) {
  // Validation error
  const data = await response.json();
  if (data.details) {
    // Zod validation errors
    data.details.forEach(error => {
      showFieldError(error.path[0], error.message);
    });
  } else {
    // Single error message
    showError(data.message);
  }
}
```

### 500 Internal Server Error

```javascript
if (response.status === 500) {
  // Server error
  // Log for debugging
  console.error('Server error:', await response.json());
  // Show generic error to user
  showError('An error occurred. Please try again later.');
}
```

## Rate Limiting (Future)

Currently, authentication endpoints have no rate limiting. In production:
- Implement rate limiting on sign-up (prevent abuse)
- Implement rate limiting on sign-in (prevent brute force)
- Consider implementing CAPTCHA on repeated failures

## Security Notes

1. **HTTPOnly Cookies**: Session tokens are stored in HTTPOnly cookies, not localStorage
   - Prevents XSS attacks
   - Automatically sent with requests
   - Cannot be accessed by JavaScript

2. **Password Hashing**: All passwords are hashed with bcrypt before storage
   - Never stored in plaintext
   - Password resets use secure tokens

3. **Session Expiration**: Sessions expire after 30 days
   - Invalidated on sign-out
   - Checked on every protected request

4. **CORS**: Configure CORS appropriately in production
   - Only allow your frontend domain
   - Include credentials in requests

5. **HTTPS Required**: In production, use HTTPS only
   - HTTPOnly cookies require Secure flag
   - All endpoints should redirect HTTP to HTTPS
