# Bug Fix: Coin Endpoints Authentication Issue

## Problem Summary

The POST /api/coins, PUT /api/coins/:id, and DELETE /api/coins/:id endpoints were returning 401 Unauthorized errors even when users had valid sessions. The frontend was sending requests with proper credentials, but authentication was failing.

## Root Cause

All three coin mutation endpoints were using the `app.requireAuth()` framework middleware, which:
1. Sends a 401 response when no valid session is found
2. Does not properly handle cookies from the frontend
3. Returns immediately on authentication failure without allowing the endpoint to continue

This is the same issue we've been fixing across the codebase - the framework middleware doesn't work with custom session cookie handling.

## Solution Implemented

Replaced `app.requireAuth()` with manual session validation using `extractSessionToken()` for all three endpoints:
- POST /api/coins
- PUT /api/coins/:id
- DELETE /api/coins/:id

## Changes Made

### File: `src/routes/coins.ts`

#### 1. POST /api/coins (Lines 60-169)

**Before:**
```typescript
const session = await requireAuth(request, reply);
if (!session) return;
// ... use session.user.id
```

**After:**
```typescript
// Extract session token from cookies or Authorization header
const sessionToken = extractSessionToken(request);

if (!sessionToken) {
  return reply.status(401).send({ error: 'Unauthorized', message: 'No active session...' });
}

// Validate token in database
const sessionRecord = await app.db.query.session.findFirst({
  where: eq(authSchema.session.token, sessionToken),
});

// Validate expiration and user exists
// Use userRecord.id instead of session.user.id
```

**Key Features:**
- ✅ Detailed logging at each authentication step
- ✅ Validates token exists in database
- ✅ Checks session expiration
- ✅ Retrieves user record from auth table
- ✅ Returns specific error messages for each failure point
- ✅ Proper error handling with 401 responses

#### 2. PUT /api/coins/:id (Lines 296-421)

**Changes:**
- Replaced `requireAuth()` with manual session validation
- Extracted session token from cookies or Authorization header
- Validated session in database before allowing coin updates
- Changed all `session.user.id` references to `userId` variable
- Added detailed logging for debugging

#### 3. DELETE /api/coins/:id (Lines 427-502)

**Changes:**
- Replaced `requireAuth()` with manual session validation
- Extracted session token from cookies or Authorization header
- Validated session in database before allowing coin deletion
- Changed all `session.user.id` references to `userId` variable
- Added detailed logging for debugging

## Logging Details

Each endpoint now logs at multiple points:

### Session Extraction Point
```
info: POST /api/coins - session extraction attempt
  cookies: 'present' | 'missing'
  authHeader: 'present' | 'missing'
```

### Token Extraction Result
```
debug: Session token extraction result
  tokenPresent: true | false
```

### Session Validation Steps
```
debug: Session lookup result
  sessionFound: true | false

debug: Session expiration check
  expiresAt: "2024-01-22T10:00:00Z"
  now: "2024-01-15T10:00:00Z"
  expired: false

debug: User lookup result
  userFound: true | false
  userId: "user-uuid"
```

### Success
```
info: Session validated successfully for coin creation
  userId: "user-uuid"

info: Creating coin with validated session
  userId: "user-uuid"
  title: "1922 Peace Dollar"
  country: "United States"
  year: 1922

info: Coin created successfully
  coinId: "coin-uuid"
  userId: "user-uuid"
```

### Failure Points
```
warn: No session token found in request
  cookieHeader: "..." (first 100 chars)
  authHeader: "..." (first 50 chars)

warn: Session token not found in database
  token: "..." (first 20 chars)

warn: Session expired for coin creation
  expiresAt: "2024-01-15T10:00:00Z"

warn: User not found for valid session
  userId: "user-uuid"
```

## Error Responses

### No Session Token
```json
{
  "error": "Unauthorized",
  "message": "No active session - session token not found in cookies or Authorization header"
}
```

### Invalid Session Token
```json
{
  "error": "Unauthorized",
  "message": "Session invalid - token not found in database"
}
```

### Expired Session
```json
{
  "error": "Unauthorized",
  "message": "Session expired"
}
```

### User Not Found
```json
{
  "error": "Unauthorized",
  "message": "User not found"
}
```

### Session Validation Error
```json
{
  "error": "Internal server error",
  "message": "Failed to validate session"
}
```

