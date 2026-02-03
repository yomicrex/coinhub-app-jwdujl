
# Simple Upload Guide for CoinHub

## What You Need to Know

To upload your app to the App Store, you **must** use EAS (Expo Application Services). There's no way around this for production builds. However, I've simplified the process as much as possible.

## One-Time Setup (Only Do This Once)

### Step 1: Install EAS CLI
```bash
npm install -g eas-cli
```

### Step 2: Login to Expo
```bash
eas login
```
Enter your Expo account credentials (or create a free account at expo.dev)

### Step 3: Initialize EAS for Your Project
```bash
eas init
```
This command will:
- Link your project to your Expo account
- Automatically add the `projectId` to your `app.json`
- That's it! You only need to do this once.

## Building and Uploading (Every Time You Want to Upload)

### For iOS (TestFlight/App Store)

#### Build the app:
```bash
eas build --platform ios --profile production
```

This will:
- Build your app in the cloud (takes 10-20 minutes)
- Give you a download link when done

#### Submit to App Store:
```bash
eas submit --platform ios --profile production
```

This will automatically upload to TestFlight using the credentials already in `eas.json`.

### For Android (Google Play)

#### Build the app:
```bash
eas build --platform android --profile production
```

#### Submit to Google Play:
```bash
eas submit --platform android --profile production
```

## That's It!

After the one-time setup (`eas init`), you only need two commands:
1. `eas build --platform ios --profile production` (to build)
2. `eas submit --platform ios --profile production` (to upload)

## Testing in Development

For testing during development, just use:
```bash
npm run ios
```
or
```bash
npm run android
```

This opens the app in Expo Go or a simulator without any EAS configuration needed.

## Why Can't I Skip EAS?

- **Expo Go** is only for development/testing
- **Production apps** (App Store/Play Store) need native builds
- **EAS** is Expo's build service that creates these native builds
- Apple and Google require properly signed native builds
- There's no way to upload to stores without this step

The good news: After `eas init`, it's just 2 simple commands to build and upload!
