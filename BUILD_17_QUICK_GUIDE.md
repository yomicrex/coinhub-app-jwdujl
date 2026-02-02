
# Build 17 - Quick Testing Guide

## What Was Fixed
The app was crashing because of a **critical scheme mismatch**. The app.json had `scheme: "CoinHub"` but the authentication system expected `scheme: "coinhub"`. This has been fixed.

## Version Info
- **Version:** 1.0.17
- **Build Number:** 17 (iOS and Android)
- **Critical Fix:** App scheme changed from "CoinHub" to "coinhub"

## How to Build and Test

### 1. Build for TestFlight
```bash
eas build --platform ios --profile production
```

### 2. What to Test
Once installed on your device:

#### ✅ Login Flow
1. Open the app
2. You should see the CoinHub splash screen
3. Then the login screen
4. Try logging in with your credentials
5. **Expected:** Login should work without crashes

#### ✅ Signup Flow
1. Tap "Don't have an account? Sign Up"
2. Enter email and password
3. Tap "Sign Up"
4. **Expected:** Should redirect to profile completion screen
5. Fill in username and display name
6. Tap "Complete Profile"
7. **Expected:** Should redirect to home feed

#### ✅ App Launch
1. Close the app completely
2. Reopen it
3. **Expected:** Should show splash screen briefly, then home feed (if logged in) or login screen (if logged out)
4. **Expected:** NO CRASHES

#### ✅ Logout
1. Go to Profile tab
2. Tap Settings
3. Tap "Sign Out"
4. **Expected:** Should redirect to login screen without crashes

## What Changed

### Critical Changes:
1. **app.json:** scheme changed from "CoinHub" to "coinhub"
2. **Version bumped:** 1.0.16 → 1.0.17
3. **Build number bumped:** 16 → 17

### Stability Improvements:
1. Better error handling in authentication
2. Splash screen management improved
3. Redirect loop prevention added
4. Web-compatible error modals (no more Alert.alert issues)
5. Increased auth timeout for slower connections

## If You Still See Issues

### Check These:
1. **Make sure you're testing build 17** (not an old build)
2. **Check the app version** in Settings → About
3. **Try a fresh install** (delete old app first)
4. **Check your internet connection**

### Get Logs:
If the app crashes, check the device logs:
```bash
# For iOS
xcrun simctl spawn booted log stream --predicate 'process == "CoinHub"'

# Or use Xcode → Window → Devices and Simulators → View Device Logs
```

## Expected Behavior

### On First Launch:
1. Splash screen (1-2 seconds)
2. Login screen appears
3. No crashes

### After Login:
1. If new user → Profile completion screen
2. If existing user → Home feed
3. No crashes

### On Subsequent Launches:
1. Splash screen (1 second)
2. Automatically goes to home feed (if logged in)
3. No crashes

## Success Criteria
✅ App launches without crashing
✅ Login works
✅ Signup works
✅ Profile completion works
✅ App remembers login state
✅ Logout works
✅ No infinite redirect loops

## Contact
If you still experience crashes after testing build 17, please provide:
1. Device model and iOS version
2. Exact steps to reproduce
3. Whether it's a fresh install or update
4. Any error messages you see