## Authentication Flow

### Successful Flow
```
POST /api/coins
  ├─ Extract session token from request headers
  │   ├─ First check: Authorization: Bearer <token>
  │   └─ Fallback: Cookie: session=<token>
  ├─ Look up token in database
  ├─ Validate token exists
  ├─ Check expiration date
  ├─ Get user record
  ├─ Validate user exists
  └─ Use userId for coin creation

Response: 200 with created coin data
```

### Failed Flow
```
POST /api/coins
  ├─ Extract session token from request headers
  │   └─ Not found
  └─ Return 401 with error message

Response: 401 Unauthorized
```

## Supported Authentication Methods

### 1. Cookie-Based (Web Browsers)
```bash
curl -X POST https://api.example.com/api/coins \
  -H "Content-Type: application/json" \
  -H "Cookie: session=<session-token>" \
  -d '{"title":"...","country":"..."}'
```

### 2. Authorization Header (React Native / API Clients)
```bash
curl -X POST https://api.example.com/api/coins \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <session-token>" \
  -d '{"title":"...","country":"..."}'
```

### 3. Fetch with Credentials
```javascript
fetch('/api/coins', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',  // Browser automatically sends cookies
  body: JSON.stringify({ title: '...' })
})
```

## Testing the Fix

### Test 1: Create Coin with Valid Session
```bash
# 1. Sign in
curl -X POST http://localhost:3000/api/auth/email/signin \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com"}' \
  -c cookies.txt

# 2. Create coin with session cookie
curl -X POST http://localhost:3000/api/coins \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "title": "1922 Peace Dollar",
    "country": "United States",
    "year": 1922,
    "agency": "United States Mint"
  }'

# Expected: 200 with created coin data
```

### Test 2: Create Coin with Authorization Header
```bash
# 1. Sign in and extract token
TOKEN=$(curl -X POST http://localhost:3000/api/auth/email/signin \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com"}' \
  | jq -r '.session.token')

# 2. Create coin with Authorization header
curl -X POST http://localhost:3000/api/coins \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "title": "1922 Peace Dollar",
    "country": "United States",
    "year": 1922,
    "agency": "United States Mint"
  }'

# Expected: 200 with created coin data
```

### Test 3: Create Coin without Session
```bash
curl -X POST http://localhost:3000/api/coins \
  -H "Content-Type: application/json" \
  -d '{...}'

# Expected: 401 Unauthorized
```

## Debugging with Logs

### Enable Debug Logging
The endpoints will log:
- Token presence/absence in cookies and Authorization header
- Token extraction results
- Database lookup results
- Session expiration status
- User existence checks
- Complete validation flow

Check logs to see:
1. Whether cookies are being sent
2. Whether Authorization header is being sent
3. Whether token was found
4. Whether token exists in database
5. Whether token is expired
6. Whether user exists

Example log sequence for successful creation:
```
INFO: POST /api/coins - session extraction attempt
  cookies: present
  authHeader: missing

DEBUG: Session token extraction result
  tokenPresent: true

DEBUG: Session lookup result
  sessionFound: true

DEBUG: Session expiration check
  expired: false

DEBUG: User lookup result
  userFound: true

INFO: Session validated successfully for coin creation
  userId: user-uuid

INFO: Creating coin with validated session
  userId: user-uuid
  title: "1922 Peace Dollar"
  country: "United States"
  year: 1922

INFO: Coin created successfully
  coinId: coin-uuid
  userId: user-uuid
```

## Related Endpoints

All three coin mutation endpoints now use the same authentication pattern:
- ✅ POST /api/coins - Create coin
- ✅ PUT /api/coins/:id - Update coin
- ✅ DELETE /api/coins/:id - Delete coin

All three support:
- ✅ Cookie-based authentication (web browsers)
- ✅ Authorization header authentication (React Native)
- ✅ Proper error messages
- ✅ Detailed logging
- ✅ Session expiration checking

## Status

**✅ Complete and Ready for Production**

All coin mutation endpoints now properly authenticate users using manual session validation. The implementation supports both web browsers (cookies) and mobile apps (Authorization header), with comprehensive logging for debugging.

Users who previously received 401 errors on POST /api/coins, PUT /api/coins/:id, and DELETE /api/coins/:id should now be able to authenticate successfully.
