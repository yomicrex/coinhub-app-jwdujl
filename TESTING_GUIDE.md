
# 🧪 TestFlight Authentication Testing Guide

## Quick Start

### 1. Access Debug Panel

**Option A: From Settings**
1. Open app in TestFlight
2. Tap **Profile** tab (bottom right)
3. Tap **Settings** (gear icon, top right)
4. Scroll to **Developer Tools** section
5. Tap **Auth Debug Panel**

**Option B: From Login Screen**
1. Open app in TestFlight
2. If logged in, sign out first
3. On login screen, tap **Debug** button (top right)

### 2. Test Backend Deployment

**Verify Backend Version:**
1. In Auth Debug Panel, tap **"Test Version"** button
2. Check the alert message:
   - ✅ Should show: `backendVersion: "2026-01-31-01"` or later
   - ❌ If older version: Backend not deployed yet

**Verify Auth Configuration (NEW!):**
1. In Auth Debug Panel, tap **"Test Auth Config"** button
2. Check the alert message:
   - ✅ `Disable CSRF Check: TRUE`
   - ✅ `Base URL` matches Specular domain
   - ✅ `Trust Proxy: TRUE`
   - ✅ `Trusted Origins` includes CoinHub:// and coinhub://

**Verify Headers:**
1. In Auth Debug Panel, tap **"Test Headers"** button
2. Check the alert message:
   - ✅ `x-app-type: "standalone"` (in TestFlight)
   - ✅ `x-platform: "ios"` (on iOS)
   - ✅ `origin: undefined` (mobile apps don't send Origin)

### 3. Test Authentication (15+ Attempts)

**Test Credentials:**
- Email: `yomicrex@gmail.com`
- Password: (ask backend team for password)

**Test Procedure:**
1. Sign out if logged in
2. Sign in with test credentials
3. Verify successful login
4. Sign out
5. Repeat steps 2-4 at least 15 times
6. Check for "invalid origin" errors

**Expected Results:**
- ✅ All 15+ login attempts succeed
- ✅ No "invalid origin" errors
- ✅ No CSRF errors
- ✅ Session persists after login

### 4. Test Session Persistence

**Test Procedure:**
1. Sign in to the app
2. Close app completely (swipe up from app switcher)
3. Wait 10 seconds
4. Reopen the app
5. Verify you're still logged in

**Expected Results:**
- ✅ User remains logged in
- ✅ No redirect to login screen
- ✅ Profile loads correctly
- ✅ Feed loads correctly

### 5. Test Across App Restarts

**Test Procedure:**
1. Sign in to the app
2. Force quit the app (swipe up from app switcher)
3. Reopen the app
4. Repeat steps 2-3 five times
5. Verify session persists each time

**Expected Results:**
- ✅ Session persists across all restarts
- ✅ No need to sign in again
- ✅ No "invalid origin" errors

## Debug Panel Features

### Real-Time Logging
- All auth requests/responses are logged
- Color-coded by type:
  - 🔵 Blue = Request
  - 🟢 Green = Success Response
  - 🔴 Red = Error
  - 🟡 Yellow = Info

### Environment Info
- Backend URL
- Platform (iOS/Android)
- Build Type (Standalone/Expo Go)
- App Version

### Test Functions
- **Test Version** - Verifies backend deployment (should show 2026-01-31-origin-fix-v3 or later)
- **Test Auth Config** - Verifies backend authentication configuration (NEW!)
  - Checks CSRF is disabled
  - Verifies base URL is correct
  - Confirms proxy trust is enabled
  - Shows trusted origins
- **Test Headers** - Verifies mobile headers are sent correctly
- **Copy Debug Report** - Copies all logs to clipboard
- **Clear Logs** - Clears all logs

## Common Issues

### Issue: "Invalid Origin" Error

**Symptoms:**
- Login fails after a few attempts
- Error message: "invalid origin"
- Happens in TestFlight but not Expo Go

**Solution:**
1. Open Auth Debug Panel
2. Tap "Test Headers"
3. Verify `x-app-type: "standalone"`
4. If missing, backend needs update
5. If present, check backend logs

### Issue: Session Not Persisting

**Symptoms:**
- User logged out after app restart
- Redirected to login screen
- Session lost after closing app

**Solution:**
1. Open Auth Debug Panel
2. Check for 401 errors in logs
3. Verify token is being sent
4. Check "Authorization" header in logs

### Issue: Backend Not Updated

**Symptoms:**
- "Test Version" shows old version
- "Invalid origin" errors persist
- Headers test shows correct headers

**Solution:**
1. Backend needs redeployment
2. Contact backend team
3. Verify deployment URL matches app.json

## Reporting Issues

### Information to Include:

1. **Debug Report:**
   - Open Auth Debug Panel
   - Tap "Copy Debug Report"
   - Paste in issue report

2. **Screenshots:**
   - Error messages
   - Debug panel logs
   - Test results

3. **Environment:**
   - iOS version
   - TestFlight build number
   - Device model

4. **Steps to Reproduce:**
   - Exact steps taken
   - Number of login attempts
   - Any patterns noticed

## Success Criteria

✅ **All tests pass:**
- [ ] Backend version is "2026-01-31-origin-fix-v3" or later
- [ ] Auth Config test shows `disableCSRFCheck: true` (NEW!)
- [ ] Auth Config test shows correct base URL (NEW!)
- [ ] Auth Config test shows `trustProxy: true` (NEW!)
- [ ] Headers test shows `x-app-type: "standalone"`
- [ ] 15+ login attempts succeed without errors
- [ ] Session persists across app restarts
- [ ] No "invalid origin" errors
- [ ] No CSRF errors

## Test Accounts

**Account 1:**
- Email: `yomicrex@gmail.com`
- Username: `Yomicrex`

**Account 2:**
- Email: `yomicrex@mail.com`
- Username: `JJ1980`

**Account 3:**
- Email: `yomicrex@hotmail.com`
- Username: `JJ1981`

**Note:** Ask backend team for passwords.

## Additional Testing

### Test OAuth (if enabled)
1. Tap "Sign in with Google" (if available)
2. Complete OAuth flow
3. Verify successful login
4. Check Auth Debug Panel for logs

### Test Profile Completion
1. Sign up with new email
2. Complete profile with username
3. Verify redirect to home screen
4. Check Auth Debug Panel for logs

### Test Password Reset
1. Tap "Forgot Password?" (if available)
2. Enter email address
3. Check email for reset link
4. Complete password reset
5. Sign in with new password

---

**Last Updated:** 2026-01-31

**Required Backend Version:** 2026-01-31-origin-fix-v3 or later

## What's New in This Update

### Backend Changes (2026-01-31-origin-fix-v3)

1. **CSRF Protection Disabled for Mobile Apps**
   - Mobile apps (TestFlight, standalone) no longer blocked by CSRF checks
   - Backend identifies mobile apps via `X-App-Type` header
   - Fixes "Invalid origin" errors in TestFlight

2. **Explicit Base URL Configuration**
   - Backend now knows its public URL
   - Properly handles requests from reverse proxy
   - Ensures correct origin validation

3. **Trusted Origins Added**
   - App schemes (CoinHub://, coinhub://) are trusted
   - Specular domain is trusted
   - Enables proper OAuth and deep linking

4. **Proxy Trust Enabled**
   - Backend trusts X-Forwarded-* headers
   - Correctly interprets host and protocol behind proxy
   - Fixes host mismatch issues

5. **Enhanced Debug Endpoints**
   - New `/api/debug/auth-config` endpoint
   - Enhanced `/api/debug/headers` with more fields
   - Updated `/api/debug/version` with new version string

### Frontend Changes

1. **New Auth Config Test**
   - Added "Test Auth Config" button to debug panel
   - Verifies backend configuration is correct
   - Shows CSRF status, base URL, proxy trust, and trusted origins

2. **Enhanced Debug Panel**
   - Better error messages
   - More detailed test results
   - Color-coded buttons for different tests

3. **Updated Testing Guide**
   - Added auth config test instructions
   - Updated success criteria
   - Documented new backend features
