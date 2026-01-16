# CoinHub Authentication & User Profile Flow

## Overview

The CoinHub backend implements a complete two-step authentication and profile completion flow using Better Auth for account management and custom endpoints for CoinHub-specific profile data.

## Authentication Architecture

### Technology Stack
- **Authentication Provider**: Better Auth (Framework-integrated)
- **Session Management**: Automatic via Better Auth
- **Password Hashing**: Better Auth handles all password security
- **Token Management**: Session-based authentication with automatic cookies

## User Data Model

### Users Table
Stores CoinHub-specific user profile information

| Column | Type | Constraints | Default |
|--------|------|-------------|---------|
| id | text | PRIMARY KEY | - |
| email | text | NOT NULL, UNIQUE | - |
| username | text | NOT NULL, UNIQUE | - |
| displayName | text | NOT NULL | - |
| avatarUrl | text | NULLABLE | NULL |
| bio | text | NULLABLE | NULL |
| location | text | NULLABLE | NULL |
| collectionPrivacy | enum | NOT NULL | 'public' |
| role | enum | NOT NULL | 'user' |
| inviteCodeUsed | text | NULLABLE | NULL |
| createdAt | timestamp | NOT NULL | NOW() |
| updatedAt | timestamp | NOT NULL | NOW() |

**Indices**:
- idx_user_email on email
- idx_user_username on username
- idx_user_role on role

**Enum Values**:
- collectionPrivacy: 'public', 'private'
- role: 'user', 'moderator', 'admin'

### Invite Codes Table
Manages invite codes for registration access control

| Column | Type | Constraints | Default |
|--------|------|-------------|---------|
| id | uuid | PRIMARY KEY | AUTO |
| code | text | NOT NULL, UNIQUE | - |
| usageLimit | integer | NULLABLE | NULL (unlimited) |
| usageCount | integer | NOT NULL | 0 |
| expiresAt | timestamp | NULLABLE | NULL |
| createdAt | timestamp | NOT NULL | NOW() |
| isActive | boolean | NOT NULL | true |

**Indices**:
- idx_invite_code on code
- idx_invite_active on isActive

## Authentication Flow

### Step 1: Account Creation (Better Auth)

Better Auth provides automated sign-up endpoint:

```
POST /api/auth/sign-up/email
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securePassword123!",
  "name": "John Doe"
}
```

**Response** (200 OK):
```json
{
  "user": {
    "id": "user-id-generated-by-better-auth",
    "email": "user@example.com",
    "name": "John Doe",
    "emailVerified": false,
    "image": null
  },
  "session": {
    "id": "session-id",
    "token": "session-token",
    "expiresAt": "2024-02-15T10:30:00Z"
  }
}
```

**Error Responses**:
- 400: Email already exists, invalid password format
- 500: Server error during registration

### Step 2: Profile Completion (CoinHub Custom)

After account creation, users must complete their CoinHub profile.

```
POST /api/auth/complete-profile
Content-Type: application/json
Authorization: Bearer <session-token>

{
  "username": "johncollector",
  "displayName": "John Collector",
  "inviteCode": "BETA2026",
  "bio": "Collecting coins since 2010",
  "location": "New York, USA"
}
```

**Field Requirements**:
- **username** (required): 3-30 characters, must be unique, alphanumeric recommended
- **displayName** (required): 1-100 characters, can include spaces and special characters
- **inviteCode** (optional): Valid, active, non-expired invite code with available usage
- **bio** (optional): 0-500 characters
- **location** (optional): 0-100 characters
- **avatarUrl** (optional): URL to profile picture (typically set via separate image upload)

