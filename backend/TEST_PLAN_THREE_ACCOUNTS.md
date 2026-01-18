# Test Plan - Three User Accounts

## Test Objectives

Verify that all three user accounts can:
1. ✅ Authenticate successfully
2. ✅ Maintain active sessions after sign-in
3. ✅ Access their own profile data
4. ✅ Access other users' profiles
5. ✅ Session validation works properly
6. ✅ Profile pages load correctly

---

## Test Accounts

| Email | Username | Display Name |
|-------|----------|--------------|
| yomicrex@gmail.com | Yomicrex | (to verify) |
| yomicrex@mail.com | JJ1980 | (to verify) |
| yomicrex@hotmail.com | JJ1981 | (to verify) |

---

## Test Suite 1: Account Discovery & Verification

### Test 1.1: Get List of All Users
**Endpoint:** `GET /api/admin/users/list`
**Purpose:** Verify all three accounts exist in the system

**Request:**
```bash
curl -X GET http://localhost:3000/api/admin/users/list \
  -H "Content-Type: application/json"
```

**Expected Response:**
- Status: 200 OK
- Contains all three users:
  - Email: yomicrex@gmail.com, Username: Yomicrex
  - Email: yomicrex@mail.com, Username: JJ1980
  - Email: yomicrex@hotmail.com, Username: JJ1981

**Verification Points:**
- [ ] All three emails present
- [ ] All three usernames present
- [ ] User IDs returned
- [ ] Creation timestamps valid

---

### Test 1.2: Check Username Availability
**Endpoint:** `GET /api/auth/check-username/:username`
**Purpose:** Verify all three usernames are taken (not available)

**Request 1:** Check Yomicrex
```bash
curl -X GET http://localhost:3000/api/auth/check-username/Yomicrex
```

**Expected Response:**
```json
{
  "available": false,
  "username": "Yomicrex"
}
```

**Request 2:** Check JJ1980
```bash
curl -X GET http://localhost:3000/api/auth/check-username/JJ1980
```

**Expected Response:**
```json
{
  "available": false,
  "username": "JJ1980"
}
```

**Request 3:** Check JJ1981
```bash
curl -X GET http://localhost:3000/api/auth/check-username/JJ1981
```

**Expected Response:**
```json
{
  "available": false,
  "username": "JJ1981"
}
```

**Verification Points:**
- [ ] All three usernames show as taken (available: false)
- [ ] No validation errors

---

## Test Suite 2: Authentication Flow

### Test 2.1: Email-Only Sign-In for Account 1
**Endpoint:** `POST /api/auth/email/signin`
**Account:** yomicrex@gmail.com / Yomicrex

**Request:**
```bash
curl -X POST http://localhost:3000/api/auth/email/signin \
  -H "Content-Type: application/json" \
  -d '{"email": "yomicrex@gmail.com"}'
```

**Expected Response:**
- Status: 200 OK
- Response body:
```json
{
  "user": {
    "id": "<uuid>",
    "email": "yomicrex@gmail.com",
    "name": "Yomicrex"
  }
}
```
- Response headers contain:
```
Set-Cookie: session=<token>; HttpOnly; Path=/; SameSite=Lax; Max-Age=604800
```

**Verification Points:**
- [ ] Status 200
- [ ] User ID returned
- [ ] Email matches
- [ ] Session cookie set
- [ ] Cookie is HttpOnly (secure)
- [ ] Cookie Max-Age is 604800 (7 days)

**Store Session Token:** Save the `session` cookie value for subsequent requests
```
SESSION_1=<token_from_cookie>
```

---

### Test 2.2: Email-Only Sign-In for Account 2
**Endpoint:** `POST /api/auth/email/signin`
**Account:** yomicrex@mail.com / JJ1980

**Request:**
```bash
curl -X POST http://localhost:3000/api/auth/email/signin \
  -H "Content-Type: application/json" \
  -d '{"email": "yomicrex@mail.com"}'
```

