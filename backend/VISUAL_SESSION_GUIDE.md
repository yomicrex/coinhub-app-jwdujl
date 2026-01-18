# Visual Session Management Guide

## Architecture Overview

```
┌────────────────────────────────────────────────────────────────────────┐
│                         FRONTEND APPLICATION                           │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  1. User enters email: user@example.com                               │
│  2. Clicks "Login"                                                    │
│                                                                        │
│  fetch('/api/auth/email/signin', {                                    │
│    method: 'POST',                                                    │
│    credentials: 'include',  ⚠️ Important!                             │
│    body: { email: 'user@example.com' }                                │
│  })                                                                    │
│                                                                        │
└────────┬─────────────────────────────────────────────────────────────┘
         │
         │ HTTP Request
         │ POST /api/auth/email/signin
         │ { email: "user@example.com" }
         │
         ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      BACKEND API (Fastify)                             │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  app.fastify.post('/api/auth/email/signin', async (req, res) => {    │
│                                                                        │
│    1. Validate email format ✅                                         │
│    2. Find user by email (case-insensitive) ✅                         │
│    3. Create session in database ✅                                    │
│    4. Set Set-Cookie header ✅                                         │
│    5. Return response ✅                                               │
│  })                                                                    │
│                                                                        │
└────────┬─────────────────────────────────────────────────────────────┘
         │
         │ HTTP Response (200 OK)
         │ Headers:
         │   Set-Cookie: session=550e8400-e29b-41d4-a716-446655440000;
         │              HttpOnly; Path=/; SameSite=Lax; Max-Age=604800
         │
         │ Body:
         │ {
         │   user: { id, email, name },
         │   session: { token, expiresAt }
         │ }
         │
         ▼
┌────────────────────────────────────────────────────────────────────────┐
│                         BROWSER STORAGE                                │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  Cookies (Stored Securely):                                           │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │ session=550e8400-e29b-41d4-a716-446655440000                    │ │
│  │ HttpOnly: Yes (JavaScript cannot access)                        │ │
│  │ SameSite: Lax (CSRF protection)                                 │ │
│  │ Expires: now + 7 days                                           │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│                                                                        │
└────────┬─────────────────────────────────────────────────────────────┘
         │
         │ Page Refresh or Later Request
         │
         ▼
┌────────────────────────────────────────────────────────────────────────┐
│                         FRONTEND APPLICATION                           │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  On mount or after login:                                             │
│                                                                        │
│  fetch('/api/auth/session', {                                         │
│    credentials: 'include'  ⚠️ Important!                              │
│  })                                                                    │
│                                                                        │
│  Browser automatically includes cookie:                               │
│  Cookie: session=550e8400-e29b-41d4-a716-446655440000               │
│                                                                        │
└────────┬─────────────────────────────────────────────────────────────┘
         │
         │ HTTP Request
         │ GET /api/auth/session
         │ Cookie: session=550e8400-e29b-41d4-a716-446655440000
         │
         ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      BACKEND API (Fastify)                             │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  app.fastify.get('/api/auth/session', async (req, res) => {          │
│                                                                        │
│    1. Read session cookie from request ✅                             │
│    2. Look up session in database ✅                                  │
│    3. Check if expired ✅                                             │
│    4. Get user from database ✅                                       │
│    5. Return user + session data ✅                                   │
│  })                                                                    │
│                                                                        │
└────────┬─────────────────────────────────────────────────────────────┘
         │
         │ HTTP Response (200 OK)
         │ Body:
         │ {
         │   user: { id, email, name, ... },
         │   session: { id, token, expiresAt, ... }
         │ }
         │
         ▼
┌────────────────────────────────────────────────────────────────────────┐
│                         FRONTEND APPLICATION                           │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  if (data.user) {                                                     │
│    // User is logged in! Show dashboard                               │
│    redirect('/dashboard')                                             │
│  } else {                                                              │
│    // No valid session, show login                                    │
│    redirect('/login')                                                 │
│  }                                                                     │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Session Lifecycle States

```
┌──────────────────────────────────────────────────────────────────────────┐
│ STATE 1: USER NOT LOGGED IN                                              │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Cookie: NONE                                                           │
│  Session in DB: NONE                                                    │
│  User State: LOGGED_OUT                                                 │
│                                                                          │
│  Show: Login page                                                       │
│                                                                          │
└────────────────────────┬─────────────────────────────────────────────────┘
                         │
                         │ User clicks Login
                         │ POST /api/auth/email/signin
                         │
                         ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ STATE 2: LOGIN IN PROGRESS                                               │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Cookie: BEING_SET                                                      │
