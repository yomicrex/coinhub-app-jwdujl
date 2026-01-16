# CoinHub Authentication Debug Guide

This guide explains how authentication is set up and how to debug authentication issues in the CoinHub backend.

## Authentication Architecture

CoinHub uses **Better Auth**, a framework-integrated authentication provider that handles:
- Email/password sign-up and sign-in
- Session management
- Secure HTTPOnly cookies
- Password hashing (bcrypt)
- Email validation

### Key Files

- `src/index.ts` - Initializes `app.withAuth()` to enable Better Auth
- `src/db/auth-schema.ts` - Better Auth tables (user, session, account, verification)
- `src/routes/auth.ts` - Custom authentication routes and profile management

## Authentication Flow

### 1. Sign-Up (Registration)

**Endpoint**: `POST /api/auth/sign-up/email` (Auto-provided by Better Auth)

**Request**:
```json
{
  "email": "user@example.com",
  "password": "secure_password_min_6_chars",
  "name": "John Doe"
}
```

**Response**:
```json
{
  "user": {
    "id": "user-id-from-better-auth",
    "email": "user@example.com",
    "name": "John Doe",
    "emailVerified": false,
    "image": null,
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  },
  "session": {
    "id": "session-id",
    "token": "session-token",
    "expiresAt": "2024-02-15T10:30:00Z",
    "ipAddress": "192.168.1.1",
    "userAgent": "Mozilla/5.0..."
  }
}
```

**What happens**:
1. Framework validates email format
2. Framework checks if email already exists in `user` table
3. Framework hashes password using bcrypt
4. Framework creates user record in `user` table
5. Framework creates session record in `session` table
6. Framework returns user + session with HTTPOnly cookie
7. **App logs**: "Sign up attempt for email: [email]"

### 2. Sign-In

**Endpoint**: `POST /api/auth/sign-in/email` (Auto-provided by Better Auth)

**Request**:
```json
{
  "email": "user@example.com",
  "password": "secure_password_min_6_chars"
}
```

**Response**: Same as sign-up response

**What happens**:
1. Framework validates email format
2. Framework looks up user by email in `user` table
3. Framework compares provided password with stored hash
4. Framework creates new session in `session` table
5. Framework returns user + session with HTTPOnly cookie
6. **App logs**: "Sign in attempt for email: [email]"

### 3. Profile Completion (CoinHub-Specific)

**Endpoint**: `POST /api/auth/complete-profile` (Protected - requires session)

**Request**:
```json
{
  "username": "johndoe",
  "displayName": "John Doe",
  "inviteCode": "BETA2026",
  "bio": "Coin collector",
  "location": "San Francisco",
  "avatarUrl": "https://storage.example.com/avatars/user1.jpg"
}
```