**Expected Response:**
- Status: 200 OK
- Response includes user with email: yomicrex@mail.com
- Session cookie set

**Verification Points:**
- [ ] Status 200
- [ ] Different user ID than Account 1
- [ ] Email is yomicrex@mail.com
- [ ] Session cookie set

**Store Session Token:**
```
SESSION_2=<token_from_cookie>
```

---

### Test 2.3: Email-Only Sign-In for Account 3
**Endpoint:** `POST /api/auth/email/signin`
**Account:** yomicrex@hotmail.com / JJ1981

**Request:**
```bash
curl -X POST http://localhost:3000/api/auth/email/signin \
  -H "Content-Type: application/json" \
  -d '{"email": "yomicrex@hotmail.com"}'
```

**Expected Response:**
- Status: 200 OK
- Response includes user with email: yomicrex@hotmail.com
- Session cookie set

**Verification Points:**
- [ ] Status 200
- [ ] Different user ID than Accounts 1 & 2
- [ ] Email is yomicrex@hotmail.com
- [ ] Session cookie set

**Store Session Token:**
```
SESSION_3=<token_from_cookie>
```

---

## Test Suite 3: Session Validation & Persistence

### Test 3.1: Validate Session 1 (Yomicrex)
**Endpoint:** `GET /api/auth/me`
**Purpose:** Verify session persists and is recognized

**Request:**
```bash
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer <SESSION_1>" \
  -H "Cookie: session=<SESSION_1>"
```

**Expected Response:**
- Status: 200 OK
- Response:
```json
{
  "user": {
    "id": "<uuid>",
    "email": "yomicrex@gmail.com",
    "name": "Yomicrex",
    "emailVerified": false,
    "createdAt": "...",
    "updatedAt": "..."
  },
  "profile": {
    "id": "<uuid>",
    "email": "yomicrex@gmail.com",
    "username": "Yomicrex",
    "displayName": "...",
    "bio": "...",
    "location": "...",
    "avatarUrl": null,
    "collectionPrivacy": "public",
    "role": "user",
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

**Verification Points:**
- [ ] Status 200 (session valid)
- [ ] User ID matches Account 1
- [ ] Email matches yomicrex@gmail.com
- [ ] Username is Yomicrex
- [ ] Profile data present
- [ ] Session persists after sign-in

---

### Test 3.2: Validate Session 2 (JJ1980)
**Endpoint:** `GET /api/auth/me`
**Purpose:** Verify different session for different user

**Request:**
```bash
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer <SESSION_2>" \
  -H "Cookie: session=<SESSION_2>"
```

**Expected Response:**
- Status: 200 OK
- User matches Account 2 (JJ1980)
- Email: yomicrex@mail.com
- Username: JJ1980

**Verification Points:**
- [ ] Status 200
- [ ] User ID different from Account 1
- [ ] Email matches yomicrex@mail.com
- [ ] Username is JJ1980
- [ ] Profile data present

---

### Test 3.3: Validate Session 3 (JJ1981)
**Endpoint:** `GET /api/auth/me`
**Purpose:** Verify third session

**Request:**
```bash
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer <SESSION_3>" \
  -H "Cookie: session=<SESSION_3>"
```

**Expected Response:**
- Status: 200 OK
- User matches Account 3 (JJ1981)
- Email: yomicrex@hotmail.com
- Username: JJ1981

**Verification Points:**
- [ ] Status 200
- [ ] User ID different from Accounts 1 & 2
- [ ] Email matches yomicrex@hotmail.com
- [ ] Username is JJ1981
- [ ] Profile data present

---

## Test Suite 4: Profile Access - Own Profiles

### Test 4.1: Access Own Profile - Account 1 (Yomicrex)
**Endpoint:** `GET /api/users/Yomicrex`
**Purpose:** View own profile as authenticated user

**Request:**
```bash
curl -X GET http://localhost:3000/api/users/Yomicrex \
  -H "Authorization: Bearer <SESSION_1>" \
  -H "Cookie: session=<SESSION_1>"
