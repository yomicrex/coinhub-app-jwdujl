
# Build 10: Auth Debug Mode & TestFlight Login Fix

## Problem
Login works in Expo Go but fails in TestFlight (standalone iOS) with "invalid origin" error after a few attempts.

## Root Cause
Native mobile apps (iOS/Android/TestFlight) **do not send Origin headers** in HTTP requests. This is normal and expected behavior. However, the backend's CORS and CSRF protection was rejecting these requests because it expected an Origin header.

## Solution Overview

### 1. Frontend: Auth Debug Mode (Requirement #1)
Created a comprehensive debug panel to diagnose authentication issues in TestFlight builds.

**New Component: `components/AuthDebugPanel.tsx`**
- Displays environment info (backend URL, platform, build type)
- Logs all authentication requests and responses
- Shows request headers, status codes, and response bodies (first 300 chars)
- "Copy Debug Report" button to copy all logs to clipboard
- Visible only in dev mode or TestFlight builds (`ENV.IS_DEV || ENV.IS_STANDALONE`)

**Integration:**
- Added debug button to `app/auth.tsx` (login screen)
- Added debug button to `app/settings.tsx` (settings screen)
- Integrated logging into `utils/api.ts`, `lib/auth.ts`, and `contexts/AuthContext.tsx`

**Debug Logging:**
- Every login attempt: URL, method, status, headers (Origin, Authorization, X-Platform)
- Every auth failure: endpoint, status code, error message, response body
- Token extraction: success/failure with token length
- Session validation: success/failure with user info

### 2. Frontend: Token-Based Auth Only (Requirement #2)
Ensured the mobile app uses **only** Bearer token authentication, not cookies.

**Changes:**
- ✅ `credentials: 'omit'` in all fetch requests (already implemented)
- ✅ `Authorization: Bearer <token>` header on all authenticated requests (already implemented)
- ✅ No `withCredentials: true` anywhere in the codebase (already correct)
- ✅ Tokens stored in SecureStore (native) or localStorage (web) (already implemented)

**Verification:**
- `lib/auth.ts`: Uses `credentials: "omit"` in Better Auth client
- `utils/api.ts`: Uses `credentials: 'omit'` in all fetch calls
- `contexts/AuthContext.tsx`: Uses `credentials: 'omit'` in `/api/auth/me` calls

### 3. Backend: Mobile App Compatibility (Requirement #3)
Updated backend to accept requests **without** Origin headers from mobile apps.

**Backend Changes (via `make_backend_change`):**

1. **Better Auth Configuration:**
   - Accept requests without origin headers: `trustedOrigins: [(origin) => !origin || origin === 'null']`
   - Disable CSRF for mobile apps: `disableCSRFCheck: true` for requests without origin
   - Prioritize Authorization header over cookies

2. **CORS Middleware:**
   - Requests WITHOUT origin (mobile): `Access-Control-Allow-Origin: *`
   - Requests WITH origin (web): Validate against trusted origins
   - Always allow `Authorization` header

3. **CSRF Protection:**
   - ONLY enforce CSRF for browser requests (with origin/referer headers)
   - SKIP CSRF for mobile requests (no origin/referer headers)
   - Mobile apps use Bearer tokens, not cookies, so CSRF is not applicable

4. **Session Token Extraction:**
   - Priority: Authorization header → Cookie header
   - Mobile apps use Authorization header only
   - Web browsers can use either

5. **Logging:**
   - Log all auth requests with origin (or "none"), user-agent, method, path
   - Log when CSRF is bypassed for mobile apps
   - Log when requests are accepted without origin headers

## Testing Instructions (Requirement #4)

### In TestFlight:
1. Install the new build from TestFlight
2. Open the app and tap the "Debug" button (top-right on login screen)
3. Review the environment info:
   - Backend URL should be correct
   - Build Type should show "Standalone (TestFlight/App Store)"
   - Platform should show "ios"

4. Close the debug panel and attempt to sign in
5. If login fails, open the debug panel again
6. Review the logs:
   - Check if requests are reaching the backend (status codes)
   - Check if "invalid origin" error appears in response bodies
   - Check request headers (Authorization should be present, Origin should be "none" or missing)

7. Use "Copy Debug Report" button to copy logs
8. Send the debug report to the development team for analysis

