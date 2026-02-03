
# Build Configuration Fix Guide

## Issues Fixed

1. ✅ Added missing `extra.eas.projectId` field to app.json
2. ✅ Added `cli.appVersionSource` to eas.json
3. ✅ Standardized app scheme to lowercase "coinhub"
4. ✅ Added explicit `platforms` array to app.json

## Required Steps Before Building

### Step 1: Initialize EAS Project (REQUIRED)

You MUST run this command to configure your EAS project and get a real project ID:

```bash
npx eas init
```

This will:
- Create an EAS project linked to your Expo account
- Replace `PLACEHOLDER_PROJECT_ID` in app.json with your actual project ID
- Configure your project for EAS builds

### Step 2: Verify Configuration

After running `eas init`, check that `app.json` has been updated with a real project ID:

```json
"extra": {
  "eas": {
    "projectId": "your-actual-project-id-here"
  }
}
```

### Step 3: Build

Now you can build:

```bash
# For iOS production build
npx eas build --platform ios --profile production

# For Android production build
npx eas build --platform android --profile production
```

## Why This Was Needed

- **EAS Project ID**: Required for all EAS builds to identify your project
- **appVersionSource**: Tells EAS where to get version numbers (remote = from EAS servers)
- **Lowercase scheme**: Prevents deep linking issues on Android
- **Platforms array**: Explicitly declares supported platforms

## Troubleshooting

If you still see errors:

1. Make sure you're logged into Expo:
   ```bash
   npx eas login
   ```

2. Check your Expo account has the project:
   ```bash
   npx eas project:info
   ```

3. If project doesn't exist, run `eas init` again

## Apple Credentials (For App Store Submission)

The `eas.json` file has placeholders for Apple credentials. You'll need to fill these in when you're ready to submit to the App Store:

- `appleId`: Your Apple ID email
- `ascAppId`: Your App Store Connect app ID (found in App Store Connect)
- `appleTeamId`: Your Apple Developer Team ID

These are NOT needed for building - only for automatic submission to the App Store.
