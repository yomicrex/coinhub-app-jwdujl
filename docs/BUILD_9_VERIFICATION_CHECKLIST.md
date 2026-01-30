
# Build 9 Verification Checklist

## Pre-Build Verification

### Code Changes Verified
- [x] `lib/auth.ts` - Updated to use `credentials: 'omit'` for all platforms
- [x] `utils/api.ts` - Updated `authenticatedFetch` and `authenticatedUpload` to use `credentials: 'omit'`
- [x] `contexts/AuthContext.tsx` - Updated all fetch calls to use `credentials: 'omit'` and added platform headers
- [x] Backend - Configured Better Auth to disable CSRF and accept requests without origin headers

### Configuration Files
- [ ] `app.json` - Update version to "1.0.9" and iOS buildNumber to "9"
- [ ] `eas.json` - Verify autoIncrement is enabled for production profile

## Build Process

### 1. Update Version Numbers
```bash
# Update app.json
{
  "version": "1.0.9",
  "ios": {
    "buildNumber": "9"
  },
  "android": {
    "versionCode": 9
  }
}
```

### 2. Build for iOS
```bash
eas build --platform ios --profile production
```

### 3. Submit to TestFlight
```bash
eas submit --platform ios
```

## Testing in TestFlight

### Basic Authentication Tests
- [ ] **Test 1:** Sign in with existing account
  - Expected: Login succeeds without errors
  - Check: No "invalid origin" error
  - Check: No 403 Forbidden error

- [ ] **Test 2:** Sign out and sign in again
  - Expected: Login succeeds
  - Repeat: 5 times minimum

- [ ] **Test 3:** Close app and reopen
  - Expected: User remains logged in
  - Check: Session persists

- [ ] **Test 4:** Create new account
  - Expected: Signup succeeds
  - Expected: Profile completion works

### Authenticated Features Tests
- [ ] **Test 5:** View profile
  - Expected: Profile loads correctly
  - Check: Avatar, username, display name visible

- [ ] **Test 6:** Add coin
  - Expected: Coin creation succeeds
  - Check: Images upload correctly
  - Check: Coin appears in profile

- [ ] **Test 7:** Edit coin
  - Expected: Coin update succeeds
  - Check: Changes are saved

- [ ] **Test 8:** Like/comment on coins
  - Expected: Like/comment succeeds
  - Check: Counts update correctly

- [ ] **Test 9:** View trades
  - Expected: Trades list loads
  - Check: Trade details accessible

- [ ] **Test 10:** Initiate trade
  - Expected: Trade creation succeeds
  - Check: Trade appears in trades list

### Stress Tests
- [ ] **Test 11:** Multiple rapid logins
  - Sign in and out 10 times rapidly
  - Expected: All logins succeed

- [ ] **Test 12:** App restart after each action
  - Perform action → close app → reopen
  - Expected: Session persists, action saved

- [ ] **Test 13:** Network interruption
  - Enable airplane mode during login
  - Expected: Appropriate error message
  - Disable airplane mode and retry
  - Expected: Login succeeds

## Console Log Verification

### Expected Frontend Logs
Look for these in Xcode console:
```
✅ Auth: Using backend URL: https://qjj7hh75bj9rj8tez54zsh74jpn3wv24.app.specular.dev
✅ Auth: Platform: ios
✅ Auth: Is standalone: true
✅ AuthContext: Platform: ios Standalone: true Expo Go: false
✅ AuthContext: Making /me request with session token, length: <number>
✅ API: Making authenticated request to: <url> with token length: <number>
✅ API: Response status: 200 for <url>
```

### Expected Backend Logs
Check via `get_backend_logs`:
```
✅ incoming request: POST /api/auth/sign-in/email
✅ request completed: status 200
✅ Bypassing CSRF check for mobile auth request
✅ Request without origin header (likely native mobile app)
```

### Red Flags (Should NOT Appear)
```
❌ request completed: status 403
❌ CSRF check failed
❌ Invalid origin
❌ Origin header required
```

## Success Criteria

### Must Pass All:
1. ✅ Login succeeds consistently in TestFlight (no 403 errors)
2. ✅ Multiple login attempts work without issues (tested 5+ times)
3. ✅ Session persists across app restarts
4. ✅ All authenticated API calls work correctly
5. ✅ No "invalid origin" errors appear
6. ✅ No dependency on cookies or origin headers

### Performance Benchmarks:
- Login response time: < 2 seconds
- Session validation: < 1 second
- API requests: < 3 seconds

## Rollback Plan

If issues persist:
1. Revert to Build 8
2. Check backend logs for specific errors
3. Verify Better Auth configuration was applied
4. Test in Expo Go to isolate mobile-specific issues

## Sign-Off

- [ ] All basic authentication tests passed
- [ ] All authenticated features tests passed
- [ ] All stress tests passed
- [ ] Console logs verified
- [ ] Backend logs verified
- [ ] Ready for App Store submission

**Tested By:** _________________
**Date:** _________________
**Build Version:** 1.0.9
**Build Number:** 9
**Device:** _________________
**iOS Version:** _________________

## Notes

_Add any observations or issues encountered during testing:_

---

**Next Steps After Verification:**
1. If all tests pass → Submit to App Store
2. If issues found → Document and create new fix
3. Monitor user feedback after release
