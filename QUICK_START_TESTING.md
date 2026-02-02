
# Quick Start Testing Guide 🚀

**For:** Immediate testing of password hash fix integration  
**Time Required:** 5-10 minutes

---

## 🎯 Goal

Verify that the password hash fix integration is working correctly by:
1. Testing admin diagnostic tools
2. Fixing a known broken account (user4@gmail.com)
3. Verifying improved error messages

---

## 📋 Prerequisites

- ✅ App running in development mode
- ✅ Backend deployed at: https://qjj7hh75bj9rj8tez54zsh74jpn3wv24.app.specular.dev
- ✅ Access to AuthDebugPanel (development builds only)

---

## 🧪 Test Sequence

### Test 1: Verify Admin Tools Are Visible (30 seconds)

**Steps:**
1. Open app in development mode
2. Navigate to a screen with AuthDebugPanel access
3. Look for "🔧 Admin Tools (Password Hash Fix)" section

**Expected Result:**
- ✅ Admin tools section is visible
- ✅ Three buttons present: "Check Account", "Fix Password", "Create Test User"

**If Not Visible:**
- Verify `__DEV__ === true` (check console logs)
- Verify you're not in production build

---

### Test 2: Check Account Status (1 minute)

**Steps:**
1. Tap "Check Account" button
2. Enter email: `user4@gmail.com`
3. Tap "Check"

**Expected Result:**
```
✅ Account Check Result:

Email: user4@gmail.com

Exists: ✅ Yes
Has Valid Password Hash: ❌ No
Provider ID: credential

⚠️ Password hash is INVALID! Use "Fix Password" to repair this account.
```

**If Different:**
- If "Exists: ❌ No" → Account doesn't exist, try different email
- If "Has Valid Password Hash: ✅ Yes" → Account already fixed or never broken

---

### Test 3: Create Test User (1 minute)

**Steps:**
1. Tap "Create Test User" button
2. Tap "Create User"
3. **IMPORTANT:** Copy the generated credentials immediately

**Expected Result:**
```
✅ Test User Created!

Email: testuser_1738512345@test.com
Password: TestPassword123!
User ID: abc123def456...

You can now sign in with these credentials.
```

**Save These Credentials:**
```
Email: ___________________________
Password: _________________________
```

---

### Test 4: Test Sign In with Test User (2 minutes)

**Steps:**
1. Sign out of current account (if signed in)
2. Go to auth screen
3. Enter test user credentials from Test 3
4. Tap "Sign In"

**Expected Result:**
- ✅ Sign in successful
- ✅ Redirected to complete profile screen (new user)
- ✅ No errors

**If Fails:**
- Check credentials are correct
- Check backend logs
- Verify test user was created successfully

---

### Test 5: Fix Broken Account (2 minutes)

**Steps:**
1. Open AuthDebugPanel
2. Tap "Fix Password" button
3. Enter email: `user4@gmail.com`
4. Enter new password: `FixedPassword123!`
5. Tap "Fix Password"

**Expected Result:**
```
✅ Password Fixed Successfully!

Email: user4@gmail.com

Password has been reset and properly hashed.

You can now sign in with the new password.
```

**Save These Credentials:**
```
Email: user4@gmail.com
Password: FixedPassword123!
```

---

### Test 6: Verify Fixed Account Works (2 minutes)

**Steps:**
1. Sign out of current account
2. Go to auth screen
3. Enter: `user4@gmail.com` / `FixedPassword123!`
4. Tap "Sign In"

**Expected Result:**
- ✅ Sign in successful
- ✅ No "invalid password hash format" error
- ✅ User profile loads correctly

**If Fails:**
- Verify password was fixed in Test 5
- Check account status again using "Check Account"
- Check backend logs for errors

---

### Test 7: Verify Error Message Display (1 minute)

**Steps:**
1. Find another account with corrupted password hash (or use user2@gmail.com)
2. Try to sign in with that account
3. Observe the error message

**Expected Result:**
- ✅ Custom modal appears (not Alert.alert)
- ✅ Error title: "🔧 Account Issue Detected"
- ✅ Error message mentions password hash issue
- ✅ Error message provides support contact: support@coinhub.app
- ✅ "OK" button to dismiss

**If Different:**
- If Alert.alert appears → Integration not complete
- If generic error → Error detection not working

---

## ✅ Success Criteria

All tests should pass:
- [x] Admin tools visible in development
- [x] Check account tool works
- [x] Create test user works
- [x] Test user can sign in
- [x] Fix password tool works
- [x] Fixed account can sign in
- [x] Error messages are user-friendly

---

## 🐛 Common Issues & Solutions

### Issue: Admin tools not visible
**Solution:** 
- Verify `__DEV__ === true`
- Check console: `console.log('DEV MODE:', __DEV__)`
- Rebuild app if necessary

### Issue: "Endpoint not found" error
**Solution:**
- Verify backend URL: https://qjj7hh75bj9rj8tez54zsh74jpn3wv24.app.specular.dev
- Test endpoint directly: `curl https://qjj7hh75bj9rj8tez54zsh74jpn3wv24.app.specular.dev/api/admin/check-account/test@test.com`
- Check backend deployment status

### Issue: Fix password fails
**Solution:**
- Verify account exists first using "Check Account"
- Check email is correct (case-insensitive)
- Check backend logs for detailed error

### Issue: Test user creation fails
**Solution:**
- Check backend logs
- Verify database connection
- Try again (might be temporary issue)

---

## 📊 Test Results Template

```
Date: _______________
Tester: _______________

Test 1 - Admin Tools Visible: ☐ PASS ☐ FAIL
Test 2 - Check Account: ☐ PASS ☐ FAIL
Test 3 - Create Test User: ☐ PASS ☐ FAIL
Test 4 - Test User Sign In: ☐ PASS ☐ FAIL
Test 5 - Fix Password: ☐ PASS ☐ FAIL
Test 6 - Fixed Account Sign In: ☐ PASS ☐ FAIL
Test 7 - Error Message Display: ☐ PASS ☐ FAIL

Overall Status: ☐ ALL PASS ☐ SOME FAIL

Notes:
_________________________________
_________________________________
_________________________________
```

---

## 🎯 Next Steps After Testing

### If All Tests Pass ✅
1. Document test results
2. Fix remaining broken accounts (user2@gmail.com, etc.)
3. Proceed with TestFlight build
4. Monitor for user reports

### If Some Tests Fail ❌
1. Document which tests failed
2. Check console logs for errors
3. Review integration code
4. Contact backend team if endpoint issues
5. Re-test after fixes

---

## 📞 Support

**For Testing Issues:**
- Check console logs first
- Review error messages
- Check backend logs
- Contact development team

**For User Account Issues:**
- Use admin tools to diagnose
- Use "Fix Password" to repair
- Document all fixes

---

**Testing Time:** ~10 minutes  
**Difficulty:** Easy  
**Prerequisites:** Development build, backend deployed  
**Status:** ✅ Ready to test
