
# TestFlight Authentication Testing Guide

## Quick Test (2 minutes)

### Step 1: Open Auth Debug Panel
1. Open CoinHub in TestFlight
2. Tap **Profile** tab (bottom right)
3. Tap **Settings** (gear icon, top right)
4. Scroll to **Developer Tools** section
5. Tap **Auth Debug Panel**

### Step 2: Test Headers Endpoint
1. In the Auth Debug Panel, tap **Test Headers** button
2. An alert will show the response:
   ```
   Headers Test Result:
   
   Origin: undefined
   Referer: undefined
   X-App-Type: standalone
   Has Authorization: No
   
   Status: 200
   ```
3. ✅ **Expected**: `X-App-Type: standalone` and `Status: 200`
4. ❌ **If you see an error**: Backend hasn't deployed yet, wait 1-2 minutes and try again

### Step 3: Test Login
1. If not logged in, go back and tap **Sign In**
2. Enter your credentials and tap **Sign In**
3. ✅ **Expected**: Login succeeds, you see your profile
4. ❌ **If you see "invalid origin"**: Check the Auth Debug Panel logs (see below)

### Step 4: Test Repeated Logins
1. Go to Settings → tap **Sign Out**
2. Sign in again
3. Repeat 3-5 times
4. ✅ **Expected**: Every login succeeds
5. ❌ **If any login fails**: Check the Auth Debug Panel logs

## Detailed Testing (10 minutes)

### Test 1: Verify Headers Are Being Sent

**Purpose**: Confirm the app is sending the correct headers to identify itself as a mobile app.

1. Open Auth Debug Panel (Settings → Developer Tools → Auth Debug Panel)
2. Tap **Test Headers**
3. Check the response:
   - `X-App-Type` should be `"standalone"` (for TestFlight)
   - `Origin` should be `undefined` or not present (this is normal for mobile apps)
   - `Status` should be `200`

**What This Tells Us**:
- ✅ The app is correctly identifying itself as a standalone mobile app
- ✅ The backend is receiving the headers
- ✅ The backend has deployed with the new debug endpoint

### Test 2: Verify Login Works

**Purpose**: Confirm that login succeeds without "invalid origin" errors.

1. If logged in, sign out first (Settings → Sign Out)
2. Go to the Sign In screen
3. Enter valid credentials
4. Tap **Sign In**
5. Open Auth Debug Panel (Settings → Developer Tools → Auth Debug Panel)
6. Check the logs for the `/api/auth/sign-in` request:
   - Should show `Type: RESPONSE` with `Status: 200`
   - Should NOT show any errors about "invalid origin"

**What This Tells Us**:
- ✅ The backend is accepting login requests from mobile apps
- ✅ CSRF checks are being bypassed for mobile apps
- ✅ Authentication is working correctly

### Test 3: Verify Repeated Logins

**Purpose**: Confirm that the fix is consistent and doesn't fail intermittently.

1. Sign out
2. Sign in
3. Repeat 5 times
4. Check Auth Debug Panel logs after each attempt

**What This Tells Us**:
- ✅ The fix is stable and consistent
- ✅ No race conditions or intermittent failures
- ✅ Session management is working correctly

### Test 4: Verify Other Authenticated Requests

**Purpose**: Confirm that other API requests also work correctly.

1. After logging in, go to the Profile tab
2. Tap **Add Coin** (or any other action that requires authentication)
3. Check Auth Debug Panel logs
4. Look for requests to `/api/coins` or other endpoints
5. Verify they all succeed (Status: 200)

**What This Tells Us**:
- ✅ All authenticated requests are working
- ✅ Bearer token authentication is functioning
- ✅ The app is fully functional

## Understanding the Auth Debug Panel

### Log Types

- **🔵 REQUEST** (Blue): Outgoing request from the app
  - Shows: Method, Endpoint, Headers being sent
  
- **🟢 RESPONSE** (Green): Successful response from backend
  - Shows: Status code, Response body
  
- **🔴 ERROR** (Red): Failed request or error
  - Shows: Error message, Status code (if available)
  
- **🟡 INFO** (Yellow): Informational log
  - Shows: General information about auth state

### Key Things to Look For

#### ✅ Good Signs:
- Requests show `X-App-Type: standalone` in headers
- Responses show `Status: 200` or `Status: 201`
- No errors about "invalid origin"
- Login requests succeed consistently

