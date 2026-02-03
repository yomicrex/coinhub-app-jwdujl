
# Quick Start - Upload CoinHub to App Store

## Current Status ✅
- ✅ App configuration is ready
- ✅ iOS credentials are configured
- ✅ Backend is connected
- ✅ All dependencies are installed

## What You Need to Do

### 1. One-Time Setup (5 minutes)

Open your terminal in the project folder and run these commands:

```bash
# Install EAS CLI globally (only once ever)
npm install -g eas-cli

# Login to Expo (only once ever)
eas login

# Link this project to your Expo account (only once per project)
eas init
```

When you run `eas init`, it will ask you to select or create a project. Just follow the prompts - it's automatic.

### 2. Build for iOS (20 minutes - mostly waiting)

```bash
eas build --platform ios --profile production
```

This builds your app in the cloud. You can close your terminal and come back later - you'll get an email when it's done.

### 3. Upload to App Store (2 minutes)

```bash
eas submit --platform ios --profile production
```

This automatically uploads to TestFlight using your Apple credentials (already configured in eas.json).

## That's All!

After the one-time setup, uploading new versions is just:
1. `eas build --platform ios --profile production`
2. `eas submit --platform ios --profile production`

## For Development/Testing

To test the app during development (no EAS needed):
```bash
npm run ios
```

This opens in the iOS Simulator or Expo Go app.

## Need Help?

- EAS Documentation: https://docs.expo.dev/build/introduction/
- Expo Discord: https://chat.expo.dev/
- Your Apple Team ID is already configured: K68872H2FZ
- Your App Store Connect App ID is already configured: 6758323638

## Common Questions

**Q: Why do I need EAS?**
A: Apple requires native iOS builds to upload to the App Store. EAS creates these builds for you in the cloud.

**Q: Does EAS cost money?**
A: Expo has a free tier that includes builds. You can build and upload without paying.

**Q: Can I build locally instead?**
A: Yes, but it requires Xcode, certificates, provisioning profiles, and is much more complex. EAS handles all of this automatically.

**Q: What if `eas init` fails?**
A: Make sure you're logged in (`eas login`) and have an Expo account. If you don't have one, create a free account at expo.dev first.
