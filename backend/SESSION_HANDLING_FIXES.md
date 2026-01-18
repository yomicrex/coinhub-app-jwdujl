# Session Handling Fixes - Email-Only Signin & Session Retrieval

## Overview

Fixed the session handling in the email-only signin endpoint to ensure sessions persist seamlessly across requests. Added a new session retrieval endpoint to allow the frontend to validate and retrieve session data.

---

## Changes Made

### 1. Fixed Email-Only Signin Cookie Naming

**File:** `src/routes/auth.ts` (Lines 1478-1490)
**Status:** ✅ FIXED

#### Problem
The endpoint was using a non-standard cookie name `better-auth.session_token` that didn't match the session lookup logic. This caused sessions to not be found when the frontend tried to retrieve them.

#### Solution
Changed cookie name to `session` to match:
- Other sign-in endpoints (username/email signin uses `session=` at line 1368)
- Session lookup logic in the new session retrieval endpoint
- Fastify cookie parsing conventions

**Before:**
```typescript
const cookieOptions = [
  `better-auth.session_token=${sessionToken}`,  // ❌ Wrong name
  'HttpOnly',
  'Path=/',
  'SameSite=Lax',
  `Max-Age=${7 * 24 * 60 * 60}`,
];
```

**After:**
```typescript
const cookieOptions = [
  `session=${sessionToken}`,  // ✅ Correct name
  'HttpOnly',
  'Path=/',
  'SameSite=Lax',
  `Max-Age=${7 * 24 * 60 * 60}`,
];
```

#### Impact
- Sessions are now stored in the correct cookie name
- Frontend can access the session cookie value
- Session retrieval endpoint can find the token

---

### 2. Fixed Email-Only Signin Response Format

**File:** `src/routes/auth.ts` (Lines 1497-1508)
**Status:** ✅ FIXED

#### Problem
Response format was incomplete - didn't include session data, only user. Frontend needs the session token to establish the session immediately after signin.

#### Solution
Updated response to include both user and session data, matching other signin endpoints:

**Before:**
```json
{
  "success": true,
  "user": {
    "id": "user_abc123",
    "email": "user@example.com",
    "name": "John Doe"
  }
}
```

**After:**
```json
{
  "user": {
    "id": "user_abc123",
    "email": "user@example.com",
    "name": "John Doe"
  },
  "session": {
    "token": "session_token_uuid",
    "expiresAt": "2024-01-22T10:30:00Z"
  }
}
```

#### Impact
- Frontend receives session token immediately
- Can validate session without waiting for another request
- Response format consistent with other signin methods

---

### 3. Added Session Retrieval Endpoint

**File:** `src/routes/auth.ts` (Lines 1526-1625)
**Status:** ✅ NEW

#### Endpoint Details
```
GET /api/auth/session
Content-Type: application/json
Credentials: include (sends cookies automatically)
```

#### Purpose
Allows the frontend to retrieve the current session from the session cookie, validating both the cookie and the session data in the database.

#### Cookie Handling
The endpoint automatically reads the `session` cookie sent by the browser:
- Cookie name: `session`
- Value: Session token (UUID)
- Sent automatically by browser with `credentials: 'include'`

#### Process Flow
```
1. Browser sends GET /api/auth/session with session cookie
2. Server reads session token from cookie
3. If no cookie → return { user: null, session: null }
4. Look up session token in database
5. If not found → return { user: null, session: null }
6. Check if session is expired
   - If expired → delete from DB → return { user: null, session: null }
7. Get user record from database
8. Return { user: {...}, session: {...} }
```

#### Successful Response (200)
```json
{
  "user": {
    "id": "user_abc123",
    "email": "user@example.com",
    "name": "John Doe",
    "emailVerified": false,
    "image": null,
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  },
  "session": {
    "id": "session_id_uuid",
    "token": "session_token_uuid",
    "expiresAt": "2024-01-22T10:30:00Z",
    "createdAt": "2024-01-15T10:30:00Z",
    "ipAddress": "192.168.1.1",
    "userAgent": "Mozilla/5.0..."
  }
}
```

#### No Session Response (200)
```json
{
  "user": null,
  "session": null
}
```

#### Error Response (500)
```json
{
  "error": "Failed to retrieve session"
}
```

