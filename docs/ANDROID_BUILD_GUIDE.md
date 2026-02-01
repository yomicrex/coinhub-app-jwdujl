
# Android Build Guide for CoinHub

## Overview
This guide covers building CoinHub for Android without modifying any existing iOS/auth logic.

## Prerequisites
- EAS CLI installed: `npm install -g eas-cli`
- EAS account configured: `eas login`
- Project configured: `eas build:configure`

## Android Configuration Summary

### Package & Version
- **Package Name**: `com.coinhub.app` (matches iOS bundle identifier)
- **Version Code**: `11` (auto-increments with each build)
- **Version Name**: `1.0.11`

### Permissions
The app requests the following Android permissions:
- `CAMERA` - For taking photos of coins
- `READ_EXTERNAL_STORAGE` - For selecting photos from gallery
- `WRITE_EXTERNAL_STORAGE` - For saving photos
- `READ_MEDIA_IMAGES` - For Android 13+ photo access
- `INTERNET` - For API communication
- `ACCESS_NETWORK_STATE` - For network status checks

### Deep Linking
Configured schemes:
- `coinhub://` - Custom scheme
- `CoinHub://` - Alternative custom scheme
- `https://coinhub.app` - Universal links (when domain is configured)

## Build Commands

### 1. Development Build (APK for testing)
```bash
eas build --profile development --platform android
```
- Creates a development APK
- Includes dev tools and debugging
- Can be installed on any Android device
- Suitable for internal testing

### 2. Preview Build (APK for wider testing)
```bash
eas build --profile preview --platform android
```
- Creates a release APK
- Optimized but still installable via APK
- Good for beta testing
- Can be distributed via direct download

### 3. Production Build (AAB for Play Store)
```bash
eas build --profile production --platform android
```
- Creates an Android App Bundle (AAB)
- Required for Play Store submission
- Optimized for distribution
- Includes all architectures

### 4. Production APK (for direct distribution)
```bash
eas build --profile android-apk --platform android
```
- Creates a production-quality APK
- Can be distributed outside Play Store
- Useful for enterprise distribution

## Platform-Specific Code

### Files with Platform Variants
The following files have Android-specific versions:
- `components/IconSymbol.android.tsx` - Uses Material Icons only
- `app/(tabs)/_layout.android.tsx` - Uses standard Expo tabs (not iOS native tabs)

### Platform Detection
The app uses `Platform.OS` checks throughout:
```typescript
if (Platform.OS === 'android') {
  // Android-specific code
}
```

### Auth Configuration
The auth system is platform-aware:
- Uses `SecureStore` for token storage on Android
- Sends proper platform headers: `X-Platform: android`
- Handles deep linking for OAuth callbacks

## Testing on Android

### Local Testing (Emulator)
```bash
npm run android
```
- Runs in Android emulator
- Hot reload enabled
- Good for development

### Testing APK on Physical Device
1. Build APK: `eas build --profile preview --platform android`
2. Download APK from EAS dashboard
3. Transfer to device or use direct download link
4. Enable "Install from Unknown Sources" in device settings
5. Install APK

### Testing Features
Verify the following work correctly on Android:
- ✅ Login/signup with email
- ✅ Session persistence (stays logged in after app restart)
- ✅ Camera access for coin photos
- ✅ Gallery access for selecting photos
- ✅ Image upload to backend
- ✅ Navigation between screens
- ✅ Deep linking (if configured)
- ✅ Push notifications (if configured)

## Known Android-Specific Considerations

### 1. Icon Names
- Android uses Material Icons, not SF Symbols
- Invalid icon names show as "?" on Android
- All icons use `android_material_icon_name` prop

### 2. Storage Permissions
- Android 13+ uses scoped storage
- `READ_MEDIA_IMAGES` permission required for photo access
- Legacy permissions included for older Android versions

### 3. Deep Linking
- Requires intent filters in `app.json`
- OAuth callbacks use custom scheme: `CoinHub://`
- Universal links require domain verification

### 4. Network Security
- Backend URL uses HTTPS (required for production)
- Clear text traffic disabled by default
- Certificate pinning not implemented (can be added if needed)

## Build Artifacts

### APK (Android Package)
- File extension: `.apk`
- Can be installed directly on devices
- Suitable for testing and direct distribution
- Larger file size (includes all architectures)

### AAB (Android App Bundle)
- File extension: `.aab`
- Required for Play Store
- Google Play generates optimized APKs per device
- Smaller download size for users

## Troubleshooting

### Build Fails
1. Check EAS dashboard for detailed logs
2. Verify `app.json` is valid JSON
3. Ensure package name is unique
4. Check for conflicting dependencies

### App Crashes on Launch
1. Check Android logs: `adb logcat`
2. Verify all permissions are granted
3. Check for missing native modules
4. Ensure backend URL is accessible

### Auth Not Working
1. Verify backend URL in `app.json` extra config
2. Check network connectivity
3. Verify session token storage (SecureStore)
4. Check backend logs for auth errors

### Images Not Loading
1. Verify INTERNET permission is granted
2. Check image URLs are HTTPS
3. Verify backend CORS settings
4. Check network security config

## Next Steps

### For Testing
1. Build preview APK
2. Distribute to testers
3. Collect feedback
4. Iterate on issues

### For Production
1. Build production AAB
2. Create Play Store listing
3. Upload AAB to Play Console
4. Submit for review
5. Release to production

## Important Notes

### DO NOT MODIFY
The following were explicitly kept unchanged per requirements:
- ✅ All `/api/auth/*` logic (except Android compatibility guards)
- ✅ Better Auth configuration
- ✅ Backend URL and trusted origins
- ✅ Request header behavior for iOS/TestFlight
- ✅ iOS bundle identifier and build settings
- ✅ Existing auth endpoints

### ONLY MODIFIED
- ✅ Android package name (verified: `com.coinhub.app`)
- ✅ Android permissions for camera, storage, network
- ✅ Android intent filters for deep linking
- ✅ Platform-specific component files (`.android.tsx`)
- ✅ EAS build configuration for Android

## Verification Checklist

Before submitting to Play Store:
- [ ] App builds successfully
- [ ] Login/signup works
- [ ] Session persists after app restart
- [ ] Camera and gallery access work
- [ ] Images upload successfully
- [ ] All screens navigate correctly
- [ ] No crashes or errors in logs
- [ ] Icons display correctly (no "?")
- [ ] Deep linking works (if configured)
- [ ] App follows Material Design guidelines
- [ ] Privacy policy and terms are accessible
- [ ] App complies with Play Store policies

## Support

For issues or questions:
1. Check EAS build logs
2. Review Android logcat output
3. Verify backend connectivity
4. Check this documentation
5. Contact development team
