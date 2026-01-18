# Test Execution Guide - Three Account Testing

## Quick Start

This guide shows how to test the three accounts:
1. **yomicrex@gmail.com** (username: Yomicrex)
2. **yomicrex@mail.com** (username: JJ1980)
3. **yomicrex@hotmail.com** (username: JJ1981)

---

## Step 1: Verify Accounts Exist

### Check Admin Users List
```bash
curl -X GET http://localhost:3000/api/admin/users/list \
  -H "Content-Type: application/json"
```

**Look for:**
- All 3 users in response
- Correct usernames
- Correct emails
- Valid user IDs

**Response Example:**
```json
{
  "users": [
    {
      "id": "user_123abc",
      "email": "yomicrex@gmail.com",
      "username": "Yomicrex",
      "displayName": "...",
      "createdAt": "...",
      "emailVerified": false
    },
    {
      "id": "user_456def",
      "email": "yomicrex@mail.com",
      "username": "JJ1980",
      ...
    },
    {
      "id": "user_789ghi",
      "email": "yomicrex@hotmail.com",
      "username": "JJ1981",
      ...
    }
  ]
}
```

✅ **Success Criteria:** All 3 users present

---

## Step 2: Sign In with Account 1 (Yomicrex)

### Email-Only Sign-In
```bash
curl -X POST http://localhost:3000/api/auth/email/signin \
  -H "Content-Type: application/json" \
  -d '{"email": "yomicrex@gmail.com"}'
```

**Look for:**
- Status: 200 OK
- User data in response
- Session cookie in Set-Cookie header

**Response Example:**
```json
{
  "user": {
    "id": "user_123abc",
    "email": "yomicrex@gmail.com",
    "name": "Yomicrex"
  }
}
```

**Response Headers:**
```
Set-Cookie: session=eyJhbGc...; HttpOnly; Path=/; SameSite=Lax; Max-Age=604800
```

✅ **Success Criteria:**
- Status 200
- User ID returned
- Email matches
- Cookie set with HttpOnly flag

**💾 Save the session token from the Set-Cookie header**
```
SESSION_YOMICREX=eyJhbGc...
```

---

## Step 3: Sign In with Account 2 (JJ1980)

### Email-Only Sign-In
```bash
curl -X POST http://localhost:3000/api/auth/email/signin \
  -H "Content-Type: application/json" \
  -d '{"email": "yomicrex@mail.com"}'
```

**Look for:**
- Status: 200 OK
- Different user ID than Account 1
- Email: yomicrex@mail.com
- New session cookie

✅ **Success Criteria:**
- Status 200
- User ID different from Account 1
- Session cookie set

**💾 Save the session token**
```
SESSION_JJ1980=<token>
```

---

## Step 4: Sign In with Account 3 (JJ1981)

### Email-Only Sign-In
```bash
curl -X POST http://localhost:3000/api/auth/email/signin \
  -H "Content-Type: application/json" \
  -d '{"email": "yomicrex@hotmail.com"}'
```

**Look for:**
- Status: 200 OK
- Different user ID than Accounts 1 & 2
- Email: yomicrex@hotmail.com
- New session cookie

✅ **Success Criteria:**
- Status 200
- Unique user ID
- Session cookie set

**💾 Save the session token**
```
SESSION_JJ1981=<token>
```

---

## Step 5: Verify Session 1 (Yomicrex) - GET /api/auth/me

### Test Session Persistence
```bash
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer SESSION_YOMICREX" \
  -H "Cookie: session=SESSION_YOMICREX"
```

**Replace `SESSION_YOMICREX` with actual token**

**Look for:**
- Status: 200 OK
- user.email: yomicrex@gmail.com
- profile.username: Yomicrex
- Complete profile data

**Response Example:**
```json
{
  "user": {
    "id": "user_123abc",
    "email": "yomicrex@gmail.com",
    "name": "Yomicrex",
    "emailVerified": false
  },
  "profile": {
    "id": "user_123abc",
    "username": "Yomicrex",
    "displayName": "...",
    "email": "yomicrex@gmail.com",
    "bio": "...",
    "location": "...",
    "collectionPrivacy": "public",
    "role": "user"
  }
}
```

✅ **Success Criteria:**
- Status 200 (session valid)
- Correct user data
- Correct profile data
- Session persists after sign-in

---

## Step 6: Verify Session 2 (JJ1980) - GET /api/auth/me

```bash
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer SESSION_JJ1980" \
  -H "Cookie: session=SESSION_JJ1980"
```

