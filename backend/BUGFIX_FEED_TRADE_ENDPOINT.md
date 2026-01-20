# Bug Fix: /api/coins/feed/trade "Reply Was Already Sent" Error

## Issue Summary

The `/api/coins/feed/trade` endpoint was calling `app.requireAuth()` which would send a 401 response when the user was not authenticated. Even though the endpoint was supposed to be public, the middleware was preventing access and causing a "Reply was already sent" error.

## Root Cause

The endpoint code:
```typescript
try {
  const requireAuth = app.requireAuth();
  const session = await requireAuth(request, reply);
  if (session) {
    currentUserId = session.user.id;
  }
} catch {
  // Not authenticated, that's fine - feed is public
}
```

The problem:
1. `app.requireAuth()` middleware attempts to validate session
2. If no session found, it calls `reply.status(401).send(...)` and returns
3. Even though caught in try-catch, the response has already been sent
4. The endpoint then tries to return data, causing "Reply was already sent" error

## Solution Applied

Replaced `app.requireAuth()` with `extractSessionToken()`:

```typescript
try {
  const sessionToken = extractSessionToken(request);
  if (sessionToken) {
    const sessionRecord = await app.db.query.session.findFirst({
      where: eq(authSchema.session.token, sessionToken),
    });

    if (sessionRecord && new Date(sessionRecord.expiresAt) > new Date()) {
      const userRecord = await app.db.query.user.findFirst({
        where: eq(authSchema.user.id, sessionRecord.userId),
      });
      if (userRecord) {
        currentUserId = userRecord.id;
      }
    }
  }
} catch {
  // Not authenticated, that's fine - feed is public
}
```

## Changes Made

### File: `src/routes/feed.ts`

**Imports Added:**
```typescript
import * as authSchema from '../db/auth-schema.js';
import { extractSessionToken } from '../utils/auth-utils.js';
```

**Session Validation Rewritten (Lines 336-350):**
- Removed `app.requireAuth()` call
- Now uses `extractSessionToken()` for optional authentication
- Gracefully handles missing authentication without sending error response
- Maintains support for authenticated users to see `userHasLiked` status

## Endpoint Behavior

### Before Fix
```
GET /api/coins/feed/trade (no session)
  ↓
requireAuth() sends 401 response
  ↓
Endpoint tries to return data
  ↓
ERROR: "Reply was already sent"
```

### After Fix
```
GET /api/coins/feed/trade (no session)
  ↓
extractSessionToken() returns null
  ↓
currentUserId remains null
  ↓
Endpoint returns trade feed data
  ↓
Response 200 with coins list
```

## Endpoint Features

✅ **Public Access** - Anyone can access the trade feed without authentication
✅ **Optional Authentication** - Authenticated users get additional data (userHasLiked status)
✅ **React Native Support** - Works with both cookies and Authorization header
✅ **Pagination** - Supports limit and offset parameters
✅ **Filtering** - Filter by country and year
✅ **Signed URLs** - Generates signed URLs for images and avatars
✅ **Error Handling** - Proper error responses for database errors

## API Usage

### Public Access (No Auth)
```bash
curl https://api.example.com/api/coins/feed/trade
```

Response:
```json
{
  "coins": [
    {
      "id": "coin-uuid",
      "title": "1922 Peace Dollar",
      "country": "United States",
      "year": 1922,
      "condition": "excellent",
      "tradeStatus": "open_to_trade",
      "user": {
        "id": "user-uuid",
        "username": "Numismatist123",
        "displayName": "Coin Collector",
        "avatarUrl": "https://signed-url..."
      },
      "images": [...],
      "likeCount": 5,
      "commentCount": 2,
      "userHasLiked": false,
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T10:30:00Z"
    }
  ],
  "total": 42,
  "limit": 20,
  "offset": 0
}
```

### Authenticated Access (with Session)
```bash
curl https://api.example.com/api/coins/feed/trade \
  -H "Authorization: Bearer session-token"
```

Response includes:
```json
{
  "userHasLiked": true  // Now calculated with authenticated user's ID
}
```

## Query Parameters

| Parameter | Type | Default | Max | Description |
|-----------|------|---------|-----|-------------|
| limit | number | 20 | 100 | Number of coins to return |
| offset | number | 0 | - | Number of coins to skip |
| country | string | - | - | Filter by country |
| year | number | - | - | Filter by year |

## Pattern for Public Endpoints with Optional Auth

This fix demonstrates the correct pattern for public endpoints that optionally use authentication:

```typescript
// ✅ CORRECT - Public endpoint with optional auth
app.fastify.get('/api/public-resource', async (request, reply) => {
  try {
    // Optional: Get current user if authenticated
    let currentUserId: string | null = null;
    try {
      const sessionToken = extractSessionToken(request);
      if (sessionToken) {
        // Validate session manually
        // ... lookup and validate
      }
    } catch {
      // Not authenticated - that's fine
    }

    // Fetch public data
    const resource = await db.query.resource.findMany({
      where: eq(schema.resource.visibility, 'public')
    });

    // Return data (works for both authenticated and unauthenticated)
    return { resource };
  } catch (error) {
    return reply.status(500).send({ error: 'Failed to fetch' });
  }
});

// ✗ WRONG - Calling requireAuth() on public endpoint
app.fastify.get('/api/public-resource', async (request, reply) => {
  try {
    // This will send 401 if not authenticated!
    const session = await app.requireAuth()(request, reply);
    // ... rest of code
  } catch {
    // Too late - response already sent!
  }
});
```

## Verification

✅ Endpoint is now fully public
✅ No authentication required
✅ Optional authentication for enhanced features
✅ No more "Reply was already sent" errors
✅ Supports both web browsers and React Native
✅ Proper error handling for database errors
✅ Consistent with other feed endpoints

## Related Fixes

This fix is part of a series addressing the "Reply was already sent" bug pattern:
- GET /api/users/:username (profiles.ts)
- GET /api/coins/:id (coins.ts)
- GET /api/coins (coins.ts)
- GET /api/users/:id/coins (coins.ts)
- GET /api/coins/feed/trade (feed.ts) ← This fix
