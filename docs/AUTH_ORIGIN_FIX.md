
# Authentication Origin Error Fix

## Problem
The app was showing "Authentication error: Invalid origin detected" when trying to sign in on iOS/TestFlight builds. The backend logs showed `403` responses for `/api/auth/sign-in/email` requests.

## Root Cause
The Better Auth library on the backend validates the `Origin` and `Referer` headers against the configured `baseURL`. For native mobile apps (iOS/Android), these headers are not automatically set by the browser (since there is no browser), causing Better Auth to reject the requests with a 403 status.

## Solution
Updated `lib/auth.ts` to explicitly set `Origin` and `Referer` headers for native builds (iOS/Android/TestFlight):

### Changes Made

1. **Added headers to `fetchOptions`**: Set `Origin` and `Referer` headers in the `createAuthClient` configuration for native platforms.

2. **Updated custom fetch function**: Ensured the custom fetch function also sets these headers for all requests on native platforms.

### Code Changes

```typescript
// CRITICAL: For native builds (iOS/Android/TestFlight), we must set Origin and Referer headers
// to the backend URL to prevent "Invalid origin" errors from Better Auth
const isNative = Platform.OS !== "web";
const authHeaders: Record<string, string> = {
  "X-App-Type": ENV.APP_TYPE,
  "X-Platform": Platform.OS,
};

// Add Origin and Referer headers for native builds ONLY
if (isNative) {
  authHeaders["Origin"] = API_URL;
  authHeaders["Referer"] = API_URL;
}

export const authClient = createAuthClient({
  baseURL: `${API_URL}/api/auth`,
  plugins: [
    expoClient({
      scheme: APP_SCHEME,
      storagePrefix: APP_SCHEME,
      storage,
    }),
  ],
  fetchOptions: {
    credentials: "omit",
    headers: authHeaders, // Now includes Origin and Referer for native
  },
  fetch: async (url: string | URL | Request, options?: RequestInit) => {
    const headers = new Headers(options?.headers);
    
    // Always add platform identification headers
    headers.set("X-App-Type", ENV.APP_TYPE);
    headers.set("X-Platform", Platform.OS);
    
    // Add Origin and Referer for native builds
    if (isNative) {
      headers.set("Origin", API_URL);
      headers.set("Referer", API_URL);
    }
    
    return fetch(url, {
      ...options,
      headers,
      credentials: "omit",
    });
  },
});
```

## Why This Works

1. **Better Auth Validation**: Better Auth validates that the `Origin` header matches the configured `baseURL`. By explicitly setting these headers to the backend URL, we satisfy this validation.

2. **Native vs Web**: On web, browsers automatically set `Origin` and `Referer` headers. On native mobile apps, we must set them manually.

3. **Backend Compatibility**: The backend already has extensive middleware to handle mobile apps (see `backend/src/index.ts`), but it expects these headers to be present.

## Testing

To verify the fix:

1. Build a new TestFlight/production build
2. Try to sign in with email/password
3. The sign-in should now succeed without the "Invalid origin" error

## Related Files

- `lib/auth.ts` - Main authentication client configuration (FIXED)
- `utils/api.ts` - API helper functions (already correct)
- `config/env.ts` - Environment configuration (already correct)
- `backend/src/index.ts` - Backend middleware for mobile apps (already correct)

## Notes

- This fix only affects native builds (iOS/Android/TestFlight)
- Web builds continue to work as before (browsers handle headers automatically)
- The backend already had the necessary middleware to accept these headers
- The issue was purely on the frontend side (missing headers)