```

**Expected Response:**
- Status: 200 OK
- Profile data:
```json
{
  "id": "<uuid>",
  "username": "Yomicrex",
  "displayName": "...",
  "email": "yomicrex@gmail.com",
  "bio": "...",
  "location": "...",
  "avatarUrl": null,
  "collectionPrivacy": "public",
  "followerCount": 0,
  "followingCount": 0,
  "isFollowing": false,
  "createdAt": "...",
  "updatedAt": "..."
}
```

**Verification Points:**
- [ ] Status 200
- [ ] Username matches "Yomicrex"
- [ ] Email is yomicrex@gmail.com
- [ ] Profile data complete
- [ ] Follow counts present (can be 0)
- [ ] isFollowing: false (viewing own profile)

---

### Test 4.2: Access Own Profile - Account 2 (JJ1980)
**Endpoint:** `GET /api/users/JJ1980`

**Request:**
```bash
curl -X GET http://localhost:3000/api/users/JJ1980 \
  -H "Authorization: Bearer <SESSION_2>" \
  -H "Cookie: session=<SESSION_2>"
```

**Expected Response:**
- Status: 200 OK
- Username: JJ1980
- Email: yomicrex@mail.com
- Profile complete

**Verification Points:**
- [ ] Status 200
- [ ] Username is JJ1980
- [ ] Email is yomicrex@mail.com
- [ ] All profile fields present

---

### Test 4.3: Access Own Profile - Account 3 (JJ1981)
**Endpoint:** `GET /api/users/JJ1981`

**Request:**
```bash
curl -X GET http://localhost:3000/api/users/JJ1981 \
  -H "Authorization: Bearer <SESSION_3>" \
  -H "Cookie: session=<SESSION_3>"
```

**Expected Response:**
- Status: 200 OK
- Username: JJ1981
- Email: yomicrex@hotmail.com
- Profile complete

**Verification Points:**
- [ ] Status 200
- [ ] Username is JJ1981
- [ ] Email is yomicrex@hotmail.com
- [ ] All profile fields present

---

## Test Suite 5: Cross-User Profile Access

### Test 5.1: Account 1 Views Account 2's Profile
**Endpoint:** `GET /api/users/JJ1980`
**Session:** SESSION_1 (Yomicrex)

**Request:**
```bash
curl -X GET http://localhost:3000/api/users/JJ1980 \
  -H "Authorization: Bearer <SESSION_1>" \
  -H "Cookie: session=<SESSION_1>"
```

**Expected Response:**
- Status: 200 OK
- Returns JJ1980's profile
- isFollowing: false

**Verification Points:**
- [ ] Status 200
- [ ] Profile belongs to JJ1980 (not Yomicrex)
- [ ] Can access other user's profile
- [ ] isFollowing shows false

---

### Test 5.2: Account 1 Views Account 3's Profile
**Endpoint:** `GET /api/users/JJ1981`
**Session:** SESSION_1 (Yomicrex)

**Request:**
```bash
curl -X GET http://localhost:3000/api/users/JJ1981 \
  -H "Authorization: Bearer <SESSION_1>" \
  -H "Cookie: session=<SESSION_1>"
```

**Expected Response:**
- Status: 200 OK
- Returns JJ1981's profile

**Verification Points:**
- [ ] Status 200
- [ ] Profile belongs to JJ1981
- [ ] Can access different user's profile

---

### Test 5.3: Account 2 Views Account 1's Profile
**Endpoint:** `GET /api/users/Yomicrex`
**Session:** SESSION_2 (JJ1980)

**Request:**
```bash
curl -X GET http://localhost:3000/api/users/Yomicrex \
  -H "Authorization: Bearer <SESSION_2>" \
  -H "Cookie: session=<SESSION_2>"
