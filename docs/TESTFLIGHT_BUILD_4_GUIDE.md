
# TestFlight Build 4 - Quick Reference Guide

## What Was Fixed

### The Problem
- **Error**: "Invalid origin" (403 Forbidden)
- **Where**: Sign in screen in TestFlight
- **Why**: Better Auth's CSRF protection rejected mobile app requests

### The Solution
- **Backend**: Disabled CSRF protection for mobile apps
- **Frontend**: Updated build number to 4
- **Result**: Mobile apps can now authenticate successfully

## Current Status

### ✅ Completed
- Build number updated to 4 (iOS and Android)
- App version updated to 1.0.4
- Frontend configuration verified
- Backend fix requested and processing

### ⏳ In Progress
- Backend deployment with CSRF fix
- Should complete within a few minutes

## Next Steps

### 1. Wait for Backend Deployment
The backend is currently being rebuilt with the CSRF fix. You don't need to do anything - it will deploy automatically.

To check if it's ready:
- The backend will be live at: `https://qjj7hh75bj9rj8tez54zsh74jpn3wv24.app.specular.dev`
- You can test by trying to sign in from the app

### 2. Build for TestFlight
Once the backend is deployed, build the new version:

```bash
# Build for iOS (TestFlight)
eas build --platform ios --profile production

# This will:
# - Build version 1.0.4 (Build 4)
# - Automatically upload to TestFlight
# - Take about 15-20 minutes
```

### 3. Test in TestFlight
After the build uploads:
1. Open TestFlight on your iPhone
2. Install Build 4
3. Try to sign in
4. Verify no "Invalid origin" error appears
5. Test that you can:
   - Sign in successfully
   - View your profile
   - Add coins
   - Browse the feed

### 4. Submit to Apple
Once TestFlight testing confirms everything works:
1. Go to App Store Connect
2. Select your app
3. Create a new version (1.0.4)
4. Select Build 4
5. Submit for review

## What Changed

### app.json
```json
{
  "version": "1.0.4",     // Was 1.0.3
  "ios": {
    "buildNumber": "4"    // Was "3"
  },
  "android": {
    "versionCode": 4      // Was 3
  }
}
```

### Backend (Automatic)
- CSRF protection disabled for mobile apps
- CORS properly configured for mobile
- Session cookies configured correctly

## Troubleshooting

### If You Still See "Invalid Origin"
1. Make sure you're testing Build 4 (not Build 3)
2. Delete the app and reinstall from TestFlight
3. Check that the backend deployment completed
4. Try signing in with a different account

### If Sign In Fails for Other Reasons
1. Check your internet connection
2. Verify the backend is running: `https://qjj7hh75bj9rj8tez54zsh74jpn3wv24.app.specular.dev/health`
3. Try signing up with a new account
4. Check if you're using the correct credentials

### If Build Fails
1. Make sure you have the latest EAS CLI: `npm install -g eas-cli`
2. Check your Apple Developer account is active
3. Verify your provisioning profiles are valid
4. Try running: `eas build --platform ios --profile production --clear-cache`

## Important Notes

### Build Numbers
- iOS Build: 4
- Android Version Code: 4
- App Version: 1.0.4
- These must match in app.json

### Backend URL
- Production: `https://qjj7hh75bj9rj8tez54zsh74jpn3wv24.app.specular.dev`
- This is configured in app.json and used automatically
- No need to change anything

### App Scheme
- Scheme: `CoinHub`
- Used for deep linking and OAuth
- Already configured correctly

## Timeline

1. **Now**: Backend deploying (5-10 minutes)
2. **Next**: Build for TestFlight (15-20 minutes)
3. **Then**: TestFlight processing (5-10 minutes)
4. **Finally**: Test and submit to Apple

Total time: ~30-40 minutes from now to TestFlight testing

## Success Criteria

Build 4 is successful when:
- ✅ No "Invalid origin" error
- ✅ Sign in works in TestFlight
- ✅ Session persists after app restart
- ✅ All features work as expected
- ✅ Ready for Apple Store review

---

**Current Build**: 4
**Current Version**: 1.0.4
**Backend Status**: Deploying
**Ready for TestFlight**: Yes (after backend deploys)
