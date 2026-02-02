
# CoinHub Auth Fix - Quick Start Testing Guide

## Current Status
✅ Backend build is processing (comprehensive auth fix)
✅ Frontend is already correctly configured
⏳ Waiting for backend deployment to complete

## What Was Fixed

### Backend Changes (Processing)
1. **Better Auth Handler Mounted** - All Better Auth routes now accessible at `/api/auth/*`
2. **Database Migration** - Duplicate emails cleaned up, UNIQUE constraint reinstated
3. **Mobile CSRF Bypass** - Mobile apps no longer blocked by "Invalid origin" errors
4. **Health Endpoints** - `/api/health` and `/api/auth/_debug` added for monitoring
5. **Admin Tools** - Password recovery endpoints for corrupted accounts

### Frontend (Already Correct)
- ✅ Better Auth client configured for mobile
- ✅ Bearer token authentication
- ✅ Platform headers sent correctly
- ✅ Profile completion flow working

## Quick Test (After Backend Deploys)

### 1. Check Health
```bash
curl https://qjj7hh75bj9rj8tez54zsh74jpn3wv24.app.specular.dev/api/health
```
Expected: `{"status":"healthy","timestamp":"..."}`

### 2. Check Auth Routes
```bash
curl https://qjj7hh75bj9rj8tez54zsh74jpn3wv24.app.specular.dev/api/auth/_debug
```
Expected: List of available auth routes

### 3. Test iOS App
1. Open CoinHub on iOS
2. Try to sign in with existing account
3. Expected: Sign in successful (no 404 or "Invalid origin" errors)

## Fix Corrupted Passwords (user2, user4)

### Check Account Status
```bash
curl https://qjj7hh75bj9rj8tez54zsh74jpn3wv24.app.specular.dev/api/admin/check-account/user4@gmail.com
```

### Fix Password
```bash
curl -X POST https://qjj7hh75bj9rj8tez54zsh74jpn3wv24.app.specular.dev/api/admin/fix-password \
  -H "Content-Type: application/json" \
  -d '{"email":"user4@gmail.com","newPassword":"newpassword123"}'
```

### Notify User
"Your password has been reset to: newpassword123. Please sign in and change it in settings."

## Monitoring

### Check Backend Status
Use the tool: `get_backend_status()`

### Check Backend Logs
Use the tool: `get_backend_logs(limit=50)`

### Look For
- ✅ No more 404 errors on `/api/auth/sign-in/email`
- ✅ No more "Invalid origin" errors
- ✅ Successful sign-in logs
- ✅ Session creation logs

## Expected Results

### Before Fix
- ❌ POST /api/auth/sign-in/email → 404 Not Found
- ❌ Mobile apps → "Invalid origin" error
- ❌ user2, user4 → "Invalid password hash" error

### After Fix
- ✅ POST /api/auth/sign-in/email → 200 OK or 400 Bad Request
- ✅ Mobile apps → Successful authentication
- ✅ user2, user4 → Can sign in after password reset

## Next Steps

1. **Wait for Backend Build**
   - Check status every few minutes
   - Look for `state: "idle"` (build complete)

2. **Test Endpoints**
   - Run the curl commands above
   - Verify all return 200 (not 404)

3. **Test iOS App**
   - Sign in with existing account
   - Sign up new account
   - Verify session persists

4. **Fix Affected Users**
   - Reset passwords for user2 and user4
   - Notify them to sign in again

5. **Monitor**
   - Check logs for any errors
   - Verify no more 404s or "Invalid origin" errors

## Troubleshooting

### If Sign-In Still Fails
1. Check backend logs: `get_backend_logs()`
2. Look for the specific error message
3. Check if request reached backend (should see log entry)
4. If 404: Backend build may not be complete yet
5. If "Invalid origin": Check X-App-Type header is being sent

### If Password Hash Error
1. Use admin tool to check account: `/api/admin/check-account/:email`
2. Use admin tool to fix password: `/api/admin/fix-password`
3. Notify user of new password

### If Session Not Persisting
1. Check if session token is being stored (check SecureStore)
2. Check if token is being sent in Authorization header
3. Check backend logs for session validation

## Contact

If issues persist after backend deployment:
1. Share backend logs (`get_backend_logs()`)
2. Share frontend logs (from app console)
3. Share specific error messages
4. Share steps to reproduce

---

**Status Check Command:**
```
get_backend_status()
```

**When `state: "idle"`, the fix is deployed and ready to test!**