#### Security Features
1. **Expiration Cleanup**: Automatically deletes expired sessions from database
2. **Database Validation**: Verifies session exists in database (cookie alone isn't trusted)
3. **User Verification**: Confirms user still exists in system
4. **Comprehensive Logging**: Logs session retrieval with full context
5. **Error Handling**: Doesn't leak information about why session is invalid

#### Logging
The endpoint logs at multiple levels:
- **DEBUG**: Session retrieval attempt (has token or not)
- **DEBUG**: Token not found in database
- **INFO**: Session retrieved successfully
- **INFO**: Session expired
- **WARN**: User not found for valid session
- **ERROR**: Unexpected errors

---

## Cookie Configuration

### Cookie Settings (All Signin Methods)
```
Name:     session
Value:    Random UUID (session token)
HttpOnly: true          (prevents XSS access)
Path:     /             (available to entire domain)
SameSite: Lax           (prevents CSRF)
Max-Age:  604800        (7 days in seconds)
Secure:   true          (production only - requires HTTPS)
```

### How Fastify/Browser Handles Cookies
1. **Fastify sets cookie** via `Set-Cookie` header
2. **Browser stores cookie** in secure storage
3. **Browser sends cookie** automatically with each request to the same domain
4. **Fastify parses cookie** via `@fastify/cookie` plugin (included in framework)
5. **Route handlers access** via `request.cookies.session`

---

## Frontend Integration Guide

### After Email-Only Signin

```typescript
// 1. Call email signin endpoint
const response = await fetch('/api/auth/email/signin', {
  method: 'POST',
  credentials: 'include',  // ⚠️ IMPORTANT: Include cookies
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'user@example.com' })
});

const data = await response.json();
// data.user = { id, email, name }
// data.session = { token, expiresAt }

// 2. Browser automatically stores session cookie
// (No need to manually save the token)

// 3. Later, retrieve session to validate
const sessionResponse = await fetch('/api/auth/session', {
  credentials: 'include'  // ⚠️ IMPORTANT: Include cookies
});

const session = await sessionResponse.json();
if (session.user) {
  // User is logged in
  console.log('Logged in as:', session.user.name);
} else {
  // User is not logged in
  console.log('Not logged in');
}
```

### Key Points
- **`credentials: 'include'`** is REQUIRED to send cookies in fetch requests
- **Don't manually manage the token** - browser handles it automatically
- **Session cookie is HTTP-only** - JavaScript cannot access it directly
- **Use `/api/auth/session` endpoint** to validate session after page reload

---

## Session Lifecycle

### Creation
```
POST /api/auth/email/signin
    ↓
Create session record in database
    ↓
Set-Cookie header with session token
    ↓
Browser stores cookie securely
```

### Validation
```
GET /api/auth/session (with cookie)
    ↓
Read session token from cookie
    ↓
Look up in database
    ↓
Check expiration
    ↓
Return user + session data
```

### Expiration
```
7 days passes (or manual logout)
    ↓
Session record expiration date reached
    ↓
GET /api/auth/session detects expired session
    ↓
Deletes from database
    ↓
Returns { user: null, session: null }
    ↓
Frontend redirects to login
```

### Invalidation Events
- **Manual logout**: `DELETE /api/auth/sign-out`
- **Password reset**: All sessions deleted
- **Session expiration**: Auto-deleted on retrieval
- **7-day timeout**: Max lifetime

---

## Database Schema Review

### Session Table
```typescript
export const session = pgTable("session", {
  id: text("id").primaryKey(),                    // UUID
  expiresAt: timestamp("expires_at").notNull(),   // Expiration datetime
  token: text("token").notNull().unique(),        // Session token (UUID)
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").$onUpdate(...),
  ipAddress: text("ip_address"),                  // Client IP
  userAgent: text("user_agent"),                  // Browser info
  userId: text("user_id")                         // Foreign key to user table
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});
```

**Key Features:**
- Session token has UNIQUE constraint (prevents duplicates)
- Foreign key to user with CASCADE delete
- Expiration timestamp for cleanup
- IP address and user agent for security tracking

---

## Comparison: Before vs After

### Email-Only Signin (Before)
```
1. POST /api/auth/email/signin
2. Server creates session ❌
3. Server sets cookie: better-auth.session_token=token ❌ Wrong name!
4. Returns: { success: true, user: {...} } ❌ No session data!
5. Frontend stores token manually ❌ Unnecessary!
6. Later: GET /api/auth/session fails ❌ Can't find cookie!
```

### Email-Only Signin (After)
```
1. POST /api/auth/email/signin
2. Server creates session ✅
3. Server sets cookie: session=token ✅ Standard name
4. Returns: { user: {...}, session: {...} } ✅ Has session data
5. Browser stores cookie automatically ✅ Secure!
6. Later: GET /api/auth/session works ✅ Finds cookie!
```

---

## Testing the Fixes

### Manual Testing Steps

#### Step 1: Email-Only Signin
```bash
curl -X POST http://localhost:3000/api/auth/email/signin \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com"}' \
  -c cookies.txt  # Save cookies to file

# Expected response:
{
  "user": {
    "id": "user_abc123",
    "email": "user@example.com",
    "name": "John Doe"
  },
  "session": {
    "token": "session_token_uuid",
    "expiresAt": "2024-01-22T10:30:00Z"
  }
}
```

#### Step 2: Retrieve Session
```bash
curl -X GET http://localhost:3000/api/auth/session \
  -b cookies.txt  # Load cookies from file

# Expected response:
{
  "user": {
    "id": "user_abc123",
    "email": "user@example.com",
    "name": "John Doe",
    ...
  },
  "session": {
    "id": "session_id_uuid",
    "token": "session_token_uuid",
    "expiresAt": "2024-01-22T10:30:00Z",
    ...
  }
}
```

#### Step 3: Without Session Cookie
```bash
curl -X GET http://localhost:3000/api/auth/session

# Expected response:
{
  "user": null,
  "session": null
}
```

### Automated Testing

```typescript
describe('Email-Only Signin with Session', () => {
  let cookies = '';

  it('should signin with email only', async () => {
    const response = await fetch('/api/auth/email/signin', {
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify({ email: 'user@example.com' })
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.user.email).toBe('user@example.com');
    expect(data.session.token).toBeDefined();

    // Extract session cookie
    cookies = response.headers.get('set-cookie');
  });

  it('should retrieve session with valid cookie', async () => {
    const response = await fetch('/api/auth/session', {
      credentials: 'include',
      headers: { 'Cookie': cookies }
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.user).not.toBeNull();
    expect(data.session).not.toBeNull();
  });

  it('should return null session without cookie', async () => {
    const response = await fetch('/api/auth/session');

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.user).toBeNull();
    expect(data.session).toBeNull();
  });
});
```

---

## Endpoint Summary

| Endpoint | Method | Purpose | Status |
|----------|--------|---------|--------|
| `/api/auth/email/signin` | POST | Email-only login | ✅ FIXED |
| `/api/auth/session` | GET | Retrieve current session | ✅ NEW |
| `/api/auth/sign-in/username-email` | POST | Username/email login | ✅ Uses same cookie |
| `/api/auth/me` | GET | Get user + profile | ✅ Protected endpoint |
| `/api/auth/sign-out` | POST | Logout (delete session) | ✅ Better Auth managed |

---

## Security Considerations

### ✅ Protected
- **Session token**: Random UUID (cryptographically secure)
- **Cookie**: HTTP-only (JavaScript cannot access)
- **Transport**: Secure flag in production (HTTPS only)
- **Database validation**: Token verified against database (cookie alone untrusted)
- **Expiration**: Automatic cleanup of expired sessions
- **IP tracking**: Stored for security auditing

### ⚠️ Notes
- Session is 7 days (reasonable for most apps)
- HTTP-only means lost on logout (by design)
- SameSite=Lax prevents CSRF attacks
- Cookie path=/ allows access to entire domain
- Backend validates all session data

---

## Summary

**Email-Only Signin**: Now properly integrates session handling with:
- ✅ Correct cookie name (`session`)
- ✅ Standard cookie settings (HTTP-only, SameSite, Max-Age)
- ✅ Complete response with session data
- ✅ Frontend can validate session immediately

**Session Retrieval**: New endpoint allows frontend to:
- ✅ Check if session is valid
- ✅ Get user information
- ✅ Handle expired sessions
- ✅ Support page reload scenarios

**Result**: Session cookie now works seamlessly across requests. Frontend can properly persist user sessions and validate authentication state.
