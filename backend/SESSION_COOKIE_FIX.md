# Session Cookie Handling Fix

## Problem Identified

When users sign in:
1. ✅ Session is created in database
2. ✅ Status 200 returned with user data
3. ❌ Session cookie is not being sent by client on next request
4. ❌ `GET /api/auth/me` returns 401 "no active session"

## Root Causes

### Issue 1: CORS Credentials Not Sent (MOST LIKELY)
**Client-side Problem:**
- By default, HTTP cookies are NOT sent with cross-origin requests
- Frontend must explicitly include `credentials: 'include'`

**Solution for Frontend:**
```javascript
// WRONG - Cookies not sent
fetch('http://localhost:3000/api/auth/me')

// CORRECT - Cookies included
fetch('http://localhost:3000/api/auth/me', {
  credentials: 'include'  // 👈 CRITICAL
})

// Alternative with headers
fetch('http://localhost:3000/api/auth/me', {
  credentials: 'include',
  headers: {
    'Authorization': `Bearer ${sessionToken}` // From signin response
  }
})
```

### Issue 2: SameSite=Lax Cookie Restriction
**Current Setting:**
- `SameSite=Lax` - Only sent with same-site requests or top-level navigation
- Won't be sent with cross-origin XHR/Fetch

**Might Need Change to:**
- `SameSite=None` with `Secure` (HTTPS only) - For cross-origin APIs
- But requires explicit `credentials: 'include'` on frontend

---

## Backend Fixes Applied

### Fix 1: Improved Session Cookie Setting
**File:** `src/routes/auth.ts` (lines 1428-1443, 1564-1580)

**Changes:**
- Better logging of cookie header
- Explicit cookie format validation
- Debug logging to verify cookie is being set
- Return session token in response body as fallback

**Cookie Format:**
```
Set-Cookie: session=<uuid>; HttpOnly; Path=/; SameSite=Lax; Max-Age=604800; [Secure in production]
```

### Fix 2: Return Session Token in Response Body
**File:** `src/routes/auth.ts` (lines 1445-1477, 1582-1611)

**Changes:**
- Response now includes session token
- Frontend can store and use token if cookies don't work
- Fallback option: `Authorization: Bearer <token>`

**Response Format:**
```json
{
  "user": { ... },
  "session": {
    "token": "uuid",
    "expiresAt": "2024-01-22T..."
  }
}
```

### Fix 3: Enhanced Session Validation Logging
**File:** `src/routes/auth.ts` (lines 470-484)

**Changes:**
- Log what cookies are present in request
- Log if Authorization header is set
- Better debugging for session failures

### Fix 4: New Debug Endpoint
**File:** `src/routes/auth.ts` (lines 95-130)

**New Endpoint:** `GET /api/auth/debug/session` (dev only)
- Shows current cookies in request
- Validates session status
- Helps diagnose cookie/session issues

---

## Frontend Implementation Guide

### Step 1: Include Credentials in All Requests
```javascript
// In fetch setup (recommended approach)
const defaultFetchOptions = {
  credentials: 'include', // Include cookies
  headers: {
    'Content-Type': 'application/json',
  }
};

// OR for each individual request
fetch(`${API_URL}/api/auth/me`, {
  credentials: 'include'
})
```

### Step 2: Handle Authorization Header as Fallback
```javascript
// Option 1: Use cookies (with credentials: 'include')
fetch(`${API_URL}/api/auth/me`, {
  credentials: 'include'
})

// Option 2: Use Authorization header
const response = await fetch(`${API_URL}/api/auth/signin/email`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password })
});

const { session } = await response.json();
localStorage.setItem('sessionToken', session.token);

// Then use it in headers
fetch(`${API_URL}/api/auth/me`, {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`
  }
})
```

### Step 3: Configure CORS if Cross-Origin
```javascript
// In Fastify (backend)
// Already properly configured by framework

// In Frontend - Use the right approach
const API_URL = 'http://localhost:3000';

fetch(`${API_URL}/api/auth/me`, {
  credentials: 'include',  // Critical for cross-origin
  method: 'GET'
})
```

---

## Session Flow - Complete Journey

### Step 1: User Signs In
```
POST /api/auth/sign-in/username-email
│
├─ Server validates credentials
├─ Creates session in database
│  ├─ Session ID: UUID
│  ├─ Session Token: UUID
│  ├─ Expires: 7 days from now
│  └─ Stored in auth_schema.session table
│
├─ Sets Response Header:
│  └─ Set-Cookie: session=<token>; HttpOnly; Path=/; ...
│
└─ Returns Response (status 200):
   └─ {
       "user": {...},
       "session": {
         "token": "...",  // For client-side storage
         "expiresAt": "..."
       }
     }
```

### Step 2: Browser Receives Response
```
Browser receives:
├─ Response body with user data
├─ Set-Cookie header (sets cookie in browser)
└─ Cookie stored in browser for domain
```

### Step 3: Frontend Makes Authenticated Request
```
GET /api/auth/me
│
├─ OPTION A: With Credentials (PREFERRED)
│  ├─ Browser automatically sends cookies
│  └─ Request Headers:
│     ├─ Cookie: session=<token>
│     └─ (automatically sent)
│
└─ OPTION B: With Authorization Header (FALLBACK)
   └─ Request Headers:
      └─ Authorization: Bearer <token>
