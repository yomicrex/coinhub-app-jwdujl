
# Android Build Quick Start

## 🚀 Build Commands

### Development (for testing in emulator/device)
```bash
eas build --profile development --platform android
```

### Preview (APK for beta testing)
```bash
eas build --profile preview --platform android
```

### Production (AAB for Play Store)
```bash
eas build --profile production --platform android
```

### Production APK (for direct distribution)
```bash
eas build --profile android-apk --platform android
```

## 📱 Local Development

### Run in Android Emulator
```bash
npm run android
```

### Run with Tunnel (for testing on physical device)
```bash
npm run dev
```
Then scan QR code with Expo Go app

## ✅ Configuration Verified

- **Package**: `com.coinhub.app` ✅
- **Version Code**: `11` (auto-increments) ✅
- **Permissions**: Camera, Storage, Internet ✅
- **Deep Linking**: `CoinHub://` scheme ✅
- **Auth**: Platform-aware (no iOS-only code) ✅

## 🔍 Testing Checklist

After building, verify:
- [ ] Login works
- [ ] Session persists
- [ ] Camera access works
- [ ] Image upload works
- [ ] Navigation works
- [ ] No crashes

## 📦 Build Artifacts

- **APK**: Direct install on devices
- **AAB**: For Play Store submission

## 🛠️ Troubleshooting

### Build fails?
Check EAS dashboard for logs

### App crashes?
Run: `adb logcat | grep CoinHub`

### Auth not working?
Verify backend URL in `app.json`

## 📚 Full Documentation

See `docs/ANDROID_BUILD_GUIDE.md` for complete details.
