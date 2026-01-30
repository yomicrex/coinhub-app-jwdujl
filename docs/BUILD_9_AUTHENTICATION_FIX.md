
# Build 9: Authentication Fix for TestFlight - Token-Based Auth

## Problem Summary
The app's email/password login worked correctly in Expo Go, but in TestFlight (standalone iOS) builds it would fail after a few login attempts with an "invalid origin" error. This prevented all users from logging in reliably.

## Root Cause
Better Auth was enforcing CSRF protection and origin validation for native mobile apps. Native iOS apps (TestFlight/App Store builds) don't send `Origin` headers like web browsers do, causing Better Auth to reject authentication requests with 403 Forbidden errors.

## Solution Implemented

### Backend Changes (via make_backend_change)
1. **Better Auth Configuration:**
   - Disabled CSRF checks for mobile apps by setting `advanced.disableCSRFCheck: true`
   - Configured `trustedOrigins` to accept requests without origin headers
   - Added a function to `trustedOrigins` that returns `true` for requests with no origin or null origin

2. **Expected Backend Configuration:**
```typescript
app.withAuth({
  advanced: {
    // CRITICAL: Disable CSRF for mobile apps
    disableCSRFCheck: true,
  },
  trustedOrigins: [
    'http://localhost:*',
    'http://127.0.0.1:*',
    'https://qjj7hh75bj9rj8tez54zsh74jpn3wv24.app.specular.dev',
    // CRITICAL: Accept requests without origin header (native mobile apps)
    (origin) => !origin || origin === 'null',
  ],
});
```

### Frontend Changes

#### 1. lib/auth.ts
- Changed `credentials` from conditional (`web ? "include" : "omit"`) to always `"omit"`
- Added platform identification headers (`X-Platform`, `X-App-Type`)
- Removed dependency on cookies for mobile authentication

#### 2. utils/api.ts
- Updated `authenticatedFetch` to use `credentials: 'omit'` instead of `'include'`
- Added platform headers to all authenticated requests
- Enhanced logging to show token length and response status
- Added 401 error detection and logging

#### 3. contexts/AuthContext.tsx
- Updated all fetch calls to use `credentials: 'omit'`
- Added platform headers to `/api/auth/me` and `/api/profiles/complete` requests
- Enhanced error logging to show response text on failures
- Added platform information to console logs

## Authentication Flow

### Token-Based Authentication (Current Implementation)
1. **Login:** User provides email/password
2. **Token Acquisition:** Better Auth returns a session token on successful login
3. **Secure Storage:** Token is stored in:
   - **iOS/Android:** SecureStore (iOS Keychain / Android Keystore)
   - **Web:** localStorage
4. **Authenticated Requests:** All API calls include `Authorization: Bearer <token>` header
5. **No Cookies:** Mobile apps use `credentials: 'omit'` to avoid cookie-based auth issues
6. **No Origin Headers:** Mobile apps don't send origin headers, which is now allowed by the backend

### Key Differences from Previous Implementation
- **Before:** Used `credentials: 'include'` which tried to use cookies
- **After:** Uses `credentials: 'omit'` and relies solely on Authorization header
- **Before:** Backend enforced CSRF and origin validation
- **After:** Backend allows requests without origin headers for mobile apps

## Testing Checklist

### Expo Go Testing
- [ ] Sign in with email/password
- [ ] Sign out
- [ ] Sign in again (multiple times)
- [ ] Close app and reopen (session persistence)
- [ ] Create new account
- [ ] Complete profile after signup

### TestFlight Testing (CRITICAL)
- [ ] Sign in with email/password
- [ ] Sign out
- [ ] Sign in again (multiple times - test at least 5 times)
- [ ] Close app and reopen (session persistence)
- [ ] Create new account
- [ ] Complete profile after signup
- [ ] Test all authenticated features:
  - [ ] View profile
  - [ ] Add coin
  - [ ] Edit coin
  - [ ] Like/comment on coins
  - [ ] Initiate trade
  - [ ] View trades

### Expected Behavior
- ✅ Login should succeed consistently in TestFlight
- ✅ No "invalid origin" errors
- ✅ No 403 Forbidden errors on `/api/auth/sign-in/email`
- ✅ Session should persist across app restarts
- ✅ Multiple login attempts should work without issues
- ✅ All authenticated API calls should work with Bearer token

## Debugging

### Frontend Logs to Check
Look for these console logs in the app:
```
Auth: Using backend URL: https://...
Auth: Platform: ios, Standalone: true, Expo Go: false
AuthContext: Platform: ios Standalone: true Expo Go: false
AuthContext: Making /me request with session token, length: <number>
API: Making authenticated request to: <url> with token length: <number>
API: Response status: 200 for <url>
```

### Backend Logs to Check
Use `get_backend_logs` to verify:
- No 403 Forbidden errors on `/api/auth/sign-in/email`
- Requests are being received without origin headers
- CORS middleware is allowing requests without origin
- Session tokens are being extracted from Authorization header

### Common Issues and Solutions

#### Issue: Still getting 403 errors
**Solution:** Check backend logs to verify CSRF bypass is working. The backend should log "Bypassing CSRF check for mobile auth request (no origin header)"

#### Issue: Session not persisting
**Solution:** Check that SecureStore is working correctly. Look for logs showing token storage/retrieval.

#### Issue: 401 Unauthorized errors
**Solution:** Token may have expired. Check token expiration time in Better Auth configuration.

## Build Instructions

### For TestFlight
1. Update version in `app.json`:
   ```json
   {
     "version": "1.0.9",
     "ios": {
       "buildNumber": "9"
     }
   }
   ```

2. Build for iOS:
   ```bash
   eas build --platform ios --profile production
   ```

3. Submit to TestFlight:
   ```bash
   eas submit --platform ios
   ```

## Verification Steps

After deploying to TestFlight:

1. **Install the app** from TestFlight on a physical iOS device
2. **Sign in** with an existing account
3. **Verify** that login succeeds without errors
4. **Sign out** and **sign in again** multiple times (at least 5 times)
5. **Close the app** completely and **reopen** it
6. **Verify** that you're still logged in (session persistence)
7. **Test authenticated features** (add coin, view profile, etc.)

## Success Criteria

✅ **Login works consistently** in TestFlight without "invalid origin" errors
✅ **Multiple login attempts** work without issues
✅ **Session persists** across app restarts
✅ **All authenticated API calls** work correctly
✅ **No dependency** on cookies, origin headers, or CSRF tokens for mobile apps

## Notes

- This fix addresses the root cause of the "invalid origin" error by properly configuring Better Auth for native mobile apps
- The authentication flow now uses token-based auth (JWT) exclusively for mobile apps
- Cookies are no longer used for mobile authentication, eliminating CORS and origin-related issues
- The backend now accepts requests without origin headers, which is standard for native mobile apps
- All authenticated requests use the `Authorization: Bearer <token>` header pattern

## Related Documentation

- `backend/AUTHENTICATION_FIXES_APPLIED.md` - Backend authentication configuration
- `backend/AUTHENTICATION_FLOW.md` - Detailed authentication flow documentation
- `docs/BUILD_8_TESTFLIGHT_FIX.md` - Previous TestFlight fix attempt