│  Session in DB: JUST_CREATED                                            │
│  User State: AUTHENTICATING                                             │
│                                                                          │
│  Action: Browser processes Set-Cookie header                            │
│                                                                          │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
                             │ Cookie stored
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ STATE 3: USER LOGGED IN (ACTIVE SESSION)                                │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Cookie: STORED (session=token)                                         │
│  Session in DB: VALID (not expired)                                     │
│  User State: LOGGED_IN                                                  │
│                                                                          │
│  Actions:                                                               │
│  - User can access protected endpoints                                  │
│  - Cookie sent automatically with each request                          │
│  - GET /api/auth/session returns user data                              │
│                                                                          │
│  Duration: Up to 7 days or manual logout                                │
│                                                                          │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
                             │ 7 days pass OR user clicks Logout
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ STATE 4: SESSION EXPIRED OR INVALIDATED                                  │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Cookie: EXPIRED or CLEARED                                             │
│  Session in DB: DELETED                                                 │
│  User State: LOGGED_OUT                                                 │
│                                                                          │
│  Action: GET /api/auth/session returns { user: null, session: null }    │
│          Frontend redirects to login                                     │
│                                                                          │
└──────────────────────────┬────────────────────────────────────────────────┘
                           │
                           │ User logs in again
                           │
                           └──> STATE 1 (back to login page)
```

---

## Database Schema

```
┌─────────────────────────────────────────────────────┐
│          SESSION TABLE (PostgreSQL)                 │
├─────────────────────────────────────────────────────┤
│                                                     │
│  id: text (UUID)           - Primary Key            │
│  user_id: text             - Foreign Key → user     │
│  token: text (UUID)        - Unique, Session Token  │
│  expires_at: timestamp     - Expiration Time        │
│  created_at: timestamp     - Creation Time          │
│  updated_at: timestamp     - Last Update            │
│  ip_address: text          - Client IP              │
│  user_agent: text          - Browser Info           │
│                                                     │
│  Example Row:                                       │
│  ┌─────────────────────────────────────────────┐   │
│  │ id         | abc123abc123abc123abc123abc   │   │
│  │ user_id    | user_123                      │   │
│  │ token      | 550e8400-e29b-41d4-a716-... │   │
│  │ expires_at | 2024-01-22 10:30:00           │   │
│  │ created_at | 2024-01-15 10:30:00           │   │
│  │ ip_address | 192.168.1.100                 │   │
│  │ user_agent | Mozilla/5.0 (Windows)...      │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
└─────────────────────────────────────────────────────┘
         │
         │ One-to-Many: User has many Sessions
         │
         ▼
┌─────────────────────────────────────────────────────┐
│           USER TABLE (Better Auth)                  │
├─────────────────────────────────────────────────────┤
│                                                     │
│  id: text (UUID)           - Primary Key            │
│  email: text               - Email Address          │
│  name: text                - User Name              │
│  email_verified: boolean   - Verified Flag          │
│  image: text               - Avatar URL             │
│  created_at: timestamp     - Creation Time          │
│  updated_at: timestamp     - Last Update            │
│                                                     │
│  Example Row:                                       │
│  ┌─────────────────────────────────────────────┐   │
│  │ id          | user_123                      │   │
│  │ email       | user@example.com              │   │
│  │ name        | John Doe                      │   │
│  │ email_verified | false                      │   │
│  │ image       | null                          │   │
│  │ created_at  | 2024-01-15 10:30:00           │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## Request/Response Flow Diagram