```

**Expected Response:**
- Status: 200 OK
- Returns Yomicrex's profile

**Verification Points:**
- [ ] Status 200
- [ ] Profile belongs to Yomicrex
- [ ] Different user can view profile

---

### Test 5.4: Account 2 Views Account 3's Profile
**Endpoint:** `GET /api/users/JJ1981`
**Session:** SESSION_2 (JJ1980)

**Request:**
```bash
curl -X GET http://localhost:3000/api/users/JJ1981 \
  -H "Authorization: Bearer <SESSION_2>" \
  -H "Cookie: session=<SESSION_2>"
```

**Expected Response:**
- Status: 200 OK
- Returns JJ1981's profile

**Verification Points:**
- [ ] Status 200
- [ ] Profile belongs to JJ1981

---

### Test 5.5: Account 3 Views Account 1's Profile
**Endpoint:** `GET /api/users/Yomicrex`
**Session:** SESSION_3 (JJ1981)

**Request:**
```bash
curl -X GET http://localhost:3000/api/users/Yomicrex \
  -H "Authorization: Bearer <SESSION_3>" \
  -H "Cookie: session=<SESSION_3>"
```

**Expected Response:**
- Status: 200 OK
- Returns Yomicrex's profile

**Verification Points:**
- [ ] Status 200
- [ ] Profile belongs to Yomicrex

---

### Test 5.6: Account 3 Views Account 2's Profile
**Endpoint:** `GET /api/users/JJ1980`
**Session:** SESSION_3 (JJ1981)

**Request:**
```bash
curl -X GET http://localhost:3000/api/users/JJ1980 \
  -H "Authorization: Bearer <SESSION_3>" \
  -H "Cookie: session=<SESSION_3>"
```

**Expected Response:**
- Status: 200 OK
- Returns JJ1980's profile

**Verification Points:**
- [ ] Status 200
- [ ] Profile belongs to JJ1980

---

## Test Suite 6: Session Isolation & Security

### Test 6.1: Invalid Session Returns 401
**Endpoint:** `GET /api/auth/me`
**Purpose:** Verify invalid session is rejected

**Request:**
```bash
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer invalid_token_12345"
```

**Expected Response:**
- Status: 401 Unauthorized
- No user data returned

**Verification Points:**
- [ ] Status 401
- [ ] No session data leaked

---

### Test 6.2: Cross-Session Isolation
**Endpoint:** `GET /api/auth/me`
**Purpose:** Verify SESSION_1 can't access SESSION_2 data

**Request (using wrong session):**
```bash
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer <SESSION_2>" \
  -H "Cookie: session=<SESSION_2>"
```

**Expected Response:**
- Status: 200 OK
- Returns SESSION_2 user (JJ1980), NOT SESSION_1 user (Yomicrex)

**Verification Points:**
- [ ] Status 200
- [ ] Returns correct user for provided session
- [ ] Sessions don't interfere with each other

---

## Test Suite 7: Profile Consistency

### Test 7.1: Profile Data Consistency - Account 1
**Purpose:** Verify profile data is consistent across endpoints

**Fetch from /api/auth/me:**
```bash
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer <SESSION_1>" \
  -H "Cookie: session=<SESSION_1>"
```

**Fetch from /api/users/Yomicrex:**
```bash
curl -X GET http://localhost:3000/api/users/Yomicrex \
  -H "Authorization: Bearer <SESSION_1>" \
  -H "Cookie: session=<SESSION_1>"
```

**Verification Points:**
- [ ] Same username in both responses
- [ ] Same email in both responses
- [ ] Same user ID in both responses
- [ ] Profile data matches

---

### Test 7.2: Profile Data Consistency - Account 2
**Purpose:** Verify profile consistency for second account

**Fetch from /api/auth/me:**
```bash
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer <SESSION_2>" \
  -H "Cookie: session=<SESSION_2>"
```

**Fetch from /api/users/JJ1980:**
```bash
curl -X GET http://localhost:3000/api/users/JJ1980 \
  -H "Authorization: Bearer <SESSION_2>" \
  -H "Cookie: session=<SESSION_2>"