**Look for:**
- Status: 200 OK
- user.email: yomicrex@mail.com
- profile.username: JJ1980
- Different user ID than Session 1

✅ **Success Criteria:**
- Status 200
- User data for JJ1980
- Different from Account 1

---

## Step 7: Verify Session 3 (JJ1981) - GET /api/auth/me

```bash
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer SESSION_JJ1981" \
  -H "Cookie: session=SESSION_JJ1981"
```

**Look for:**
- Status: 200 OK
- user.email: yomicrex@hotmail.com
- profile.username: JJ1981
- Different user ID than Sessions 1 & 2

✅ **Success Criteria:**
- Status 200
- User data for JJ1981
- Unique session

---

## Step 8: Access Own Profile - Yomicrex

### GET /api/users/Yomicrex
```bash
curl -X GET http://localhost:3000/api/users/Yomicrex \
  -H "Authorization: Bearer SESSION_YOMICREX" \
  -H "Cookie: session=SESSION_YOMICREX"
```

**Look for:**
- Status: 200 OK
- username: Yomicrex
- email: yomicrex@gmail.com
- All profile fields present

**Response Example:**
```json
{
  "id": "user_123abc",
  "username": "Yomicrex",
  "displayName": "...",
  "email": "yomicrex@gmail.com",
  "bio": "...",
  "location": "...",
  "followerCount": 0,
  "followingCount": 0,
  "isFollowing": false
}
```

✅ **Success Criteria:**
- Status 200
- Username matches
- Profile loads correctly

---

## Step 9: Access Own Profile - JJ1980

### GET /api/users/JJ1980
```bash
curl -X GET http://localhost:3000/api/users/JJ1980 \
  -H "Authorization: Bearer SESSION_JJ1980" \
  -H "Cookie: session=SESSION_JJ1980"
```

**Look for:**
- Status: 200 OK
- username: JJ1980
- email: yomicrex@mail.com

✅ **Success Criteria:**
- Status 200
- Correct profile data

---

## Step 10: Access Own Profile - JJ1981

### GET /api/users/JJ1981
```bash
curl -X GET http://localhost:3000/api/users/JJ1981 \
  -H "Authorization: Bearer SESSION_JJ1981" \
  -H "Cookie: session=SESSION_JJ1981"
```

**Look for:**
- Status: 200 OK
- username: JJ1981
- email: yomicrex@hotmail.com

✅ **Success Criteria:**
- Status 200
- Correct profile data

---

## Step 11: Cross-User Profile Access

### Yomicrex Views JJ1980's Profile
```bash
curl -X GET http://localhost:3000/api/users/JJ1980 \
  -H "Authorization: Bearer SESSION_YOMICREX" \
  -H "Cookie: session=SESSION_YOMICREX"
```

**Look for:**
- Status: 200 OK
- username: JJ1980 (not Yomicrex)
- Different user data

✅ **Success Criteria:**
- Status 200
- Loads other user's profile

---

### Yomicrex Views JJ1981's Profile
```bash
curl -X GET http://localhost:3000/api/users/JJ1981 \
  -H "Authorization: Bearer SESSION_YOMICREX" \
  -H "Cookie: session=SESSION_YOMICREX"
```

✅ **Success Criteria:**
- Status 200
- Loads JJ1981's profile

---

### JJ1980 Views Yomicrex's Profile
```bash
curl -X GET http://localhost:3000/api/users/Yomicrex \
  -H "Authorization: Bearer SESSION_JJ1980" \
  -H "Cookie: session=SESSION_JJ1980"
```

✅ **Success Criteria:**
- Status 200
- Loads Yomicrex's profile

---

### JJ1980 Views JJ1981's Profile
```bash
curl -X GET http://localhost:3000/api/users/JJ1981 \
  -H "Authorization: Bearer SESSION_JJ1980" \
  -H "Cookie: session=SESSION_JJ1980"
```

✅ **Success Criteria:**
- Status 200
- Loads JJ1981's profile

---

### JJ1981 Views Yomicrex's Profile
```bash
curl -X GET http://localhost:3000/api/users/Yomicrex \
  -H "Authorization: Bearer SESSION_JJ1981" \
  -H "Cookie: session=SESSION_JJ1981"
```

✅ **Success Criteria:**
- Status 200
- Loads Yomicrex's profile

---

### JJ1981 Views JJ1980's Profile
```bash
curl -X GET http://localhost:3000/api/users/JJ1980 \
  -H "Authorization: Bearer SESSION_JJ1981" \
  -H "Cookie: session=SESSION_JJ1981"
```

✅ **Success Criteria:**
- Status 200
- Loads JJ1980's profile

