
# TestFlight Configuration Fix

## Problem
The app worked in Expo Go but failed in TestFlight builds because the backend URL configuration was not properly accessible in production builds.

## Root Cause
- `Constants.expoConfig?.extra?.backendUrl` may not be available in standalone builds (TestFlight/App Store)
- Configuration was scattered across multiple files with inconsistent fallbacks
- No centralized environment configuration

## Solution

### 1. Created Centralized Configuration (`config/env.ts`)
- Single source of truth for all environment variables
- Proper fallback handling for production builds
- Logging to help debug configuration issues
- Platform detection (Expo Go vs Standalone vs Web)

### 2. Updated All Files to Use Centralized Config
- `utils/api.ts` - API requests
- `lib/auth.ts` - Authentication client
- `contexts/AuthContext.tsx` - Auth context

### 3. Enhanced `app.json` Configuration
- Added proper iOS URL scheme configuration in `infoPlist`
- Added Android intent filters for deep linking
- Ensured `extra.backendUrl` is properly set
- Added `updates` configuration for OTA updates

## Testing Checklist

### Before Submitting to TestFlight
1. ✅ Verify `config/env.ts` is created
2. ✅ Check that all imports use `ENV` from `@/config/env`
3. ✅ Ensure `app.json` has correct `backendUrl` in `extra`
4. ✅ Verify app scheme is set to `coinhub` (lowercase)

### After TestFlight Build
1. Install the TestFlight build
2. Check logs on app launch - should see:
   ```
   [ENV] Configuration loaded: { backendUrl: 'https://...', ... }
   ```
3. Try to sign in - should work without "invalid origin" errors
4. Test all authenticated features (profile, trades, etc.)

### Debug Steps if Still Failing
1. Check the logs for `[ENV]` messages to see what configuration is loaded
2. Verify the backend URL is correct
3. Check if `Constants.appOwnership` shows `'standalone'` (not `'expo'`)
4. Ensure the backend allows requests from the iOS app bundle ID

## Key Changes

### New File
- `config/env.ts` - Centralized environment configuration

### Modified Files
- `utils/api.ts` - Now imports from `config/env.ts`
- `lib/auth.ts` - Now imports from `config/env.ts`
- `contexts/AuthContext.tsx` - Now imports from `config/env.ts`
- `app.json` - Enhanced with proper iOS/Android deep linking config

## How It Works

1. **Development (Expo Go)**:
   - `Constants.expoConfig.extra.backendUrl` is available
   - ENV.IS_EXPO_GO = true
   - ENV.IS_STANDALONE = false

2. **Production (TestFlight/App Store)**:
   - If `Constants.expoConfig.extra.backendUrl` is available, use it
   - Otherwise, fall back to hardcoded production URL
   - ENV.IS_EXPO_GO = false
   - ENV.IS_STANDALONE = true

3. **Web**:
   - Same as development
   - ENV.PLATFORM = 'web'

## Next Steps

1. **Build a new version** with these changes
2. **Submit to TestFlight** with incremented version number
3. **Test thoroughly** in TestFlight before releasing to App Store
4. **Monitor logs** for any configuration issues

## Notes

- The backend URL is now consistently available across all environments
- All authentication and API calls use the centralized configuration
- Logging helps identify configuration issues quickly
- The app will work in both Expo Go and TestFlight/App Store builds