**Response**:
```json
{
  "id": "user-id",
  "email": "user@example.com",
  "username": "johndoe",
  "displayName": "John Doe",
  "avatarUrl": "https://...",
  "bio": "Coin collector",
  "location": "San Francisco",
  "collectionPrivacy": "public",
  "role": "user",
  "inviteCodeUsed": "BETA2026",
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

**What happens**:
1. Framework checks if user has valid session
2. App validates username (3-30 chars, alphanumeric)
3. App checks if username already taken in `users` table
4. App validates invite code if provided:
   - Code must exist and be active
   - Code must not have expired
   - Code must not have exceeded usage limit
5. App increments invite code usage count
6. App creates or updates user profile in CoinHub `users` table
7. **Logging**: "Profile completion for user: [userId], username: [username]"

### 4. Session Validation

**Endpoint**: `GET /api/auth/me` (Protected - requires session)

**Response**:
```json
{
  "user": {
    "id": "user-id",
    "email": "user@example.com",
    "name": "John Doe"
  },
  "profile": {
    "id": "user-id",
    "email": "user@example.com",
    "username": "johndoe",
    "displayName": "John Doe",
    "avatarUrl": "https://signed-url-with-expiry",
    "bio": "Coin collector",
    "location": "San Francisco",
    "collectionPrivacy": "public"
  }
}
```

**What happens**:
1. Framework reads session token from httpOnly cookie
2. Framework looks up session in `session` table
3. Framework checks if session is expired
4. Framework retrieves user from `user` table
5. App retrieves full profile from CoinHub `users` table
6. App generates signed URL for avatar image (expires in 15 min)
7. **Logging**: "Session validation for user: [userId]"

### 5. Sign-Out

**Endpoint**: `POST /api/auth/sign-out` (Protected - requires session)

**Response**:
```json
{
  "message": "Signed out successfully"
}
```

**What happens**:
1. Framework reads session token from httpOnly cookie
2. Framework invalidates session in `session` table
3. Framework clears HTTPOnly cookie
4. Framework returns success

## Database Tables

### Better Auth Tables (in `src/db/auth-schema.ts`)

**user** table:
- `id` (TEXT, PK) - Unique user ID
- `name` (TEXT) - User's name
- `email` (TEXT, UNIQUE) - User's email
- `emailVerified` (BOOLEAN) - Email verification status
- `image` (TEXT) - Profile image URL
- `createdAt` (TIMESTAMP)
- `updatedAt` (TIMESTAMP)

**session** table:
- `id` (TEXT, PK) - Unique session ID
- `token` (TEXT, UNIQUE) - Session token
- `expiresAt` (TIMESTAMP) - Session expiration time
- `ipAddress` (TEXT) - IP address of session creator
- `userAgent` (TEXT) - User agent string
- `userId` (TEXT, FK) - References user.id

**account** table:
- Contains OAuth provider accounts (for future social login)

**verification** table:
- Contains email verification codes and password reset tokens

### CoinHub Tables (in `src/db/schema.ts`)

**users** table:
- `id` (TEXT, PK) - References Better Auth user.id
- `email` (TEXT, UNIQUE)
- `username` (TEXT, UNIQUE) - CoinHub handle
- `displayName` (TEXT) - Display name
- `avatarUrl` (TEXT) - Profile image storage key
- `bio` (TEXT)
- `location` (TEXT)
- `collectionPrivacy` ('public' | 'private')
- `role` ('user' | 'moderator' | 'admin')
- `inviteCodeUsed` (TEXT) - Which invite code was used
- `createdAt` (TIMESTAMP)
- `updatedAt` (TIMESTAMP)

## Logging

All authentication operations are logged with context. Check logs for:

### Info Logs (successful operations)
```
"Sign up attempt for email: user@example.com"
"Sign up successful for email: user@example.com"
"Sign in attempt for email: user@example.com"
"Sign in successful for email: user@example.com"
"Session validation for user: user-123, email: user@example.com"
"Session validation successful"
"Profile completion for user: user-123, username: johndoe"
"Profile completion finished successfully"
"User profile created successfully"
"User profile updated successfully"
```

### Warn Logs (validation failures, non-fatal issues)
```
"Sign up validation failed - invalid email"
"Sign up validation failed - password too short"
"Sign up failed - email already exists"
"Sign in failed - invalid credentials"
"Session validation failed - no active session"
"Username already taken"
"Invalid invite code"
"Invite code has expired"
"Invite code usage limit reached"
```

### Error Logs (fatal issues requiring attention)
```
"Sign up error"
"Sign in error"
"Failed to generate avatar signed URL"
"Failed to create user profile"
"Failed to update user profile"
"Failed to increment invite code usage"
"Database error during invite code processing"
```

## Common Issues and Solutions

### Issue 1: "Sign up failed - email already exists" (409)

**Cause**: User tried to sign up with an email that's already registered.

**Check**:
- Run: `SELECT COUNT(*) FROM "user" WHERE email = 'user@example.com';`
- If result > 0: User exists, have them sign in instead
- If result = 0: Email verification issue, check `verification` table

**Fix**:
- Delete the user and session if they're test accounts: `DELETE FROM "user" WHERE id = '...';`
- Or have user use a different email

### Issue 2: "Session validation failed - no active session" (401)

**Cause**: User tried to access protected endpoint without valid session.

**Check**:
- Verify HTTPOnly cookie is being sent with request
- Check browser DevTools → Application → Cookies
- Look for cookie named like `session-token-*`

**Fix**:
- User needs to sign in first: `POST /api/auth/sign-in/email`
- Check if session expired: `SELECT * FROM session WHERE userId = 'user-123' AND expiresAt > NOW();`

### Issue 3: "Username already taken" (409)

**Cause**: During profile completion, the username is already taken by another user.

**Check**:
- Run: `SELECT * FROM users WHERE username = 'johndoe';`
- If result exists: Username is taken
- Verify the user ID matches the session user ID

**Fix**:
- User needs to choose a different username
- Or if it's the same user updating: Delete old profile and re-create

### Issue 4: "Invalid invite code" (400)

**Cause**: During profile completion, the invite code is invalid.

**Check**:
- Run: `SELECT * FROM invite_codes WHERE code = 'BETA2026';`
- If no result: Code doesn't exist
- If exists, check: `is_active`, `expires_at`, `usage_count` vs `usage_limit`

**Fix**:
- Create the invite code if needed: See INVITE_CODES.md
- Or have user skip invite code (field is optional)

### Issue 5: "Profile completion validation error - missing or invalid fields" (400)

**Cause**: Request is missing required fields or fields don't match schema.

**Check** the request body:
- `username`: Required, must be 3-30 characters
- `displayName`: Required, must be 1-100 characters
- `inviteCode`: Optional, must be valid code
- `bio`: Optional, max 500 characters
- `location`: Optional, max 100 characters

**Fix**:
- Ensure all required fields are present
- Check field lengths
- Trim whitespace from values

## Testing Authentication

### 1. Test Sign-Up

```bash
curl -X POST http://localhost:3000/api/auth/sign-up/email \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "name": "Test User"
  }' \
  -c cookies.txt
