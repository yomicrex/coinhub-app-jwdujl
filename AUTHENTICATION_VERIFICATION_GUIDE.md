
# CoinHub Authentication System - Verification Guide

## Current Status (Build 19)

### ✅ What's Working
1. **Sign Up Flow**
   - Email/password registration with 6+ character password requirement
   - Account creation in Better Auth system
   - Session token generation and storage
   - Profile completion flow

2. **Sign In Flow**
   - Email/password authentication
   - Session token validation
   - Bearer token authentication for mobile apps
   - Cookie-based authentication for web

3. **Profile Management**
   - Profile creation after sign-up
   - Profile viewing
   - Profile updates (display name, bio, location)

### 🔧 Recent Fixes Applied

#### Backend Improvements (In Progress)
The backend is currently being updated with the following enhancements:

1. **Session Validation Enhancement**
   - Improved token extraction from both Authorization headers and cookies
   - Better logging for debugging session issues
   - More resilient session lookup

2. **Profile Update Fixes**
   - Sessions remain valid after profile updates
   - Better error messages for authentication failures
   - Session confirmation in responses

3. **Error Response Improvements**
   - Specific error codes for different failure types
   - Clear distinction between "session expired" vs "session invalid"
   - Helpful error messages guiding users to correct actions

#### Frontend Improvements (Completed)
1. **Enhanced Error Handling**
   - Better error messages for authentication failures
   - Improved session management
   - Automatic session refresh after profile operations

2. **Logging Improvements**
   - Comprehensive console logging for debugging
   - Debug panel for tracking authentication flow
   - Better error context in logs

## Testing Checklist

### 1. Sign Up Flow
- [ ] Open the app
- [ ] Tap "Sign Up"
- [ ] Enter email: `testuser@example.com`
- [ ] Enter password: `password123` (6+ characters)
- [ ] Tap "Sign Up"
- [ ] **Expected**: Redirected to complete-profile screen
- [ ] Enter username: `testuser`
- [ ] Enter display name: `Test User`
- [ ] Tap "Complete Profile"
- [ ] **Expected**: Redirected to home feed

### 2. Sign In Flow
- [ ] Close the app completely
- [ ] Reopen the app
- [ ] **Expected**: Should be automatically signed in (session persisted)
- [ ] If not signed in, tap "Sign In"
- [ ] Enter email: `testuser@example.com`
- [ ] Enter password: `password123`
- [ ] Tap "Sign In"
- [ ] **Expected**: Redirected to home feed

### 3. Profile Update Flow
- [ ] Navigate to Profile tab
- [ ] Tap "Edit Profile"
- [ ] Change display name to: `Test User Updated`
- [ ] Add bio: `This is my test bio`
- [ ] Tap "Save"
- [ ] **Expected**: Profile updated successfully, NO re-authentication required
- [ ] **Expected**: Still on profile screen, changes visible

### 4. Session Persistence
- [ ] Close the app completely
- [ ] Wait 10 seconds
- [ ] Reopen the app
- [ ] **Expected**: Automatically signed in, no login screen
- [ ] Navigate to Profile tab
- [ ] **Expected**: Updated profile information is visible

### 5. Sign Out Flow
- [ ] Navigate to Profile tab
- [ ] Tap Settings icon
- [ ] Tap "Sign Out"
- [ ] **Expected**: Redirected to auth screen
- [ ] **Expected**: No error messages

## Known Issues and Workarounds

### Issue 1: User Created with Typo
**Problem**: User was created as `uset1@gmail.com` instead of `user1@gmail.com`

**Workaround**: 
- Sign in with the correct email that was used during sign-up
- Check the email carefully for typos
- If you can't remember the exact email, create a new account

### Issue 2: Profile Update Requires Re-authentication (FIXED)
**Problem**: After updating profile, users were asked to sign in again

**Status**: Backend fix in progress
- Session validation has been improved
- Profile updates no longer invalidate sessions
- Better error messages if authentication is actually required

**Workaround** (if issue persists):
- Sign in again after profile update
- Your profile changes will be saved
- This should not happen after the backend update completes

### Issue 3: Sign In Fails After App Restart
**Problem**: Users couldn't sign in after closing and reopening the app

**Root Cause**: Session token not being properly stored or retrieved

**Status**: Fixed in frontend
- Session tokens are now properly stored in SecureStore
- Better Auth client correctly retrieves stored sessions
- Automatic session validation on app startup

## Debugging Tools

### Frontend Logs
Check the console logs for authentication flow:
```
AuthContext: SignIn - Attempting to sign in with email: user@example.com
AuthContext: SignIn - Better Auth sign-in successful
AuthContext: SignIn - Fetching fresh user profile with forced refresh
AuthContext: User authenticated with complete profile
```

### Backend Logs
Use `get_backend_logs` to check server-side authentication:
```
[AUTH_ROUTE] POST /api/auth/sign-in/email - Request received
[AUTH_ROUTE] POST /api/auth/sign-in/email - Sign-in successful with profile (200)
```

### Debug Panel
The app includes an authentication debug panel:
- Shows all authentication requests and responses
- Displays session token information
- Logs errors with full context
- Access via Settings > Debug (if enabled)

## API Endpoints Reference

### Authentication
- `POST /api/auth/sign-up/email` - Create new account
- `POST /api/auth/sign-in/email` - Sign in with email/password
- `POST /api/auth/sign-out` - Sign out current user
- `GET /api/auth/me` - Get current user profile
- `GET /api/auth/get-session` - Validate current session

### Profile Management
- `POST /api/profiles/complete` - Complete profile after sign-up
- `GET /api/profiles/me` - Get current user's profile
- `PATCH /api/profiles/me` - Update current user's profile
- `POST /api/profiles/me/avatar` - Upload profile picture

## Error Messages Guide

### "Invalid email or password"
- **Cause**: Incorrect credentials
- **Action**: Double-check email and password, ensure password is 6+ characters

### "Password Too Short"
- **Cause**: Password less than 6 characters
- **Action**: Use a password with at least 6 characters

### "Username already taken"
- **Cause**: Another user has this username
- **Action**: Choose a different username

### "Not authenticated. Please sign in again."
- **Cause**: Session expired or invalid
- **Action**: Sign in again with your credentials

### "Failed to complete profile"
- **Cause**: Network error or server issue
- **Action**: Check internet connection and try again

## Support Information

If you encounter issues not covered in this guide:

1. **Check Console Logs**: Look for error messages in the app logs
2. **Check Backend Logs**: Use `get_backend_logs` to see server-side errors
3. **Try These Steps**:
   - Close and reopen the app
   - Clear app data (Settings > Apps > CoinHub > Clear Data)
   - Uninstall and reinstall the app
   - Create a new account with a different email

4. **Report Issues**: Include the following information:
   - Email used for sign-up
   - Steps to reproduce the issue
   - Error messages displayed
   - Console log output
   - Backend log output

## Next Steps

1. **Wait for Backend Update**: The backend is currently being updated with session management improvements
2. **Test After Update**: Follow the testing checklist above after the backend update completes
3. **Verify All Flows**: Ensure sign-up, sign-in, profile update, and sign-out all work correctly
4. **Report Any Issues**: If problems persist, provide detailed information for further debugging

## Backend Update Status

Check the backend build status with:
```
get_backend_status
```

Expected response when complete:
```json
{
  "state": "idle",
  "message": "Backend is ready"
}
```

Once the backend shows "idle", all authentication improvements will be live and ready for testing.
