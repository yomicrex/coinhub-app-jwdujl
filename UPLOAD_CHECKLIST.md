
# CoinHub Upload Checklist ✅

## ✅ Configuration Complete

All configuration files are ready:
- ✅ `app.json` - App metadata configured
- ✅ `eas.json` - Build and submit profiles configured
- ✅ `config/env.ts` - Environment variables set
- ✅ iOS credentials configured (Apple ID, Team ID, App ID)
- ✅ App scheme standardized to `coinhub`
- ✅ Backend URL configured

## 🚀 Ready to Upload

### Step 1: One-Time Setup

Run these commands in your terminal (in the project folder):

```bash
# Install EAS CLI (if not already installed)
npm install -g eas-cli

# Login to Expo
eas login

# Initialize EAS for this project
eas init
```

**What `eas init` does:**
- Links your project to your Expo account
- Adds a `projectId` to your `app.json`
- You only need to do this once per project

### Step 2: Build for iOS

```bash
eas build --platform ios --profile production
```

**What happens:**
- Your code is uploaded to Expo's servers
- The app is built in the cloud (takes 15-20 minutes)
- You get a download link when complete
- You can close your terminal and come back later

### Step 3: Submit to App Store

```bash
eas submit --platform ios --profile production
```

**What happens:**
- The built app is automatically uploaded to App Store Connect
- It uses your credentials from `eas.json`
- The app appears in TestFlight within 10-15 minutes
- You can then submit for App Store review

## 📱 For Testing During Development

To test the app without building:

```bash
# iOS Simulator
npm run ios

# Android Emulator
npm run android

# Expo Go on physical device
npm run dev
```

## ❓ Common Questions

### "Why do I need to run `eas init`?"
EAS needs to link your project to your Expo account. This creates a unique project ID that connects your local code to Expo's build servers.

### "Do I need to pay for EAS?"
Expo has a free tier that includes builds. You can build and submit without paying.

### "Can I skip EAS and use Expo Go?"
No. Expo Go is only for development. To upload to the App Store, you need a production build, which requires EAS.

### "What if I get an error during `eas build`?"
Common issues:
- **Not logged in**: Run `eas login` first
- **No project ID**: Run `eas init` first
- **Build fails**: Check the build logs in the terminal or on expo.dev

### "How do I update the app after the first upload?"
Just run the same two commands:
1. `eas build --platform ios --profile production`
2. `eas submit --platform ios --profile production`

EAS automatically increments the build number for you.

## 📋 Your Configured Credentials

These are already set in `eas.json`:
- **Apple ID**: yomicrex@hotmail.com
- **App Store Connect App ID**: 6758323638
- **Apple Team ID**: K68872H2FZ

## 🔗 Helpful Links

- **EAS Build Docs**: https://docs.expo.dev/build/introduction/
- **EAS Submit Docs**: https://docs.expo.dev/submit/introduction/
- **Expo Dashboard**: https://expo.dev/
- **App Store Connect**: https://appstoreconnect.apple.com/

## ✅ Next Steps

1. Run `eas init` (one time only)
2. Run `eas build --platform ios --profile production`
3. Wait for build to complete (15-20 minutes)
4. Run `eas submit --platform ios --profile production`
5. Check TestFlight in 10-15 minutes
6. Submit for App Store review when ready

That's it! Your app is configured and ready to upload.