```
SCENARIO: User Logs In and Page Reloads

Timeline:
─────────────────────────────────────────────────────────────

1. T=0:00  User enters email and clicks Login
           ↓
           POST /api/auth/email/signin
           { "email": "user@example.com" }

2. T=0:01  ✓ Backend finds user
           ✓ Creates session in database
           ✓ Response sent with Set-Cookie header
           ↓
           Set-Cookie: session=550e8400-e29b-41d4-a716-446655440000
           Response: 200 OK { user: {...}, session: {...} }

3. T=0:02  ✓ Browser stores cookie
           ✓ Frontend shows dashboard
           ✓ User can see protected data

4. T=0:30  User refreshes page
           ↓
           Page reloads, JavaScript re-initializes

5. T=0:31  Frontend calls checkSession()
           ↓
           GET /api/auth/session
           Cookie: session=550e8400-e29b-41d4-a716-446655440000 (sent automatically)

6. T=0:32  ✓ Backend reads cookie
           ✓ Validates session in database
           ✓ Session still valid? YES
           ✓ Response sent with user data
           ↓
           Response: 200 OK { user: {...}, session: {...} }

7. T=0:33  ✓ Frontend has user data
           ✓ Shows dashboard (no login needed!)
           ✓ Session persists across page refresh

─────────────────────────────────────────────────────────────
```

---

## Cookie Lifecycle Diagram

```
Time →

0 hours (Login):
├─ Backend sets Set-Cookie header
├─ Max-Age: 604800 (7 days)
├─ Expires At: now + 604800 seconds
└─ Cookie created in browser

3 hours (Still Active):
├─ User makes request
├─ Browser sends cookie automatically
├─ Backend validates: OK
├─ Session continues
└─ Remaining: 6 days 21 hours

7 days (Expiration):
├─ Current time = expires_at
├─ Cookie marked as expired
├─ Browser removes from storage
├─ Next request: No cookie sent
├─ Backend returns: { user: null, session: null }
└─ Frontend redirects to login

After Logout:
├─ Backend sets Set-Cookie with Max-Age=0
├─ Browser immediately removes cookie
├─ Session deleted from database
└─ User must log in again

```

---

## Code Path Visualization

### Email Signin
```
POST /api/auth/email/signin
├─ Parse request
├─ Validate email format (Zod schema)
├─ Normalize email to lowercase
├─ Query database: Find user by email
│  └─ SQL: WHERE LOWER(email) = LOWER(?)
├─ Check if user found
│  ├─ If not: Return 404
│  └─ If yes: Continue
├─ Create session in database
│  ├─ Generate sessionId (UUID)
│  ├─ Generate sessionToken (UUID)
│  ├─ Set expiresAt = now + 7 days
│  ├─ Insert into session table
│  └─ Return created session
├─ Set HTTP response header
│  └─ Set-Cookie: session=token; HttpOnly; Path=/; ...
├─ Return response
│  └─ { user: {...}, session: {...} }
└─ Log success
   └─ "Email-only sign-in successful"
```

### Session Retrieval
```
GET /api/auth/session
├─ Read request cookies
├─ Extract sessionToken from cookies['session']
├─ Check if sessionToken exists
│  ├─ If not: Return { user: null, session: null }
│  └─ If yes: Continue
├─ Query database: Find session by token
├─ Check if session found
│  ├─ If not: Return { user: null, session: null }
│  └─ If yes: Continue
├─ Check if session expired
│  ├─ If yes:
│  │  ├─ Delete session from database
│  │  └─ Return { user: null, session: null }
│  └─ If no: Continue
├─ Query database: Get user
├─ Check if user found
│  ├─ If not: Return { user: null, session: null }
│  └─ If yes: Continue
├─ Format response
├─ Return response
│  └─ { user: {...}, session: {...} }
└─ Log success
   └─ "Session retrieved successfully"
```

