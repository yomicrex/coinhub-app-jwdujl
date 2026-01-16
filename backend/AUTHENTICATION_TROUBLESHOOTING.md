# Authentication Troubleshooting Guide

Comprehensive guide for debugging authentication issues, including sign-up/sign-in mismatch problems.

## Common Authentication Issues

### Issue: Sign-Up Says Email Already Exists, But Sign-In Fails

**Symptoms**:
- User tries to sign up with email "User@Example.com"
- System says "Email already registered"
- User tries to sign in with same email
- System says "Invalid credentials" or "Email not found"

**Root Causes**:

1. **Email Case Sensitivity**
   - Email was stored as "User@Example.com"
   - Sign-in lookup is case-sensitive
   - Database treats "user@example.com" as different from "User@Example.com"

2. **Email Normalization Missing**
   - Sign-up doesn't normalize email to lowercase
   - Sign-in uses different case handling
   - Same email with different cases creates duplicate accounts

3. **Database Encoding Issues**
   - Character set mismatch (UTF-8 vs Latin1)
   - Collation differences
   - Special characters in email

**Quick Diagnosis**:

Use the debug endpoints to check email status:

```bash
# List all users to see email variations
curl http://localhost:3000/api/auth/debug/users

# Check specific email (exact and case-insensitive match)
curl http://localhost:3000/api/auth/debug/check-email/User@Example.com

# Response will show:
# {
#   "searchEmail": "User@Example.com",
#   "exactMatch": { "id": "...", "email": "User@Example.com" },
#   "caseInsensitiveMatch": null,
#   "note": "..."
# }
```

**If You See**:
- `exactMatch` exists but `caseInsensitiveMatch` null: Case sensitivity issue
- Both null: Email doesn't exist (different problem)
- Both exist and different: Duplicate accounts with case variations

**Solutions**:

**Option 1: Fix on Sign-Up/Sign-In (Recommended)**
- All emails should be normalized to lowercase before storage
- Better Auth handles this automatically in newer versions
- Ensure your framework version is up to date: `npm list better-auth`

**Option 2: Fix Existing Data**
```sql
-- Find duplicate emails with case variations
SELECT LOWER(email), COUNT(*) as count
FROM "user"
GROUP BY LOWER(email)
HAVING COUNT(*) > 1;

-- Merge duplicate accounts (CAREFUL - may lose data)
-- For each duplicate group:
-- 1. Back up the data
-- 2. Transfer important data from duplicate to main account
-- 3. Delete duplicate account
-- 4. Update foreign key references

-- Normalize all emails to lowercase
UPDATE "user" SET email = LOWER(email);

-- Verify unique constraint still works
SELECT email, COUNT(*) FROM "user" GROUP BY email HAVING COUNT(*) > 1;
```

**Option 3: Database Migration**
```sql
-- Add constraint to enforce lowercase emails
-- Create new column
ALTER TABLE "user" ADD COLUMN email_normalized TEXT;

-- Populate with lowercase values
UPDATE "user" SET email_normalized = LOWER(email);

-- Add unique constraint on normalized column
ALTER TABLE "user" ADD CONSTRAINT unique_email_normalized
  UNIQUE (email_normalized);

-- Create index for faster lookups
CREATE INDEX idx_user_email_normalized ON "user"(email_normalized);

-- Update application to use email_normalized for lookups
```

---

### Issue: Sign-Up Successful, But Profile Completion Fails with "Email Already Exists"

**Symptoms**:
- Sign-up works: User created successfully
- Sign-in works: User can authenticate
- Profile completion fails with 409 error
- Error message: "User already exists" or similar

**Root Cause**:
Profile completion endpoint tries to create user in CoinHub `users` table, but a record already exists (possibly from a previous failed attempt).

**Diagnosis**:

```bash
# Check if CoinHub profile exists
curl -X GET http://localhost:3000/api/auth/me \
  -b cookies.txt

# If it returns a profile, the user already completed it
# Try updating instead: PATCH /api/auth/profile
```

**Solution**:

```bash
# Option 1: Update profile instead of creating
curl -X PATCH http://localhost:3000/api/auth/profile \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "displayName": "New Name",
    "bio": "New bio"
  }'

# Option 2: Clear existing profile (development only)
# DELETE FROM users WHERE id = 'user-id';
# Then try profile completion again
```

**Prevention**:
- Profile completion endpoint should detect existing profile and update instead of create
- Or return user to sign-in if profile already completed

---

### Issue: Sign-In Works, But GET /api/auth/me Returns 401

**Symptoms**:
- User successfully signs in
- Frontend shows user is authenticated
- GET /api/auth/me returns 401 Unauthorized
- HTTPOnly cookie not being sent

**Root Causes**:

1. **Cookie Not Being Sent**
   - Frontend not using `credentials: 'include'` in fetch
   - CORS not allowing credentials
   - Cookie domain/path mismatch

2. **Session Expired**
   - Session duration too short
   - Browser cleared cookies
   - Server restarted (in-memory sessions lost)

3. **Cookie Secure Flag**
   - Using HTTP instead of HTTPS
   - Cookie marked as Secure but accessed over HTTP