```

### Step 4: Backend Validates Session
```
Server receives request:
├─ Extracts session token from:
│  ├─ Cookie: session=<token> (preferred)
│  └─ OR Authorization: Bearer <token> (fallback)
│
├─ Queries database:
│  └─ SELECT * FROM session WHERE token = '<token>'
│
├─ Validates:
│  ├─ Session exists
│  ├─ Not expired
│  └─ Belongs to user
│
└─ Returns:
   ├─ ✅ Session valid: Proceed
   └─ ❌ Session invalid: Return 401
```

---

## Testing the Fix

### Test 1: Verify Cookies Are Set
```bash
# Sign in and check Set-Cookie header
curl -i -X POST http://localhost:3000/api/auth/sign-in/username-email \
  -H "Content-Type: application/json" \
  -d '{"identifier":"user@example.com","password":"password123"}'

# Look for response header:
# Set-Cookie: session=<uuid>; HttpOnly; Path=/; SameSite=Lax; Max-Age=604800
```

### Test 2: Verify Session Token in Response
```bash
# Check response body includes session token
curl -X POST http://localhost:3000/api/auth/sign-in/username-email \
  -H "Content-Type: application/json" \
  -d '{"identifier":"user@example.com","password":"password123"}' \
  | jq '.session.token'

# Should output: "some-uuid-value"
```

### Test 3: Verify Session Validation with Cookies
```bash
# First, sign in and capture the Set-Cookie
RESPONSE=$(curl -i -X POST http://localhost:3000/api/auth/sign-in/username-email \
  -H "Content-Type: application/json" \
  -d '{"identifier":"user@example.com","password":"password123"}')

# Extract the Set-Cookie header
COOKIE=$(echo "$RESPONSE" | grep "Set-Cookie:" | cut -d' ' -f2-)

# Use the cookie in the next request
curl -H "Cookie: $COOKIE" http://localhost:3000/api/auth/me

# Should return 200 with user data
```

### Test 4: Verify Session Validation with Authorization Header
```bash
# Get session token from signin response
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/sign-in/username-email \
  -H "Content-Type: application/json" \
  -d '{"identifier":"user@example.com","password":"password123"}' \
  | jq -r '.session.token')

# Use the token in Authorization header
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/auth/me

# Should return 200 with user data
```

### Test 5: Use Debug Endpoint
```bash
# Check current session status (dev only)
curl http://localhost:3000/api/auth/debug/session

# With cookie
curl -H "Cookie: session=<token>" http://localhost:3000/api/auth/debug/session

# Response shows:
# - Session status (found/not_found)
# - Available cookies
# - Auth header status
```

---

## Files Modified

| File | Lines | Changes |
|------|-------|---------|
| src/routes/auth.ts | 78-130 | Added debug endpoint for sessions |
| src/routes/auth.ts | 470-484 | Enhanced logging in /api/auth/me |
| src/routes/auth.ts | 1428-1477 | Improved cookie setting in username/email signin |
| src/routes/auth.ts | 1564-1611 | Improved cookie setting in email-only signin |

---

## Configuration Options

### For Development (Localhost)
```
SameSite=Lax  ✅ Works for same-origin
Secure=false  ✅ Not required (no HTTPS)
HttpOnly=true ✅ Required (security)
```

### For Production (HTTPS)
```
SameSite=Lax    ✅ Most secure for SPA
Secure=true     ✅ HTTPS only
HttpOnly=true   ✅ Required (security)
```

### For Cross-Origin APIs (if needed)
```
SameSite=None  ⚠️ Less secure, only if needed
Secure=true    ✅ HTTPS required
HttpOnly=true  ✅ Still recommended
```

---

## Common Issues & Solutions

### Issue: 401 "Session validation failed" after signin
**Cause:** Frontend not sending cookies with requests

**Solution:**
```javascript
// ADD to all fetch requests:
fetch('/api/auth/me', {
  credentials: 'include'  // ← CRITICAL
})
```

### Issue: Cookie set in response but not sent in next request
**Cause:** CORS issue - credentials not included

**Solution:**
- Use `credentials: 'include'` on frontend
- OR use `Authorization: Bearer <token>` header
- OR configure CORS with credentia options

### Issue: "Cookie header is malformed"
**Cause:** Cookie string not properly formatted

**Current Fix:** Properly validated and formatted cookies

**Verification:**
```bash
curl -v http://localhost:3000/api/auth/signin... 2>&1 | grep "Set-Cookie:"
```

### Issue: Session expires too quickly
**Current Setting:** 7 days (604800 seconds)

**Can be adjusted in code:**
```typescript
expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
```

---

## Security Considerations

### ✅ Security Features Enabled
- HTTP-only cookie (XSS protection)
- SameSite=Lax (CSRF protection)
- Session expiration (token rotation)
- Secure flag in production (HTTPS only)

### ⚠️ When to Change SameSite
Only change from `Lax` to `None` if:
- API is truly cross-origin
- And `credentials: 'include'` is being used
- And HTTPS is enabled (`Secure=true`)

### 🔒 Best Practices
1. ✅ Always use `credentials: 'include'` for same-origin
2. ✅ Return token in body as fallback
3. ✅ Log session issues for debugging
4. ✅ Validate session expiration
5. ✅ Clear cookies on logout

---

## Summary

**Main Issue:** Frontend must send cookies with requests via `credentials: 'include'`

**Backend Fixes Applied:**
1. ✅ Improved cookie setting logic
2. ✅ Return session token in response body
3. ✅ Enhanced debugging capabilities
4. ✅ Better logging for troubleshooting

**Frontend Required:**
1. ✅ Add `credentials: 'include'` to all requests
2. ✅ OR use `Authorization: Bearer <token>` as fallback
3. ✅ Store session token from response

**Status:** Ready for testing and deployment