---

## Step 12: Test Invalid Session

### GET /api/auth/me with Invalid Token
```bash
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer invalid_token_12345"
```

**Look for:**
- Status: 401 Unauthorized
- No user data in response

✅ **Success Criteria:**
- Status 401
- Proper error handling

---

## Step 13: Test Non-Existent User

### GET /api/users/NonExistentUser
```bash
curl -X GET http://localhost:3000/api/users/NonExistentUser
```

**Look for:**
- Status: 404 Not Found
- Error: "User not found"

✅ **Success Criteria:**
- Status 404
- Proper error message

---

## Final Verification Checklist

### ✅ Authentication
- [ ] Account 1 signs in successfully
- [ ] Account 2 signs in successfully
- [ ] Account 3 signs in successfully
- [ ] All sessions created
- [ ] All cookies set with HttpOnly flag

### ✅ Session Management
- [ ] Account 1 session persists (GET /api/auth/me returns correct user)
- [ ] Account 2 session persists
- [ ] Account 3 session persists
- [ ] Sessions are isolated (don't interfere)
- [ ] Invalid session returns 401

### ✅ Profile Access
- [ ] Yomicrex profile loads (own profile)
- [ ] JJ1980 profile loads (own profile)
- [ ] JJ1981 profile loads (own profile)
- [ ] Yomicrex can view JJ1980's profile
- [ ] Yomicrex can view JJ1981's profile
- [ ] JJ1980 can view Yomicrex's profile
- [ ] JJ1980 can view JJ1981's profile
- [ ] JJ1981 can view Yomicrex's profile
- [ ] JJ1981 can view JJ1980's profile

### ✅ Data Consistency
- [ ] Profile data same across endpoints (/api/auth/me vs /api/users/:username)
- [ ] Usernames correct
- [ ] Emails correct
- [ ] All fields present

### ✅ Error Handling
- [ ] Non-existent user returns 404
- [ ] Invalid session returns 401

---

## Expected Results

All tests should pass if:
1. ✅ All three accounts can sign in with email-only method
2. ✅ Sessions are created and persist
3. ✅ Each user can access their own profile
4. ✅ Each user can access other users' profiles
5. ✅ Sessions are properly isolated
6. ✅ Invalid sessions are rejected
7. ✅ All profile data loads correctly

---

## Troubleshooting

### If Status 404 on Sign-In
**Problem:** Email not found
**Check:**
1. Verify email exists in database: `GET /api/admin/users/list`
2. Try different email spelling
3. Check database directly

### If Status 401 on /api/auth/me
**Problem:** Invalid or expired session
**Check:**
1. Verify session token from Set-Cookie header
2. Make sure token passed correctly in Authorization header
3. Check if session expired

### If Profile Returns 404
**Problem:** User or profile not found
**Check:**
1. Verify username exists: `GET /api/auth/check-username/:username`
2. Check spelling (case-sensitive)
3. Verify user completed profile

### If Session Doesn't Persist
**Problem:** Session not being stored/retrieved correctly
**Check:**
1. Verify database session table has records
2. Check if session has expired (7-day max)
3. Review application logs for errors

---

## Log Monitoring

Watch for these log messages during testing:

```
✅ "Email-only sign-in attempt (BETA)"
✅ "Email-only sign-in: session created"
✅ "Session validation attempt"
✅ "Session validation successful"
✅ "Current user profile fetched successfully"
✅ "User profile fetched"

❌ "Email-only sign-in: user not found"
❌ "Email-only sign-in: failed to create session"
❌ "Session validation failed - no active session"
❌ "Failed to fetch current user"
```

---

## Test Results Summary

| Test | Expected | Actual | Status |
|------|----------|--------|--------|
| Account 1 Sign-In | 200 + session | | |
| Account 2 Sign-In | 200 + session | | |
| Account 3 Sign-In | 200 + session | | |
| Account 1 /api/auth/me | 200 + user data | | |
| Account 2 /api/auth/me | 200 + user data | | |
| Account 3 /api/auth/me | 200 + user data | | |
| Yomicrex Profile | 200 + profile | | |
| JJ1980 Profile | 200 + profile | | |
| JJ1981 Profile | 200 + profile | | |
| Cross-User Access (6) | All 200 | | |
| Invalid Session | 401 | | |
| Non-Existent User | 404 | | |

---

## Summary

When all tests pass:
✅ Users can authenticate properly
✅ Sessions persist across requests
✅ Profile pages load correctly
✅ Cross-user interactions work
✅ System is production-ready

If any test fails, check application logs and database for issues.