9. Perform 10+ login attempts across multiple app restarts
10. All attempts should succeed without "invalid origin" errors

### Expected Behavior:
- ✅ Login works consistently in TestFlight
- ✅ No "invalid origin" errors
- ✅ Debug panel shows successful authentication requests
- ✅ Authorization header is present in all requests
- ✅ Origin header is missing (this is correct for mobile apps)

## Key Technical Details

### Why Mobile Apps Don't Send Origin Headers
Native mobile apps (iOS/Android) make HTTP requests directly from the app, not from a web browser. The `Origin` header is a **browser security feature** that identifies which website is making a request. Since mobile apps are not websites, they don't have an origin and don't send this header.

### Why CSRF Protection Doesn't Apply to Mobile Apps
CSRF (Cross-Site Request Forgery) protection is designed to prevent malicious websites from making unauthorized requests on behalf of a user. This attack vector **only applies to web browsers** that automatically send cookies with requests. Mobile apps:
- Don't use cookies for authentication (they use Bearer tokens)
- Don't automatically send credentials with requests
- Are not vulnerable to CSRF attacks

Therefore, CSRF checks should be **skipped** for mobile app requests.

### Token-Based Auth vs Cookie-Based Auth
- **Cookie-Based Auth (Web):** Browser automatically sends cookies with every request. Requires CSRF protection.
- **Token-Based Auth (Mobile):** App explicitly includes `Authorization: Bearer <token>` header. No CSRF protection needed.

Our app uses **token-based auth** for mobile and **can use either** for web (Better Auth supports both).

## Files Changed

### Frontend:
- ✅ `components/AuthDebugPanel.tsx` (new)
- ✅ `utils/api.ts` (added debug logging)
- ✅ `lib/auth.ts` (added debug logging)
- ✅ `contexts/AuthContext.tsx` (added debug logging)
- ✅ `app/auth.tsx` (added debug button)
- ✅ `app/settings.tsx` (added debug button)

### Backend:
- ✅ Better Auth configuration (accept requests without origin)
- ✅ CORS middleware (allow mobile requests)
- ✅ CSRF bypass (skip for mobile requests)
- ✅ Session token extraction (prioritize Authorization header)
- ✅ Logging (track mobile vs web requests)

## Next Steps

1. **Build and Deploy:**
   - Build a new version with these changes
   - Upload to TestFlight
   - Increment build number

2. **Test in TestFlight:**
   - Install the new build
   - Open debug panel and verify environment
   - Perform 10+ login attempts
   - Verify no "invalid origin" errors
   - Copy and review debug report

3. **Monitor:**
   - Check backend logs for mobile app requests
   - Verify CSRF bypass is working
   - Verify Authorization header is being used

4. **Production:**
   - Once verified in TestFlight, deploy to App Store
   - Debug panel will remain visible in TestFlight but hidden in production (unless `ENV.IS_DEV` is true)

## Troubleshooting

### If login still fails in TestFlight:

1. **Open Debug Panel:**
   - Tap "Debug" button on login screen
   - Review environment info
   - Check backend URL is correct

2. **Check Logs:**
   - Look for "invalid origin" in error messages
   - Check if requests are reaching backend (status codes)
   - Verify Authorization header is present

3. **Copy Debug Report:**
   - Tap "Copy Debug Report"
   - Paste into a text file or email
   - Send to development team

4. **Check Backend Logs:**
   - Use `get_backend_logs` to check server-side logs
   - Look for CORS errors or CSRF rejections
   - Verify mobile requests are being accepted

### Common Issues:

- **Wrong Backend URL:** Check `app.json` → `extra.backendUrl`
- **Missing Authorization Header:** Check token extraction in `utils/api.ts`
- **CSRF Still Enforced:** Check backend CSRF bypass middleware
- **CORS Rejection:** Check backend CORS middleware for mobile apps

## Summary

This fix addresses the "invalid origin" issue by:
1. Adding comprehensive debug logging to diagnose the issue
2. Ensuring the frontend uses token-based auth only (no cookies)
3. Updating the backend to accept mobile requests without origin headers
4. Providing tools to verify the fix in TestFlight

The debug panel will help identify any remaining issues and provide detailed logs for troubleshooting.