**Response** (200 OK):
```json
{
  "id": "user-id",
  "email": "user@example.com",
  "username": "johncollector",
  "displayName": "John Collector",
  "avatarUrl": null,
  "bio": "Collecting coins since 2010",
  "location": "New York, USA",
  "collectionPrivacy": "public",
  "role": "user",
  "inviteCodeUsed": "BETA2026",
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

**Error Responses**:
- 400: Username already taken, invalid invite code, invite code expired, usage limit reached
- 401: Not authenticated
- 503: Database error

**Side Effects**:
- Invite code usage count is incremented
- User record is created in CoinHub users table
- User can now access all authenticated endpoints

## User Endpoints

### GET /api/auth/me
Retrieve authenticated user's profile

**Authentication**: Required (session must be valid)

**Response** (200 OK):
```json
{
  "user": {
    "id": "user-id",
    "email": "user@example.com",
    "name": "John Doe",
    "emailVerified": false,
    "image": null
  },
  "profile": {
    "id": "user-id",
    "email": "user@example.com",
    "username": "johncollector",
    "displayName": "John Collector",
    "avatarUrl": "https://signed-url-to-avatar.jpg",
    "bio": "Collecting coins since 2010",
    "location": "New York, USA",
    "collectionPrivacy": "public",
    "role": "user",
    "inviteCodeUsed": "BETA2026",
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}
```

**Error Responses**:
- 401: Not authenticated
- 500: Server error

**Notes**:
- Returns both Better Auth user object and CoinHub profile
- Avatar URL is generated as a signed URL for secure temporary access
- Available to authenticated users only

### POST /api/auth/validate-invite
Validate an invite code before registration

**Authentication**: Not required (public endpoint)

**Request**:
```json
{
  "inviteCode": "BETA2026"
}
```

**Response** (200 OK):
```json
{
  "valid": true,
  "message": "Invite code is valid"
}
```

**Error Responses**:
- 400: Invalid code, code expired, usage limit reached
- 500: Server error

### PATCH /api/auth/profile
Update user profile information

**Authentication**: Required

**Request**:
```json
{
  "displayName": "Updated Name",
  "bio": "Updated bio",
  "location": "Updated location",
  "collectionPrivacy": "private"
}
```

**Response** (200 OK):
Returns updated user object with all fields

**Error Responses**:
- 400: Validation error
- 401: Not authenticated
- 500: Server error

## Invite Code System

### Creating Invite Codes

Invite codes must be created by administrators through the database or admin API.

**Example Invite Code**:
```
Code: BETA2026
Usage Limit: 1000 (null = unlimited)
Usage Count: 45 (current)
Expires At: 2026-12-31T23:59:59Z (null = never expires)
Is Active: true
Created At: 2024-01-01T00:00:00Z
```

### Invite Code Validation Rules

An invite code is valid if:
1. **Exists**: Code is in the database
2. **Active**: isActive = true
3. **Not Expired**: expiresAt is null OR expiresAt > current time
4. **Has Usage**: usageLimit is null OR usageCount < usageLimit

When a code is used:
- usageCount is incremented by 1
- inviteCodeUsed field on user record is set to the code
- No duplicate usage validation (same user can use multiple codes if re-registering)

## Protected Routes

All endpoints marked as "Authentication: Required" follow this pattern:

1. Client includes valid session token (typically in cookies)
2. Better Auth middleware validates session
3. If invalid/expired, return 401 Unauthorized
4. If valid, request proceeds with user context

**Session Token Management**:
- Sessions are managed entirely by Better Auth
- Tokens stored in secure cookies
- Automatic renewal on valid activity
- Client doesn't need to manually manage tokens (handled by browser cookies)

## Sign In Flow

Better Auth provides automated sign-in endpoint:

```
POST /api/auth/sign-in/email
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securePassword123!",
  "rememberMe": true
}
```

**Response** (200 OK):
```json
{
  "user": { /* user object */ },
  "session": { /* session object */ }
}
```

**Error Responses**:
- 401: Invalid credentials
- 500: Server error

## Frontend Integration Guide

### Sign Up Flow
```javascript
// Step 1: Create account (Better Auth handles this)
const signUpResponse = await fetch('/api/auth/sign-up/email', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'password123',
    name: 'User Name'
  })
});

// Session cookie is automatically set by the browser
// User is now authenticated

// Step 2: Validate invite code (optional, for UX)
const validateResponse = await fetch('/api/auth/validate-invite', {
  method: 'POST',
  body: JSON.stringify({ inviteCode: 'BETA2026' })
});

// Step 3: Complete profile
const profileResponse = await fetch('/api/auth/complete-profile', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    username: 'johncollector',
    displayName: 'John Collector',
    inviteCode: 'BETA2026'
  })
  // session cookie is sent automatically
});

const userProfile = await profileResponse.json();
```

### Sign In Flow
```javascript
const signInResponse = await fetch('/api/auth/sign-in/email', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'password123'
  })
});

// Session cookie is set, user is authenticated
```

### Access Protected Resources
```javascript
// Fetch protected endpoint - session cookie sent automatically
const meResponse = await fetch('/api/auth/me');
const { user, profile } = await meResponse.json();

// Use profile data to display user info
console.log(profile.username, profile.displayName);
```

## Security Considerations

### Password Security
- Better Auth handles all password hashing with industry-standard algorithms
- Passwords are never stored in plaintext
- Never send passwords in logs or debug output

### Session Security
- Sessions stored in secure, httpOnly cookies
- CSRF protection included
- Sessions auto-expire after inactivity

### Username Uniqueness
- Enforced at database level with unique constraint
- Checked during profile completion
- Case-sensitive usernames

### Invite Code Security
- Expiration dates prevent indefinite code reuse
- Usage limits control code distribution
- Active flag allows immediate deactivation

## Error Handling

All authentication endpoints return appropriate HTTP status codes:

| Status | Meaning | Example |
|--------|---------|---------|
| 200 | Success | Profile created, user fetched |
| 400 | Bad Request | Invalid username, expired code |
| 401 | Unauthorized | Not authenticated |
| 403 | Forbidden | Insufficient permissions |
| 503 | Service Unavailable | Database error |
| 500 | Server Error | Unexpected error |

## Database Schema Integration

The authentication system integrates with:
- **Better Auth Tables**: user, session, verification (auto-managed)
- **CoinHub Tables**: users (custom profile data)
- **Related Tables**: coins, trades, follows (all reference users.id)

## Logging

All authentication operations are logged with:
- User IDs (when available)
- Operation type (signup, signin, profile completion)
- Success/failure status
- Error details for debugging

Example logs:
```
{ userId: 'abc123', username: 'johncollector' } User profile created
{ code: 'BETA2026', newCount: 46 } Invite code used
{ code: 'INVALID' } Invalid invite code
```

## Notes

- Email addresses must be unique across the system
- Usernames must be unique across the system
- Users can only update their own profile
- Once profile is completed, username cannot be changed (frontend responsibility)
- Invite codes are case-insensitive when validated
- Profile images uploaded separately through avatar upload endpoint
