
# Admin Tools Quick Reference 🔧

**Access:** Development builds only via AuthDebugPanel  
**Location:** `components/AuthDebugPanel.tsx`

---

## 🚀 Quick Start

### Opening AuthDebugPanel
1. Run app in development mode (`__DEV__ === true`)
2. Navigate to Profile or Settings screen
3. Look for "Debug" or "Auth Debug" button (if implemented)
4. Or add a button to trigger: `<AuthDebugPanel visible={true} onClose={() => {}} />`

---

## 🛠️ Admin Tools

### 1️⃣ Check Account Status

**Purpose:** Diagnose if an account has a corrupted password hash

**Steps:**
1. Tap "Check Account" button
2. Enter email address (e.g., `user4@gmail.com`)
3. Tap "Check"

**Result:**
```
✅ Account Check Result:

Email: user4@gmail.com

Exists: ✅ Yes
Has Valid Password Hash: ❌ No
Provider ID: credential

⚠️ Password hash is INVALID! Use "Fix Password" to repair this account.
```

**API Endpoint:** `GET /api/admin/check-account/:email`

---

### 2️⃣ Fix Password Hash

**Purpose:** Repair a corrupted password hash for an existing account

**Steps:**
1. Tap "Fix Password" button
2. Enter email address (e.g., `user4@gmail.com`)
3. Enter new password (e.g., `NewSecurePassword123!`)
4. Tap "Fix Password"

**Result:**
```
✅ Password Fixed Successfully!

Email: user4@gmail.com

Password has been reset and properly hashed.

You can now sign in with the new password.
```

**API Endpoint:** `POST /api/admin/fix-password`

**Request Body:**
```json
{
  "email": "user4@gmail.com",
  "newPassword": "NewSecurePassword123!"
}
```

**Important Notes:**
- This will REPLACE the user's password
- User must use the NEW password to sign in
- Inform the user of their new password via secure channel

---

### 3️⃣ Create Test User

**Purpose:** Generate a test user with proper password hashing

**Steps:**
1. Tap "Create Test User" button
2. Tap "Create User"

**Result:**
```
✅ Test User Created!

Email: testuser_1738512345@test.com
Password: TestPassword123!
User ID: abc123def456...

Test user created successfully with proper password hashing.

You can now sign in with these credentials.
```

**API Endpoint:** `POST /api/admin/create-test-user`

**Important Notes:**
- Email format: `testuser_[timestamp]@test.com`
- Password is randomly generated
- Save the credentials immediately - they won't be shown again
- Use these credentials to test authentication flows

---

## 📋 Common Workflows

### Workflow 1: Fix a Broken Account

**Scenario:** User reports "invalid password hash format" error

**Steps:**
1. **Check Account Status**
   - Open AuthDebugPanel
   - Tap "Check Account"
   - Enter user's email
   - Confirm password hash is invalid

2. **Fix Password**
   - Tap "Fix Password"
   - Enter user's email
   - Enter a temporary password (e.g., `TempPassword123!`)
   - Tap "Fix Password"

3. **Notify User**
   - Contact user via email/support
   - Provide temporary password
   - Instruct them to change password after signing in

4. **Verify Fix**
   - User signs in with temporary password
   - User changes password in Settings
   - Confirm new password works

---

### Workflow 2: Test Authentication Flow

**Scenario:** Need to test signup/signin with a fresh account

**Steps:**
1. **Create Test User**
   - Open AuthDebugPanel
   - Tap "Create Test User"
   - Save the generated credentials

2. **Test Sign In**
   - Sign out of current account
   - Go to auth screen
   - Enter test user credentials
   - Verify successful sign in

3. **Test Features**
   - Complete profile setup
   - Test protected endpoints
   - Verify session persistence

4. **Clean Up** (Optional)
   - Delete test user from database
   - Or keep for future testing

---

### Workflow 3: Diagnose Multiple Accounts

**Scenario:** Multiple users report login issues

**Steps:**
1. **Check Each Account**
   - Open AuthDebugPanel
   - For each affected email:
     - Tap "Check Account"
     - Enter email
     - Note if password hash is valid

2. **Identify Pattern**
   - Are all accounts created on the same date?
   - Do they all have invalid password hashes?
   - Are they all using email/password (not OAuth)?

3. **Batch Fix** (Manual)
   - For each affected account:
     - Use "Fix Password" tool
     - Generate secure temporary password
     - Document in spreadsheet

4. **Notify Users**
   - Send bulk email with instructions
   - Provide temporary passwords securely
   - Guide users to change password

---

## 🔒 Security Best Practices

### DO ✅
- Use admin tools only in development builds
- Generate strong temporary passwords
- Notify users immediately after fixing their password
- Document all password fixes
- Use secure channels to share temporary passwords

### DON'T ❌
- Don't expose admin tools in production builds
- Don't share temporary passwords via insecure channels
- Don't reuse temporary passwords
- Don't fix passwords without user consent
- Don't leave admin endpoints unprotected in production

---

## 🐛 Troubleshooting

### Issue: Admin tools not visible
**Solution:** Ensure you're running in development mode (`__DEV__ === true`)

### Issue: "Endpoint not found" error
**Solution:** Verify backend is deployed with latest changes

### Issue: "Fix Password" fails
**Solution:** 
- Check if account exists first using "Check Account"
- Verify email is correct (case-insensitive)
- Check backend logs for detailed error

### Issue: Test user creation fails
**Solution:**
- Check backend logs
- Verify database connection
- Ensure no duplicate email conflicts

---

## 📞 Support

**For Admin Tool Issues:**
- Check backend logs: Look for `/api/admin/*` requests
- Verify backend deployment: Use "Test Version" in AuthDebugPanel
- Contact backend team if endpoints are not responding

**For User Account Issues:**
- Use "Check Account" to diagnose
- Use "Fix Password" to repair
- Document all fixes for audit trail

---

## 🎯 Quick Commands

```bash
# Check account status
curl -X GET "https://qjj7hh75bj9rj8tez54zsh74jpn3wv24.app.specular.dev/api/admin/check-account/user4@gmail.com"

# Fix password
curl -X POST "https://qjj7hh75bj9rj8tez54zsh74jpn3wv24.app.specular.dev/api/admin/fix-password" \
  -H "Content-Type: application/json" \
  -d '{"email":"user4@gmail.com","newPassword":"NewPassword123!"}'

# Create test user
curl -X POST "https://qjj7hh75bj9rj8tez54zsh74jpn3wv24.app.specular.dev/api/admin/create-test-user"
```

---

**Last Updated:** 2026-02-02  
**Version:** 1.0  
**Status:** ✅ Active