#### ❌ Bad Signs:
- Errors mentioning "invalid origin"
- Status codes like `401` (Unauthorized) or `403` (Forbidden)
- Missing `X-App-Type` header in requests
- Intermittent failures

### Example Good Log Sequence (Login):

```
1. [INFO] Sign in attempt for email: user@example.com
2. [REQUEST] POST /api/auth/sign-in
   Headers: { X-App-Type: standalone, X-Platform: ios }
3. [RESPONSE] Status: 200
   Message: Sign in successful
4. [REQUEST] GET /api/auth/me
   Headers: { Authorization: Bearer ..., X-App-Type: standalone }
5. [RESPONSE] Status: 200
   Body: { id: "...", email: "user@example.com", ... }
```

### Example Bad Log Sequence (Before Fix):

```
1. [INFO] Sign in attempt for email: user@example.com
2. [REQUEST] POST /api/auth/sign-in
   Headers: { X-App-Type: standalone, X-Platform: ios }
3. [ERROR] Status: 400
   Error: Invalid origin
```

## Troubleshooting

### Problem: "Test Headers" button shows an error

**Possible Causes**:
1. Backend hasn't finished deploying
2. Network connection issue
3. Backend URL is incorrect

**Solutions**:
1. Wait 1-2 minutes and try again
2. Check your internet connection
3. Check Settings → Environment section for correct backend URL

### Problem: Login shows "invalid origin" error

**Possible Causes**:
1. Backend hasn't deployed with the fix yet
2. App is not sending X-App-Type header
3. Backend CSRF bypass logic isn't working

**Solutions**:
1. Check "Test Headers" endpoint first - if it works, backend is deployed
2. Check Auth Debug Panel logs - verify X-App-Type header is being sent
3. Copy debug report (tap "Copy Debug Report" button) and send to support

### Problem: Login works sometimes but fails other times

**Possible Causes**:
1. Race condition in session storage
2. Network timing issue
3. Backend load balancer issue

**Solutions**:
1. Check Auth Debug Panel logs for patterns
2. Try logging in 10 times and note which attempts fail
3. Copy debug report and send to support

### Problem: Can't find Auth Debug Panel

**Note**: The Auth Debug Panel is only visible in:
- Development builds (Expo Go)
- TestFlight builds
- NOT visible in production App Store builds

**Solution**:
Make sure you're using a TestFlight build, not a production build.

## Reporting Issues

If you encounter any issues, please provide:

1. **Debug Report**: 
   - Open Auth Debug Panel
   - Tap "Copy Debug Report"
   - Paste into your bug report

2. **Steps to Reproduce**:
   - What you were doing when the error occurred
   - How many times you tried
   - Whether it's consistent or intermittent

3. **Environment Info**:
   - iOS version
   - TestFlight build number (visible in Settings)
   - Whether you're on WiFi or cellular

4. **Screenshots**:
   - Screenshot of the error message
   - Screenshot of Auth Debug Panel logs

## Expected Timeline

After the backend deploys:
- ⏱️ **0-2 minutes**: Backend deployment completes
- ⏱️ **2-3 minutes**: DNS/CDN propagation
- ⏱️ **3-5 minutes**: All users can access the fix

If the fix isn't working after 5 minutes, there may be an issue that needs investigation.

## Success Criteria

The fix is working correctly when:
- ✅ "Test Headers" endpoint returns `X-App-Type: standalone` and `Status: 200`
- ✅ Login succeeds every time (10/10 attempts)
- ✅ No "invalid origin" errors in Auth Debug Panel logs
- ✅ All authenticated requests work (profile, coins, trades, etc.)
- ✅ Sign out and sign in works repeatedly without issues

## Additional Notes

### Why This Was Happening

Mobile apps (iOS/Android) don't send the `Origin` header that web browsers send. This is by design - mobile apps aren't "origins" in the same way websites are. Better Auth's CSRF protection was rejecting these requests because it expected an `Origin` header.

### How We Fixed It

We added a custom header (`X-App-Type`) that explicitly identifies the app as a mobile app. The backend now recognizes this header and bypasses CSRF checks for mobile apps, while still maintaining CSRF protection for web browsers.

### Is This Secure?

Yes! Mobile apps use Bearer token authentication (Authorization header), which is more secure than cookie-based authentication for mobile contexts. Web browsers still have full CSRF protection. We're just using the right security model for each platform.

## Contact

If you need help or have questions:
- Email: support@coinhub.app
- Include your debug report (from Auth Debug Panel)
- Include your TestFlight build number
