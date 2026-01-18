# Bug Fix: "Reply Was Already Sent" Error on Public Endpoints

## Issue Summary

Several public endpoints were returning 401 errors before sending their actual data, causing "Reply was already sent" errors. This happened because the endpoints were calling `app.requireAuth()(request, reply)` inside try-catch blocks on public endpoints that don't require authentication.

## Root Cause

The `app.requireAuth()` middleware function:
1. Attempts to validate the session
2. If no valid session found, calls `reply.status(401).send(...)`
3. Returns the error response

Even though the call was wrapped in a try-catch, the side effect (sending the 401 response) already happened. When the endpoint then tried to return the actual data with `return { ... }`, Fastify threw an error because the response had already been sent.

```
GET /api/coins/123
  ↓
Try to call requireAuth() (which sends 401 response to client)
  ↓
Exception caught (but response already sent!)
  ↓
Try to return coin data (FAILS - "Reply was already sent")
```

## Affected Endpoints

### 1. GET /api/users/:username (profiles.ts)
- **Issue**: Called `app.requireAuth()(request, reply)` on line 172
- **Impact**: Returned 401 before returning profile data
- **Fix**: Use `extractSessionToken()` instead for optional authentication

### 2. GET /api/coins/:id (coins.ts)
- **Issue**: Called `app.requireAuth()(request, reply)` on line 142
- **Impact**: Returned 401 before returning coin details
- **Fix**: Use `extractSessionToken()` instead for optional authentication

### 3. GET /api/coins (coins.ts)
- **Issue**: Called `app.requireAuth()(request, reply)` on line 382
- **Impact**: Returned 401 before returning coin list
- **Fix**: Use `extractSessionToken()` instead for optional authentication

### 4. GET /api/users/:id/coins (coins.ts)
- **Issue**: Called `app.requireAuth()(request, reply)` on line 511
- **Impact**: Returned 401 before returning user's coins
- **Fix**: Use `extractSessionToken()` instead for optional authentication

## Solution Applied

Replaced all instances of:
```typescript
let session: any = null;
try {
  session = await app.requireAuth()(request, reply);
} catch {
  // Not authenticated
}

// Use session?.user.id for checks
```

With:
```typescript
let currentUserId: string | null = null;
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
  // Not authenticated
}

// Use currentUserId for checks
```

## Key Differences

| Aspect | Old Approach | New Approach |
|--------|--------------|--------------|
| Response Sent on Failure | ✗ Yes (causes error) | ✓ No (returns null) |
| Throws Exception | ✗ Yes (even in catch) | ✓ No (silently fails) |
| Allows Endpoint to Continue | ✗ No (response already sent) | ✓ Yes (response still available) |
| Works on Public Endpoints | ✗ No | ✓ Yes |
| Optional Authentication | ✗ No (forces 401) | ✓ Yes (gracefully handles missing auth) |

## Files Modified

| File | Changes |
|------|---------|
| `src/routes/profiles.ts` | Fixed GET /api/users/:username (line 168-195) |
| `src/routes/coins.ts` | Fixed 3 endpoints (GET /api/coins, GET /api/coins/:id, GET /api/users/:id/coins) |
| `src/routes/coins.ts` | Added imports for `authSchema` and `extractSessionToken` |

## Testing

### Before Fix
```bash
$ curl https://api.example.com/api/coins/123

# Response: 401 Unauthorized
# Logs: "Coin fetched successfully" + "Reply was already sent"
```

### After Fix
```bash
$ curl https://api.example.com/api/coins/123

# Response: 200 OK with coin data
# Logs: "Coin fetched successfully"
```

## Pattern for Public Endpoints with Optional Authentication

This is the recommended pattern for any public endpoint that optionally checks authentication:

```typescript
app.fastify.get('/api/public-resource/:id', async (request, reply) => {
  try {
    // Fetch the resource
    const resource = await db.query.resource.findFirst({
      where: eq(schema.resource.id, id)
    });

    if (!resource) {
      return reply.status(404).send({ error: 'Not found' });
    }

    // Optional: Get current user if authenticated
    let currentUserId: string | null = null;
    try {
      const sessionToken = extractSessionToken(request);
      if (sessionToken) {
        const sessionRecord = await db.query.session.findFirst({
          where: eq(authSchema.session.token, sessionToken)
        });

        if (sessionRecord && new Date(sessionRecord.expiresAt) > new Date()) {
          const userRecord = await db.query.user.findFirst({
            where: eq(authSchema.user.id, sessionRecord.userId)
          });
          if (userRecord) {
            currentUserId = userRecord.id;
          }
        }
      }
    } catch {
      // Not authenticated - that's fine
    }

    // Now return resource, potentially with user-specific data
    return {
      id: resource.id,
      title: resource.title,
      isLikedByCurrentUser: currentUserId ? checkIfLiked(currentUserId) : false
    };
  } catch (error) {
    app.logger.error({ err: error, id }, 'Failed to fetch resource');
    return reply.status(500).send({ error: 'Internal server error' });
  }
});
```

## Why This Matters

### User Experience Impact
- Public endpoints now return data properly
- No more mysterious 401 errors on public resources
- Users can browse profiles and coins without authentication
- Authenticated users get enhanced features (follower status, private coins, etc.)

### Code Quality Impact
- Clearer separation between required and optional authentication
- No side effects from middleware calls
- Better error handling on public endpoints
- Consistent use of `extractSessionToken()` pattern

## Related Issues

This fix complements the React Native authentication support by:
1. Using the same `extractSessionToken()` function across all endpoints
2. Supporting both cookie-based and Authorization header authentication
3. Properly handling missing authentication without side effects

## Prevention

To prevent this issue in the future:
- ✅ Use `extractSessionToken()` for optional authentication
- ✅ Always return early with `return reply.status(401).send(...)` for required auth
- ✗ Never call `requireAuth()` in a try-catch on a public endpoint
- ✗ Never rely on middleware side effects if response still needs to be sent

## Verification

All affected endpoints now:
- ✅ Return data successfully (200)
- ✅ Don't send 401 before returning data
- ✅ Support both authenticated and unauthenticated access
- ✅ Log operations correctly
- ✅ Generate signed URLs where needed
- ✅ Handle errors gracefully