```

Expected: 200 response with user + session

### 2. Test Sign-In

```bash
curl -X POST http://localhost:3000/api/auth/sign-in/email \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }' \
  -c cookies.txt
```

Expected: 200 response with user + session

### 3. Test Profile Completion

```bash
curl -X POST http://localhost:3000/api/auth/complete-profile \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "username": "testuser",
    "displayName": "Test User",
    "inviteCode": "BETA2026"
  }'
```

Expected: 200 response with full profile

### 4. Test Session Validation

```bash
curl -X GET http://localhost:3000/api/auth/me \
  -H "Content-Type: application/json" \
  -b cookies.txt
```

Expected: 200 response with user + profile

### 5. Test Sign-Out

```bash
curl -X POST http://localhost:3000/api/auth/sign-out \
  -H "Content-Type: application/json" \
  -b cookies.txt
```

Expected: 200 response with success message

## Debug Checklist

When users report authentication issues:

- [ ] Check application logs for auth-related messages
- [ ] Verify database connectivity: `npm run db:push`
- [ ] Check Better Auth is initialized: Look for "Authentication initialized successfully" in logs
- [ ] Verify session table exists: `SELECT * FROM session LIMIT 1;`
- [ ] Check user table schema: `\d "user"`
- [ ] Verify session expiration times: `SELECT expiresAt, NOW() FROM session LIMIT 5;`
- [ ] Check for duplicate emails: `SELECT email, COUNT(*) FROM "user" GROUP BY email HAVING COUNT(*) > 1;`
- [ ] Verify HTTPOnly cookies are being sent
- [ ] Check password hash format in account table (should start with `$2b$`)
- [ ] Review complete logs: `npm run dev` and check console output during test requests

## Key Points

1. **Better Auth handles sign-up/sign-in**: Don't create custom endpoints at `/api/auth/sign-up/email` or `/api/auth/sign-in/email`

2. **Sessions use HTTPOnly cookies**: Never expose session tokens in response body

3. **Two-step process**: Users must sign up → complete profile

4. **Invite codes are optional**: Users can skip invite code field during profile completion

5. **BETA2026 is special**: This code should always be valid and active (see seed.ts)

6. **Logging is comprehensive**: Check logs to trace auth flow issues

## Framework Integration

Better Auth is automatically integrated via `app.withAuth()` in `src/index.ts`. This provides:

- Automatic endpoint registration at `/api/auth/*`
- Automatic session management
- Automatic password hashing
- Automatic database schema setup
- Automatic middleware for `requireAuth()`

**Do not manually create** password hashing, session tokens, or auth endpoints - the framework handles all of this.