**Diagnosis**:

```bash
# Check browser cookies
# DevTools → Application → Cookies → localhost
# Look for: session-token-* or auth_token

# Test cookie is being sent
curl -X GET http://localhost:3000/api/auth/me \
  -b cookies.txt  # Include cookies from sign-in

# Check session in database
# SELECT * FROM session WHERE user_id = 'user-id' AND expiresAt > NOW();
```

**Solutions**:

**Frontend Fix**:
```javascript
// WRONG - no credentials
const response = await fetch('/api/auth/me');

// CORRECT - include credentials
const response = await fetch('/api/auth/me', {
  credentials: 'include'  // This sends HTTPOnly cookies
});
```

**CORS Configuration**:
```typescript
// Fastify CORS setup
app.register(require('@fastify/cors'), {
  origin: 'http://localhost:3000',  // Your frontend URL
  credentials: true  // Allow credentials (cookies)
});
```

**Session Management**:
```typescript
// Check if sessions are being stored in database
const session = await app.db.query.session.findFirst({
  where: eq(authSchema.session.userId, userId)
});

if (!session || session.expiresAt < new Date()) {
  // Session doesn't exist or has expired
}
```

---

### Issue: Password Hashing Not Working, Can't Sign In

**Symptoms**:
- Sign-up succeeds
- Sign-in fails with "Invalid credentials"
- Password was accepted during sign-up (no length error)
- No errors in logs

**Root Cause**:
Password hash not being stored or retrieved correctly.

**Diagnosis**:

```sql
-- Check if account record exists with password
SELECT id, provider_id, password IS NOT NULL as has_password
FROM account
WHERE user_id = 'user-id';

-- Check password hash format
SELECT id, provider_id, password
FROM account
WHERE user_id = 'user-id';
-- Password should start with $2b$ (bcrypt hash)
```

**Solution**:

```bash
# Verify bcryptjs is installed
npm list bcryptjs

# If missing, install it
npm install bcryptjs

# Check password is being hashed in sign-up
# Look at Better Auth code for password hashing
```

---

### Issue: Session Token Expires Too Quickly

**Symptoms**:
- User signs in successfully
- User is logged out after a few minutes
- Session is still in database but marked as expired
- expiresAt time is wrong

**Root Cause**:
Session expiration time calculated incorrectly.

**Diagnosis**:

```sql
-- Check session expiration
SELECT id, expiresAt, NOW(),
       EXTRACT(EPOCH FROM (expiresAt - NOW())) as seconds_until_expiry
FROM session
ORDER BY expiresAt DESC
LIMIT 5;

-- Should be approximately 30 days (2,592,000 seconds)
-- If it's much less, the calculation is wrong
```

**Solution**:

```typescript
// Correct: 30 days = 30 * 24 * 60 * 60 * 1000 milliseconds
const expiresAt = new Date(Date.now() + (30 * 24 * 60 * 60 * 1000));

// Wrong: milliseconds to seconds conversion error
const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60);  // 2.6 seconds!
```

---

## Debug Endpoints

CoinHub includes debug endpoints for development. **REMOVE THESE IN PRODUCTION**.

### GET /api/auth/health

Check if authentication system is running.

```bash
curl http://localhost:3000/api/auth/health
```

**Response**:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### GET /api/auth/debug/users

List all users in authentication database.

```bash
curl http://localhost:3000/api/auth/debug/users
```

**Response**:
```json
{
  "count": 3,
  "users": [
    {
      "id": "user-1",
      "email": "User@Example.com",
      "emailLowercase": "user@example.com",
      "name": "User One",
      "emailVerified": false,
      "createdAt": "2024-01-15T10:30:00Z"
    },
    ...
  ]
}
```

**Use Case**: See all users and their email case variations

### GET /api/auth/debug/check-email/:email

Check if an email exists (exact and case-insensitive).

```bash
curl http://localhost:3000/api/auth/debug/check-email/user@example.com
```

**Response**:
```json
{
  "searchEmail": "user@example.com",
  "exactMatch": { "id": "user-1", "email": "User@Example.com" },
  "caseInsensitiveMatch": { "id": "user-1", "email": "User@Example.com" },
  "note": "If only caseInsensitiveMatch exists, the issue is email case sensitivity"
}
```

**Use Case**: Diagnose email case sensitivity and duplicate account issues

---

## Log Analysis

Review logs to understand what's happening during authentication:

### Sign-Up Flow Logs

```
[INFO] Sign up attempt for email: user@example.com
[INFO] User sign up with email: user@example.com (Better Auth)
[INFO] User profile created successfully
[INFO] Profile completion finished successfully
```

### Sign-In Flow Logs

```
[INFO] Sign in attempt for email: user@example.com
[INFO] User sign in with email: user@example.com (Better Auth)
[INFO] Session validation successful
[INFO] Current user profile fetched successfully
```

### Error Flow Logs

```
[WARN] Sign up failed - email already exists
[ERROR] Failed to create user profile
[ERROR] Password reset error
```

### Commands to View Logs