---

## Security Layers

```
┌─────────────────────────────────────────────────────┐
│              SECURITY LAYER 1: Cookie                │
├─────────────────────────────────────────────────────┤
│                                                     │
│  HttpOnly: ✓ (JavaScript cannot access)             │
│  Secure: ✓ (HTTPS only in production)               │
│  SameSite: ✓ Lax (CSRF protection)                  │
│  Path: / (available to whole domain)                │
│  Max-Age: 7 days (reasonable timeout)               │
│  Domain: Not set (current domain only)              │
│                                                     │
│  Browser stores securely and sends automatically    │
│                                                     │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│            SECURITY LAYER 2: Database Lookup         │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Cookie alone is NOT trusted!                       │
│  Backend must validate against database:            │
│                                                     │
│  1. Token must exist in session table               │
│  2. Session must not be expired                     │
│  3. User must still exist                           │
│  4. Session user_id must match query result         │
│                                                     │
│  Only after ALL checks: Return user data            │
│                                                     │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│           SECURITY LAYER 3: Expiration Cleanup       │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Expired sessions automatically deleted when:       │
│  - User tries to retrieve session                   │
│  - Session query detects expiration                 │
│  - Prevents stale session data                      │
│  - Prevents session hijacking after expiration      │
│                                                     │
│  7-day maximum lifetime prevents indefinite access  │
│                                                     │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│            SECURITY LAYER 4: Audit Trail             │
├─────────────────────────────────────────────────────┤
│                                                     │
│  All operations logged with context:                │
│                                                     │
│  - Session creation: User ID, email, token ID      │
│  - Session retrieval: User ID, session ID          │
│  - Session expiration: Session ID, expiration time │
│  - Errors: Full context with timestamp             │
│                                                     │
│  IP address and user agent stored in database       │
│  for security auditing and anomaly detection        │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## Troubleshooting Flowchart

```
Session not working?
│
├─ Check 1: Are you using credentials: 'include'?
│  ├─ NO  → Add it to fetch options
│  └─ YES → Continue
│
├─ Check 2: Is Set-Cookie header in response?
│  ├─ Browser DevTools → Network tab → Response headers
│  ├─ NO  → Backend issue, check logs
│  └─ YES → Continue
│
├─ Check 3: Is cookie stored in browser?
│  ├─ Browser DevTools → Application → Cookies
│  ├─ Missing → Browser won't store (check Set-Cookie options)
│  ├─ Expired → Cookie already expired
│  └─ Present → Continue
│
├─ Check 4: Is cookie sent in requests?
│  ├─ Browser DevTools → Network tab → Request headers
│  ├─ Missing → Add credentials: 'include'
│  └─ Present → Continue
│
├─ Check 5: Is session in database?
│  ├─ SELECT * FROM session WHERE token = '...';
│  ├─ No rows → Session wasn't created (backend issue)
│  ├─ Expired → Session past expiration date
│  └─ Valid → Continue
│
├─ Check 6: Does user still exist?
│  ├─ SELECT * FROM "user" WHERE id = '...';
│  ├─ No rows → User was deleted
│  └─ Found → Continue
│
└─ Check 7: Review logs
   ├─ "Email-only sign-in successful" → Signin worked
   ├─ "Session retrieved successfully" → Retrieval worked
   └─ Errors → See error logs for specific issues
```

---

## Summary

✅ Session cookie stored securely with HTTP-only flag
✅ Database validates cookie (not trusted alone)
✅ Automatic expiration cleanup after 7 days
✅ Comprehensive logging for auditing
✅ Frontend can persist sessions across reloads
✅ Complete error handling and recovery
