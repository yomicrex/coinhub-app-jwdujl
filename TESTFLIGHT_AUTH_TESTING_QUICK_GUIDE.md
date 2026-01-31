
# TestFlight Authentication Testing - Quick Guide

## 🎯 What Was Fixed

The backend was updated to fix the `INVALID_ORIGIN` error that prevented sign-in in TestFlight builds.

**Backend Version:** `2026-01-31-mobile-auth-fix-v1`

---

## 🧪 How to Test (5 Minutes)

### Step 1: Open Debug Panel
1. Launch the app in TestFlight
2. On the sign-in screen, tap the **"Debug"** button (top-right corner)

### Step 2: Run Tests
Run these tests in order:

#### Test 1: Backend Version ✅
- Tap **"Test Version"**
- Expected: `✅ Backend is UPDATED with EXACT version!`
- Version should be: `2026-01-31-mobile-auth-fix-v1`

#### Test 2: Sign-In Headers ⭐ NEW
- Tap **"Test Sign-In Headers"**
- Expected: `✅ Mobile auth header normalization is WORKING!`
- Should show:
  - Origin: `https://qjj7hh75bj9rj8tez54zsh74jpn3wv24.app.specular.dev`
  - Referer: `https://qjj7hh75bj9rj8tez54zsh74jpn3wv24.app.specular.dev`
  - X-App-Type: `standalone`

#### Test 3: Auth Config ✅
- Tap **"Test Auth Config"**
- Expected: `✅ Backend configuration is CORRECT!`
- Should show:
  - Disable CSRF Check: `TRUE`
  - Trust Proxy: `TRUE`

### Step 3: Test Sign-In
1. Close the debug panel
2. Enter credentials:
   - **Email:** `test@example.com`
   - **Password:** `password123`
3. Tap **"Sign In"**
4. Expected: ✅ **Sign-in succeeds** (no INVALID_ORIGIN error)

---

## ✅ Success Criteria

All of these should be true:

- [x] Backend version is `2026-01-31-mobile-auth-fix-v1`
- [x] Sign-In Headers test shows normalized Origin/Referer
- [x] Auth Config test shows correct configuration
- [x] Sign-in succeeds without errors
- [x] User is redirected to home screen after sign-in

---

## 🐛 If Something Fails

### Backend Not Updated
**Symptom:** Version test shows wrong version  
**Solution:** Wait for backend deployment to complete

### Sign-In Headers Not Normalized
**Symptom:** Origin/Referer are undefined or wrong  
**Solution:** Backend fix may not be deployed yet

### Sign-In Still Fails
**Symptom:** INVALID_ORIGIN error still appears  
**Action:**
1. Tap "Copy Debug Report" in debug panel
2. Share the report with developers
3. Include the error message you see

---

## 📱 Debug Panel Features

The debug panel has 6 test buttons:

1. **Test Version** - Check backend deployment
2. **Test Auth Config** - Verify Better Auth settings
3. **Test Headers** - See all request headers
4. **Test Auth URL** - Check URL construction
5. **Test Sign-In Headers** ⭐ **NEW** - Test mobile auth fix
6. **Copy Debug Report** - Export logs for debugging

---

## 🎉 Expected Result

After the backend fix:

✅ **Sign-in works in TestFlight**  
✅ **No INVALID_ORIGIN errors**  
✅ **Mobile headers are correctly normalized**  
✅ **Authentication is seamless**

---

## 📞 Need Help?

If you encounter issues:

1. **Copy Debug Report:**
   - Open debug panel
   - Tap "Copy Debug Report"
   - Paste into a message

2. **Include:**
   - What test failed
   - Error message (if any)
   - Screenshot of debug panel

3. **Share with developers**

---

**Last Updated:** January 31, 2026  
**Status:** ✅ Ready for Testing
