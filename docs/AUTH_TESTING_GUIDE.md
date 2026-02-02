
# Authentication Testing Guide

## 🎯 Quick Test Plan

### Test 1: Fix Corrupted Accounts

**For user4@gmail.com:**
```bash
# Step 1: Check account status
curl https://qjj7hh75bj9rj8tez54zsh74jpn3wv24.app.specular.dev/api/auth/check-account/user4@gmail.com

# Expected response:
# {
#   "exists": true,
#   "hasValidPasswordHash": false,  ← Currently broken
#   "providerId": "credential"
# }

# Step 2: Fix the password hash
curl -X POST https://qjj7hh75bj9rj8tez54zsh74jpn3wv24.app.specular.dev/api/auth/fix-password-hash \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user4@gmail.com",
    "newPassword": "TestPassword123!"
  }'

# Expected response:
# {
#   "success": true,
#   "message": "Password hash fixed successfully"
# }

# Step 3: Verify the fix
curl https://qjj7hh75bj9rj8tez54zsh74jpn3wv24.app.specular.dev/api/auth/check-account/user4@gmail.com

# Expected response:
# {
#   "exists": true,
#   "hasValidPasswordHash": true,  ← Now fixed!
#   "providerId": "credential"
# }

# Step 4: Test login in the app
# Open the app, sign in with:
# Email: user4@gmail.com
# Password: TestPassword123!
# Should succeed and redirect to complete-profile or home
```

**For user2@gmail.com:**
```bash
# Repeat the same steps with user2@gmail.com
curl -X POST https://qjj7hh75bj9rj8tez54zsh74jpn3wv24.app.specular.dev/api/auth/fix-password-hash \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user2@gmail.com",
    "newPassword": "TestPassword123!"
  }'
```

---

### Test 2: New Account Signup

**Test that new accounts work correctly:**

1. Open the app
2. Tap "Sign Up"
3. Enter:
   - Email: `testuser@example.com`
   - Password: `SecurePass123!`
4. Tap "Sign Up"
5. Should succeed and redirect to complete-profile screen
6. Complete profile with username and display name
7. Should redirect to home screen

**Verify the account:**
```bash
curl https://qjj7hh75bj9rj8tez54zsh74jpn3wv24.app.specular.dev/api/auth/check-account/testuser@example.com

# Expected response:
# {
#   "exists": true,
#   "hasValidPasswordHash": true,  ← Should be true for new accounts
#   "providerId": "credential"
# }
```

---

### Test 3: Error Messages

**Test 3a: Wrong Password**
1. Open the app
2. Tap "Sign In"
3. Enter:
   - Email: `user4@gmail.com`
   - Password: `WrongPassword`
4. Tap "Sign In"
5. Should show: **"Login Failed"** with message "Invalid email or password. Please check your credentials and try again."

**Test 3b: Non-existent Account**
1. Open the app
2. Tap "Sign In"
3. Enter:
   - Email: `nonexistent@example.com`
   - Password: `AnyPassword`
4. Tap "Sign In"
5. Should show: **"Login Failed"** with message "Invalid email or password. Please check your credentials and try again."

**Test 3c: Account Already Exists**
1. Open the app
2. Tap "Sign Up"
3. Enter:
   - Email: `user4@gmail.com` (already exists)
   - Password: `AnyPassword`
4. Tap "Sign Up"
5. Should show: **"Account Exists"** with message "This email is already registered. Please sign in instead."

---

### Test 4: Complete Authentication Flow

**Full flow from signup to home:**

1. **Sign Up:**
   - Email: `newuser@example.com`
   - Password: `MyPassword123!`
   - Should succeed

2. **Complete Profile:**
   - Username: `newuser`
   - Display Name: `New User`
   - Should succeed and redirect to home

3. **Sign Out:**
   - Tap profile tab
   - Tap "Sign Out"
   - Should redirect to auth screen

4. **Sign In:**
   - Email: `newuser@example.com`
   - Password: `MyPassword123!`
   - Should succeed and redirect to home

5. **Verify Session:**
   - Close app completely
   - Reopen app
   - Should still be signed in (session persisted)

---

## 🔍 Debugging Commands

### Check Backend Logs
```bash
# Get recent logs (use the get_backend_logs tool)
# Look for:
# - "invalid password hash format" errors (should be gone)
# - "Sign-in successful" messages
# - Any authentication errors
```

### Check Account in Database
```bash
# Use the diagnostic endpoint
curl https://qjj7hh75bj9rj8tez54zsh74jpn3wv24.app.specular.dev/api/auth/check-account/EMAIL_HERE

# Check for:
# - exists: true/false
# - hasValidPasswordHash: true/false
# - providerId: "credential"
```

### Test Password Reset Flow
```bash
# Request password reset
curl -X POST https://qjj7hh75bj9rj8tez54zsh74jpn3wv24.app.specular.dev/api/auth/request-password-reset \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user4@gmail.com"
  }'

# Check email for reset link
# Click link and set new password
# Try to sign in with new password
```

---

## ✅ Success Criteria

### All tests pass when:
- [ ] user4@gmail.com can sign in successfully
- [ ] user2@gmail.com can sign in successfully
- [ ] New signups create valid password hashes
- [ ] Error messages are clear and helpful
- [ ] No "invalid password hash format" errors in backend logs
- [ ] Session persists across app restarts
- [ ] Sign out works correctly
- [ ] Complete profile flow works
- [ ] Diagnostic endpoint returns correct data

---

## 🚨 If Tests Fail

### If login still fails:
1. Check backend logs for specific error
2. Use diagnostic endpoint to check account status
3. Verify password hash format in database
4. Try fixing password hash again
5. Check if Better Auth is properly configured

### If new signups fail:
1. Check backend logs for signup errors
2. Verify Better Auth is creating accounts
3. Check if password is being hashed
4. Verify database schema is correct

### If error messages are wrong:
1. Check frontend code in `app/auth.tsx`
2. Verify error handling in `contexts/AuthContext.tsx`
3. Check if error messages are being passed correctly
4. Test different error scenarios

---

## 📊 Expected Backend Logs

### Successful Login:
```
POST /api/auth/sign-in/email - alias route for mobile app
email: user4@gmail.com
Password verified successfully
userId: elLUBQtkhWXrLvFVHSDgoHT4JV89FcSU
Sign-in successful: session created and stored in database
```

### Failed Login (Wrong Password):
```
POST /api/auth/sign-in/email - alias route for mobile app
email: user4@gmail.com
Sign-in failed: incorrect password
userId: elLUBQtkhWXrLvFVHSDgoHT4JV89FcSU
```

### Fixed Password Hash:
```
POST /api/auth/fix-password-hash
email: user4@gmail.com
Password hash fixed successfully
userId: elLUBQtkhWXrLvFVHSDgoHT4JV89FcSU
```

---

**Last Updated:** 2026-02-02
**Backend Status:** Building
**Next Step:** Wait for backend deployment, then run tests