```bash
# Show last 50 lines
npm run dev 2>&1 | tail -50

# Filter for authentication logs
npm run dev 2>&1 | grep -i "auth\|sign"

# Follow logs in real-time
npm run dev 2>&1 | tail -f

# Show only errors
npm run dev 2>&1 | grep -i error
```

---

## Database Queries for Debugging

### Find User by Email

```sql
-- Exact match
SELECT * FROM "user" WHERE email = 'user@example.com';

-- Case-insensitive match
SELECT * FROM "user" WHERE LOWER(email) = 'user@example.com';
```

### Check User Sessions

```sql
-- Active sessions for user
SELECT * FROM session
WHERE user_id = 'user-id'
  AND expiresAt > NOW();

-- All sessions (including expired)
SELECT * FROM session
WHERE user_id = 'user-id'
ORDER BY expiresAt DESC;
```

### Check Password Account

```sql
-- Find password account for user
SELECT * FROM account
WHERE user_id = 'user-id'
  AND provider_id = 'password';

-- Check password hash
SELECT id, provider_id, password
FROM account
WHERE user_id = 'user-id';
-- Password should start with $2b$
```

### Check Reset Tokens

```sql
-- Find active reset tokens
SELECT * FROM verification
WHERE identifier = 'user@example.com'
  AND expiresAt > NOW();

-- Check token expiration
SELECT identifier, expiresAt, NOW(),
       EXTRACT(EPOCH FROM (expiresAt - NOW())) as seconds_until_expiry
FROM verification
WHERE identifier = 'user@example.com';
```

### Find Duplicate Emails

```sql
-- Emails with case variations
SELECT LOWER(email) as email_lower, COUNT(*) as count
FROM "user"
GROUP BY LOWER(email)
HAVING COUNT(*) > 1;

-- See all variations
SELECT DISTINCT email
FROM "user"
WHERE LOWER(email) = 'user@example.com';
```

---

## Testing Checklist

Use this checklist to verify authentication is working:

### Basic Sign-Up/Sign-In
- [ ] Sign up with new email
- [ ] Receive user + session in response
- [ ] HTTPOnly cookie is set (check DevTools)
- [ ] Sign in with same email and password
- [ ] Receive user + session in response
- [ ] Different session token than sign-up

### Case Sensitivity
- [ ] Sign up with "User@Example.com"
- [ ] Sign in with "user@example.com" works
- [ ] Sign in with "USER@EXAMPLE.COM" works
- [ ] GET /api/auth/me returns correct profile

### Profile Completion
- [ ] Sign up creates Better Auth user
- [ ] Profile completion creates CoinHub profile
- [ ] Can't use same username twice
- [ ] GET /api/auth/me returns both user and profile

### Session Management
- [ ] GET /api/auth/me with valid session returns 200
- [ ] GET /api/auth/me without session returns 401
- [ ] Sign out invalidates session
- [ ] GET /api/auth/me after sign out returns 401

### Password Recovery
- [ ] Request reset with existing email returns 200
- [ ] Request reset with non-existing email returns 200
- [ ] Verify token works for valid token
- [ ] Verify token fails for invalid token
- [ ] Reset password works with valid token
- [ ] Reset password fails with expired token
- [ ] Old sessions invalidated after reset
- [ ] Can sign in with new password

---

## Production Monitoring

Set up monitoring for these authentication metrics:

### Metrics to Track

```
- Sign-up success rate
- Sign-in success rate
- Session creation time
- Password reset requests
- Failed authentication attempts
- Average session duration
- Session expiration errors
```

### Alerts to Set Up

```
- Sign-up failure rate > 5%
- Sign-in failure rate > 10%
- Password reset token generation failures > 1%
- Database connection errors
- High failed login attempts (possible brute force)
- Session expiration < expected duration
```

### Logs to Archive

```
- All sign-up attempts with email
- All sign-in attempts with email
- All password reset requests
- All profile completion attempts
- All authentication errors
- All session creation/deletion
```

---

## Getting Help

When debugging authentication issues:

1. **Collect Information**
   - What endpoint is failing?
   - What error message is shown?
   - What's in the logs?
   - What was the exact request/response?

2. **Use Debug Endpoints**
   - `GET /api/auth/health` - verify system is running
   - `GET /api/auth/debug/users` - check email variations
   - `GET /api/auth/debug/check-email/:email` - diagnose email issues

3. **Check Database**
   - Does user exist? `SELECT * FROM "user" WHERE email = '...';`
   - Is session valid? `SELECT * FROM session WHERE user_id = '...';`
   - Has password been hashed? `SELECT password FROM account WHERE user_id = '...';`

4. **Review Logs**
   - Look for ERROR and WARN messages
   - Check timestamps match requests
   - Search for specific email/user ID

5. **Test with curl**
   - Isolate frontend issues from backend
   - Use `-c cookies.txt` to save cookies
   - Use `-b cookies.txt` to send cookies

6. **Check Framework Docs**
   - Better Auth: https://better-auth.com/docs
   - Your framework version might have different behavior
   - Check changelog for relevant fixes