```

**Verification Points:**
- [ ] Same username: JJ1980
- [ ] Same email: yomicrex@mail.com
- [ ] Same user ID
- [ ] Data consistent

---

### Test 7.3: Profile Data Consistency - Account 3
**Purpose:** Verify profile consistency for third account

**Verification Points:**
- [ ] Same username: JJ1981
- [ ] Same email: yomicrex@hotmail.com
- [ ] Same user ID across endpoints
- [ ] All data consistent

---

## Test Suite 8: Error Scenarios

### Test 8.1: Non-Existent User Profile
**Endpoint:** `GET /api/users/NonExistentUser`

**Request:**
```bash
curl -X GET http://localhost:3000/api/users/NonExistentUser
```

**Expected Response:**
- Status: 404 Not Found
- Error message: "User not found"

**Verification Points:**
- [ ] Status 404
- [ ] Proper error message

---

### Test 8.2: Missing Email in Sign-In
**Endpoint:** `POST /api/auth/email/signin`

**Request:**
```bash
curl -X POST http://localhost:3000/api/auth/email/signin \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Expected Response:**
- Status: 400 Bad Request
- Validation error

**Verification Points:**
- [ ] Status 400
- [ ] Error message indicates missing field

---

### Test 8.3: Non-Existent Email Sign-In
**Endpoint:** `POST /api/auth/email/signin`

**Request:**
```bash
curl -X POST http://localhost:3000/api/auth/email/signin \
  -H "Content-Type: application/json" \
  -d '{"email": "nonexistent@example.com"}'
```

**Expected Response:**
- Status: 404 Not Found
- Error: "No account found with this email address"

**Verification Points:**
- [ ] Status 404
- [ ] Generic error (no user enumeration)

---

## Summary Checklist

### Authentication (Test Suite 2)
- [ ] Account 1 (Yomicrex) - Email-only signin works
- [ ] Account 2 (JJ1980) - Email-only signin works
- [ ] Account 3 (JJ1981) - Email-only signin works
- [ ] All sessions created successfully
- [ ] All cookies set with correct properties

### Session Management (Test Suite 3)
- [ ] Account 1 - Session validates and persists
- [ ] Account 2 - Session validates and persists
- [ ] Account 3 - Session validates and persists
- [ ] Sessions are isolated (don't interfere)

### Profile Access (Test Suites 4 & 5)
- [ ] Account 1 - Own profile accessible
- [ ] Account 2 - Own profile accessible
- [ ] Account 3 - Own profile accessible
- [ ] Cross-user profile access works (6 tests)
- [ ] All profiles load completely

### Data Consistency (Test Suite 7)
- [ ] Account 1 - Data consistent across endpoints
- [ ] Account 2 - Data consistent across endpoints
- [ ] Account 3 - Data consistent across endpoints

### Security (Test Suite 6)
- [ ] Invalid sessions rejected (401)
- [ ] Sessions properly isolated

### Overall Status
- [ ] All 38+ test cases passing
- [ ] All three accounts fully functional
- [ ] Authentication working properly
- [ ] Session management solid
- [ ] Profile pages loading correctly
- [ ] Cross-user interaction working
- [ ] Ready for production

---

## Notes

- Replace `<SESSION_1>`, `<SESSION_2>`, `<SESSION_3>` with actual token values
- Most tests can be automated with a test runner
- Check application logs for any errors
- Monitor database for data consistency
- Verify no sensitive data in logs or responses

---

## Test Execution

Run tests in this order:
1. Suite 1 - Account Discovery (verify accounts exist)
2. Suite 2 - Authentication (create sessions)
3. Suite 3 - Session Validation (verify persistence)
4. Suite 4 - Own Profile Access
5. Suite 5 - Cross-User Access
6. Suite 6 - Security Tests
7. Suite 7 - Consistency Tests
8. Suite 8 - Error Scenarios

**Estimated Time:** 15-20 minutes for full test suite
