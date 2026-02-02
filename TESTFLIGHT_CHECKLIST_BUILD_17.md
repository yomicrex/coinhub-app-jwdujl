
# TestFlight Submission Checklist - Build 17

## Pre-Build Checklist

### ✅ Code Changes Verified
- [x] App scheme changed to "coinhub" (lowercase)
- [x] Version bumped to 1.0.17
- [x] Build number bumped to 17
- [x] Error handling improved
- [x] Splash screen management added
- [x] Alert.alert replaced with custom Modals
- [x] All routes registered in _layout.tsx

### ✅ Files Modified
- [x] app.json
- [x] app/_layout.tsx
- [x] contexts/AuthContext.tsx
- [x] app/index.tsx
- [x] app/complete-profile.tsx
- [x] app/(tabs)/(home)/index.tsx

## Build Process

### Step 1: Clean Build
```bash
# Clean node modules
rm -rf node_modules
npm install

# Verify no errors
npm run lint
```

### Step 2: Build for iOS
```bash
# Build production version
eas build --platform ios --profile production

# Wait for build to complete (usually 10-20 minutes)
```

### Step 3: Upload to TestFlight
- Build will automatically upload to App Store Connect
- Wait for processing (usually 5-10 minutes)
- Add to TestFlight group

## Testing Checklist

### 🧪 Critical Tests (MUST PASS)

#### Test 1: Fresh Install
- [ ] Delete old app completely
- [ ] Install Build 17 from TestFlight
- [ ] Open app
- [ ] **Expected:** App opens to login screen without crashing
- [ ] **Status:** ___________

#### Test 2: Login Flow
- [ ] Enter valid email and password
- [ ] Tap "Sign In"
- [ ] **Expected:** Successfully logs in and shows home feed
- [ ] **Status:** ___________

#### Test 3: Signup Flow
- [ ] Tap "Don't have an account? Sign Up"
- [ ] Enter new email and password
- [ ] Tap "Sign Up"
- [ ] **Expected:** Shows profile completion screen
- [ ] Fill in username and display name
- [ ] Tap "Complete Profile"
- [ ] **Expected:** Shows home feed
- [ ] **Status:** ___________

#### Test 4: App Relaunch
- [ ] Close app completely
- [ ] Reopen app
- [ ] **Expected:** Opens directly to home feed (if logged in)
- [ ] **Status:** ___________

#### Test 5: Logout
- [ ] Go to Profile tab
- [ ] Tap Settings
- [ ] Tap "Sign Out"
- [ ] **Expected:** Returns to login screen without crashing
- [ ] **Status:** ___________

### 🔍 Additional Tests (SHOULD PASS)

#### Test 6: Profile Viewing
- [ ] Tap on a user's profile from feed
- [ ] **Expected:** Shows user profile screen
- [ ] **Status:** ___________

#### Test 7: Coin Viewing
- [ ] Tap on a coin from feed
- [ ] **Expected:** Shows coin detail screen
- [ ] **Status:** ___________

#### Test 8: Add Coin
- [ ] Tap "+" button in header
- [ ] **Expected:** Shows add coin screen
- [ ] **Status:** ___________

#### Test 9: Like/Comment
- [ ] Tap heart icon on a coin
- [ ] **Expected:** Like count increases
- [ ] Tap comment icon
- [ ] **Expected:** Shows comment modal
- [ ] **Status:** ___________

#### Test 10: Search
- [ ] Tap "Search" button
- [ ] **Expected:** Shows search screen
- [ ] **Status:** ___________

### 🌐 Web Compatibility Tests (OPTIONAL)

#### Test 11: Web Version
- [ ] Open app in web browser
- [ ] Test login flow
- [ ] Test error messages (should show in modals, not alerts)
- [ ] **Status:** ___________

## Device Testing Matrix

### Minimum Testing Requirements
Test on at least 2 different devices:

#### Device 1:
- [ ] Model: ___________
- [ ] iOS Version: ___________
- [ ] All critical tests passed: [ ]

#### Device 2:
- [ ] Model: ___________
- [ ] iOS Version: ___________
- [ ] All critical tests passed: [ ]

### Recommended Testing
Test on these device types if available:
- [ ] iPhone with notch (iPhone X or newer)
- [ ] iPhone without notch (iPhone 8 or older)
- [ ] iPad (if supported)

## Known Issues to Watch For

### ❌ Issues That Should NOT Occur in Build 17:
- App crashing on launch
- Authentication failures
- Infinite loading screens
- Redirect loops
- Alert.alert not working on web

### ⚠️ If You See These Issues:
1. **Verify build number** - Make sure it's Build 17
2. **Check device logs** - Look for error messages
3. **Try fresh install** - Delete app and reinstall
4. **Check internet** - Verify stable connection

## Approval Criteria

### ✅ Ready for App Store Submission if:
- [ ] All 5 critical tests pass
- [ ] Tested on at least 2 devices
- [ ] No crashes observed
- [ ] Login/signup works reliably
- [ ] App remembers login state
- [ ] No infinite loading or redirect loops

### ❌ NOT Ready if:
- [ ] Any critical test fails
- [ ] App crashes on launch
- [ ] Authentication doesn't work
- [ ] Infinite loading screens
- [ ] Redirect loops occur

## Post-Testing Actions

### If All Tests Pass:
1. [ ] Mark build as "Ready for Review" in TestFlight
2. [ ] Submit to App Store Review
3. [ ] Monitor for user feedback
4. [ ] Celebrate! 🎉

### If Tests Fail:
1. [ ] Document exact failure scenario
2. [ ] Collect device logs
3. [ ] Report issues with:
   - Device model and iOS version
   - Exact steps to reproduce
   - Screenshots/screen recordings
   - Error messages
4. [ ] Wait for Build 18 with fixes

## Emergency Rollback Plan

### If Build 17 Has Critical Issues:
1. **DO NOT** rollback to Build 16 (it has the crash bug)
2. **DO** create emergency Build 18 with fixes
3. **DO** remove Build 17 from TestFlight
4. **DO** notify testers of the issue

## Contact Information

### For Build Issues:
- Check backend status: https://qjj7hh75bj9rj8tez54zsh74jpn3wv24.app.specular.dev
- Review documentation: CRITICAL_FIX_BUILD_17.md
- Check detailed changes: CHANGES_BUILD_17.md

### For Testing Questions:
- Review testing guide: BUILD_17_QUICK_GUIDE.md
- Review fix summary: FIX_SUMMARY_BUILD_17.md

---

## Final Checklist

Before submitting to App Store Review:

- [ ] All critical tests passed
- [ ] Tested on multiple devices
- [ ] No crashes observed
- [ ] Screenshots updated (if needed)
- [ ] App description updated (if needed)
- [ ] Privacy policy current
- [ ] Terms of service current
- [ ] Contact information correct
- [ ] Support URL working

**Build 17 Status:** ⬜ Not Started | ⬜ In Progress | ⬜ Ready | ⬜ Submitted

**Tester Name:** ___________
**Test Date:** ___________
**Result:** ⬜ PASS | ⬜ FAIL

---

**Good luck with Build 17!** 🚀
