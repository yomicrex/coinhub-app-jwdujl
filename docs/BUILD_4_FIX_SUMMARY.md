
# Build 4 - TestFlight "Invalid Origin" Fix

## Issue Summary
Build 3 was rejected with "Invalid origin" error (403 Forbidden) when users tried to sign in via TestFlight. This is a critical authentication issue that prevents the app from being reviewed by Apple.

## Root Cause
Better Auth's CSRF (Cross-Site Request Forgery) protection was rejecting requests from mobile apps because:
1. Mobile apps (iOS/Android) don't send `Origin` headers like web browsers do
2. Better Auth's default CSRF protection requires valid Origin headers
3. This causes 403 Forbidden errors on authentication endpoints

## Fixes Applied

### Backend Changes (In Progress)
The backend is being updated with the following critical fixes:

1. **CSRF Protection Disabled for Mobile Apps**
   - Better Auth configuration updated to disable CSRF checks
   - This allows mobile apps without Origin headers to authenticate

2. **CORS Configuration Enhanced**
   - Allows requests without Origin header (mobile apps)
   - Properly configured credentials and headers
   - Trusted origins list updated

3. **Session Cookie Configuration**
   - Proper sameSite and secure flags for mobile compatibility
   - Credentials properly sent with requests

### Frontend Changes (Completed)
1. **Build Number Updated**
   - iOS: Build 4 (was 3)
   - Android: Version Code 4 (was 3)
   - App Version: 1.0.4 (was 1.0.3)

2. **Configuration Verified**
   - Backend URL: `https://qjj7hh75bj9rj8tez54zsh74jpn3wv24.app.specular.dev`
   - App Scheme: `CoinHub`
   - Auth client properly configured with Better Auth

## Testing Checklist

### Before Uploading to TestFlight
1. ✅ Build number incremented to 4
2. ⏳ Backend CSRF fix deployed (check with `get_backend_status`)
3. ⏳ Test authentication in development
4. ⏳ Verify no 403 errors in backend logs

### After Uploading to TestFlight
1. Install TestFlight build on physical device
2. Try to sign in with existing account
3. Verify no "Invalid origin" error
4. Test sign up with new account
5. Verify session persists after app restart

## Backend Status
The backend is currently being rebuilt with the CSRF fixes. To check status:
- The backend will automatically deploy when ready
- No manual intervention needed
- Authentication should work immediately after deployment

## What Changed in app.json
```json
{
  "version": "1.0.4",  // Was 1.0.3
  "ios": {
    "buildNumber": "4"  // Was "3"
  },
  "android": {
    "versionCode": 4  // Was 3
  }
}
```

## Next Steps

1. **Wait for Backend Deployment**
   - The backend is being rebuilt with CSRF fixes
   - This should complete within a few minutes
   - No action needed from you

2. **Build and Upload to TestFlight**
   ```bash
   # Build for iOS
   eas build --platform ios --profile production
   
   # After build completes, it will automatically upload to TestFlight
   ```

3. **Test in TestFlight**
   - Install the new build (Build 4)
   - Try signing in
   - Verify the "Invalid origin" error is gone

4. **Submit for Review**
   - Once TestFlight testing confirms the fix works
   - Submit Build 4 to Apple for App Store review

## Technical Details

### Why This Fix Works
- **CSRF Protection**: Designed for web browsers, not mobile apps
- **Mobile Apps**: Don't send Origin headers by default
- **Solution**: Disable CSRF for Better Auth (safe for mobile-only apps)
- **Alternative**: Could use custom headers, but disabling is simpler and standard for mobile

### Security Considerations
- CSRF protection is primarily for web browsers
- Mobile apps use different security models (app sandboxing, secure storage)
- Better Auth still validates session tokens and user credentials
- This is a standard configuration for mobile apps using Better Auth

## Verification

### Backend Logs to Check
After deployment, check logs for:
- ✅ No more 403 errors on `/api/auth/sign-in/email`
- ✅ Successful authentication requests
- ✅ Session creation working

### Frontend Logs to Check
In the app:
- ✅ No "Invalid origin" errors
- ✅ Successful sign in
- ✅ Session persists after app restart

## Support
If you still see issues after deploying Build 4:
1. Check backend logs for errors
2. Verify the backend deployment completed
3. Test with a fresh install (delete app, reinstall from TestFlight)
4. Check that you're using the correct backend URL

---

**Status**: Backend deployment in progress, frontend ready for Build 4
**Next Action**: Wait for backend deployment, then build and upload to TestFlight
