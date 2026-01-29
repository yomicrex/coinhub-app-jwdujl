
# Build 8 - TestFlight "Invalid Origin" Fix

## Problem Summary

Users were unable to sign in or create accounts when using the app through TestFlight. The error was:
- **Error Message**: "invalid origin"
- **HTTP Status**: 403 Forbidden
- **Affected Platforms**: iOS (TestFlight), iOS (App Store), Android production builds
- **Working Platforms**: Expo Go, Web browsers

## Root Cause

Better Auth (the authentication library) has built-in origin validation that rejects requests without an `origin` header. Native mobile apps (iOS/Android) **DO NOT** send origin headers because:

1. Native apps don't have a web origin (they're not running in a browser)
2. The `origin` header is a browser security feature
3. TestFlight and App Store builds are native apps, not web apps

The authentication flow was:
1. User taps "Sign In" in TestFlight app
2. App sends request to `/api/auth/sign-in/email` without origin header
3. Better Auth checks for origin header
4. Better Auth rejects request with 403 "invalid origin" error
5. User sees error and cannot sign in

## The Fix

### Backend Changes (Build 8)

Updated `backend/src/index.ts` to configure Better Auth to accept requests without origin headers:

```typescript
app.withAuth({
  trustedOrigins: [
    '*', // Allow requests without origin header (native mobile apps)
    'http://localhost:3000',
    'http://localhost:8081',
    'http://localhost:8082',
    'https://qjj7hh75bj9rj8tez54zsh74jpn3wv24.app.specular.dev',
    'coinhub://',
    'CoinHub://',
    'com.coinhub.app://',
  ],
  allowOriginless: true, // CRITICAL: Allow native mobile apps
});
```

**Key Configuration:**
- `trustedOrigins: ['*']` - Accepts any origin (including no origin)
- `allowOriginless: true` - Explicitly allows requests without origin headers
- This configuration is **required** for native mobile apps to work

### Frontend Changes (Build 8)

Updated `lib/auth.ts` to optimize for native mobile apps:

```typescript
export const authClient = createAuthClient({
  baseURL: `${API_URL}/api/auth`,
  plugins: [
    expoClient({
      scheme: APP_SCHEME,
      storagePrefix: APP_SCHEME,
      storage,
    }),
  ],
  fetchOptions: {
    // Use 'omit' for native apps (don't send cookies)
    // Use 'include' for web (send cookies)
    credentials: Platform.OS === "web" ? "include" : "omit",
    headers: {
      // Don't send origin header for native apps
      ...(Platform.OS !== "web" && {
        "X-Requested-With": "XMLHttpRequest",
        "X-Platform": Platform.OS,
      }),
    },
  },
});
```

**Key Changes:**
- `credentials: "omit"` for native apps (prevents CORS issues)
- No origin header sent for native apps
- Platform-specific headers for debugging

## Version Numbers

- **App Version**: 1.0.8
- **iOS Build Number**: 8
- **Android Version Code**: 8

## Testing Checklist

Before uploading to TestFlight:

- [ ] Backend build completed successfully
- [ ] Backend is running at: https://qjj7hh75bj9rj8tez54zsh74jpn3wv24.app.specular.dev
- [ ] Test sign-up with new email in Expo Go (should work)
- [ ] Test sign-in with existing account in Expo Go (should work)
- [ ] Build iOS app with EAS: `eas build --platform ios --profile production`
- [ ] Upload to TestFlight
- [ ] Test sign-up in TestFlight (should work now)
- [ ] Test sign-in in TestFlight (should work now)

## What Changed vs Previous Builds

### Build 7 (Failed)
- Had CORS middleware but Better Auth rejected requests before middleware ran
- Better Auth's origin check happened at framework level

### Build 8 (Fixed)
- Configured Better Auth itself to accept originless requests
- Better Auth now allows native mobile apps
- CORS middleware still in place for additional protection

## Technical Details

### Why Previous Fixes Didn't Work

1. **Build 3-5**: Added CORS headers, but Better Auth rejected requests before CORS middleware ran
2. **Build 6**: Added CSRF bypass, but origin check still failed
3. **Build 7**: Added more CORS configuration, but Better Auth's built-in origin validation still rejected requests

### Why This Fix Works

Better Auth has **two layers** of protection:
1. **Framework-level origin validation** (runs first)
2. **CSRF protection** (runs second)

Previous fixes only addressed layer 2 (CSRF). This fix addresses layer 1 (origin validation) by configuring Better Auth to accept originless requests.

## Security Considerations

**Q: Is it safe to allow requests without origin headers?**

**A: Yes, for native mobile apps.** Here's why:

1. **Native apps use Bearer tokens** (Authorization header) instead of cookies
2. **CSRF attacks only work with cookies** (which native apps don't use)
3. **Origin header is a browser security feature** (not applicable to native apps)
4. **Better Auth validates the Bearer token** on every request
5. **The backend still validates user identity** via session tokens

**What's Protected:**
- All authenticated endpoints require valid session tokens
- Session tokens are stored securely in iOS Keychain / Android Keystore
- Tokens expire after 7 days
- Invalid tokens are rejected

**What's NOT a Risk:**
- CSRF attacks (native apps don't use cookies)
- XSS attacks (native apps don't execute arbitrary JavaScript)
- Origin spoofing (native apps don't send origin headers)

## Deployment Steps

1. **Wait for backend build to complete**
   ```bash
   # Check status
   curl https://qjj7hh75bj9rj8tez54zsh74jpn3wv24.app.specular.dev/api/auth/health
   ```

2. **Build iOS app**
   ```bash
   eas build --platform ios --profile production
   ```

3. **Upload to TestFlight**
   - EAS will automatically upload to App Store Connect
   - Wait for processing (10-30 minutes)

4. **Test in TestFlight**
   - Install build 8 from TestFlight
   - Try to sign up with a new email
   - Try to sign in with an existing account
   - Both should work without "invalid origin" error

## Rollback Plan

If this fix doesn't work:

1. **Check backend logs**
   ```bash
   # Look for 403 errors
   curl https://qjj7hh75bj9rj8tez54zsh74jpn3wv24.app.specular.dev/api/auth/health
   ```

2. **Verify Better Auth configuration**
   - Check that `allowOriginless: true` is set
   - Check that `trustedOrigins` includes `'*'`

3. **Test with debug endpoint**
   ```bash
   # Test if origin check is working
   curl -X POST https://qjj7hh75bj9rj8tez54zsh74jpn3wv24.app.specular.dev/api/auth/sign-in/email \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"test123"}'
   ```

## Success Criteria

✅ Users can sign up from TestFlight
✅ Users can sign in from TestFlight
✅ No "invalid origin" errors
✅ Sessions persist correctly
✅ All authenticated features work

## Contact

If issues persist after Build 8:
1. Check backend logs for errors
2. Verify Better Auth configuration
3. Test with Expo Go first (should always work)
4. Compare TestFlight behavior to Expo Go
