
# TestFlight Debug Guide - "Invalid Origin" Fix

## Quick Start

### 1. Access Debug Panel
- **Login Screen:** Tap the "Debug" button (top-right corner with bug icon)
- **Settings Screen:** Go to Settings → Developer Tools → Auth Debug Panel

### 2. What to Check

#### Environment Info (Top Section)
```
Backend URL: https://qjj7hh75bj9rj8tez54zsh74jpn3wv24.app.specular.dev
Platform: ios
Build Type: Standalone (TestFlight/App Store)
App Version: 1.0.0
```

✅ **Expected:** Build Type should show "Standalone (TestFlight/App Store)"
❌ **Problem:** If it shows "Expo Go", you're not testing the right build

#### Recent Logs (Bottom Section)
Look for these log types:
- 🔵 **REQUEST** (blue): Outgoing API request
- 🟢 **RESPONSE** (green): Successful API response
- 🔴 **ERROR** (red): Failed request or error
- 🟡 **INFO** (yellow): General information

### 3. Test Login

1. Close debug panel
2. Enter email and password
3. Tap "Sign In"
4. If login fails, immediately open debug panel
5. Look for the most recent logs

#### What to Look For:

**Successful Login:**
```
REQUEST → POST /api/auth/sign-in
  Status: 200
  Headers: Authorization: Bearer abc123...
  
RESPONSE → POST /api/auth/sign-in
  Status: 200
  Body: {"user":{"id":"...","email":"..."}}
```

**Failed Login (Invalid Origin):**
```
ERROR → POST /api/auth/sign-in
  Status: 400 or 403
  Error: invalid origin
  Body: {"error":"invalid origin"}
```

### 4. Copy Debug Report

1. Tap "Copy Debug Report" button
2. Paste into Notes app or email
3. Send to development team

The report includes:
- Environment configuration
- All recent authentication logs
- Request/response details
- Error messages

## Common Issues & Solutions

### Issue 1: "Invalid Origin" Error

**Symptoms:**
- Login works in Expo Go
- Login fails in TestFlight
- Debug logs show "invalid origin" error

**Solution:**
- This should be fixed in the latest build
- If still occurring, copy debug report and send to dev team
- Backend needs to accept requests without Origin header

### Issue 2: No Authorization Header

**Symptoms:**
- Debug logs show requests without Authorization header
- Status 401 (Unauthorized) errors

**Solution:**
- Token extraction is failing
- Check if you're signed in
- Try signing out and signing in again

### Issue 3: Wrong Backend URL

**Symptoms:**
- Environment shows wrong backend URL
- Requests timeout or fail immediately

**Solution:**
- Check `app.json` → `extra.backendUrl`
- Rebuild the app with correct URL

### Issue 4: Requests Not Reaching Backend

**Symptoms:**
- No response logs in debug panel
- Requests seem to hang

**Solution:**
- Check internet connection
- Check if backend is running (visit URL in browser)
- Check firewall/VPN settings

## Testing Checklist

Use this checklist to verify the fix:

- [ ] Install latest TestFlight build
- [ ] Open debug panel and verify environment
- [ ] Attempt login #1 - Success?
- [ ] Close app completely
- [ ] Reopen app and attempt login #2 - Success?
- [ ] Repeat 8 more times (total 10 logins)
- [ ] All 10 logins successful?
- [ ] No "invalid origin" errors in debug logs?
- [ ] Copy debug report for records

## Debug Log Examples

### Example 1: Successful Login Flow

```
[1] 2026-01-30T21:45:00.000Z
Type: INFO
Endpoint: /api/auth/sign-in
Message: Sign in attempt for email: user@example.com

[2] 2026-01-30T21:45:01.000Z
Type: REQUEST
Endpoint: https://...app.specular.dev/api/auth/sign-in
Method: POST
Headers:
  Authorization: Bearer (none - not signed in yet)
  X-Platform: ios
  X-App-Type: standalone

[3] 2026-01-30T21:45:02.000Z
Type: RESPONSE
Endpoint: https://...app.specular.dev/api/auth/sign-in
Method: POST
Status: 200
Body: {"user":{"id":"abc123","email":"user@example.com"}}

[4] 2026-01-30T21:45:03.000Z
Type: INFO
Endpoint: getSessionToken
Message: Token extracted successfully (length: 128)

[5] 2026-01-30T21:45:04.000Z
Type: REQUEST
Endpoint: https://...app.specular.dev/api/auth/me
Method: GET
Headers:
  Authorization: Bearer abc123...
  X-Platform: ios
  X-App-Type: standalone

[6] 2026-01-30T21:45:05.000Z
Type: RESPONSE
Endpoint: https://...app.specular.dev/api/auth/me
Method: GET
Status: 200
Body: {"id":"abc123","email":"user@example.com","hasProfile":true}
```

### Example 2: Failed Login (Invalid Origin)

```
[1] 2026-01-30T21:45:00.000Z
Type: INFO
Endpoint: /api/auth/sign-in
Message: Sign in attempt for email: user@example.com

[2] 2026-01-30T21:45:01.000Z
Type: REQUEST
Endpoint: https://...app.specular.dev/api/auth/sign-in
Method: POST
Headers:
  X-Platform: ios
  X-App-Type: standalone

[3] 2026-01-30T21:45:02.000Z
Type: ERROR
Endpoint: https://...app.specular.dev/api/auth/sign-in
Method: POST
Status: 403
Error: Request failed with status 403
Body: {"error":"invalid origin","message":"Origin header is required"}
```

## Reporting Issues

When reporting issues, include:

1. **Debug Report** (from "Copy Debug Report" button)
2. **Steps to Reproduce:**
   - What you did
   - What you expected
   - What actually happened
3. **Environment:**
   - TestFlight build number
   - iOS version
   - Device model
4. **Screenshots** (if applicable)

Send to: support@coinhub.app

## FAQ

**Q: Why is there a debug button on the login screen?**
A: It's only visible in development and TestFlight builds to help diagnose issues. It won't appear in the App Store version.

**Q: What does "credentials: omit" mean?**
A: It means the app doesn't send cookies with requests. Mobile apps use Bearer tokens instead.

**Q: Why don't mobile apps send Origin headers?**
A: Origin headers are a browser security feature. Native mobile apps aren't websites, so they don't have an origin.

**Q: Is it safe to copy the debug report?**
A: Yes, but be careful. It contains your session token (truncated) and email address. Don't share publicly.

**Q: How long are logs stored?**
A: Only the most recent 100 logs are kept in memory. They're cleared when you close the app.

**Q: Can I clear the logs?**
A: Yes, tap "Clear Logs" in the debug panel.

## Next Steps

After testing in TestFlight:
1. If all logins succeed → Ready for App Store
2. If "invalid origin" still occurs → Send debug report to dev team
3. If other errors occur → Check FAQ and common issues above

---

**Last Updated:** January 30, 2026
**Build Version:** 10+
**Status:** Testing in TestFlight
