
# 🚀 Connecting CoinHub to Supabase

## Overview
This guide shows you how to connect your CoinHub app to Supabase's PostgreSQL database while keeping your existing backend architecture.

## Prerequisites
1. A Supabase account (sign up at https://supabase.com)
2. A Supabase project created

## Step 1: Get Your Supabase Database URL

1. Go to your Supabase project dashboard
2. Click on **Settings** (gear icon in sidebar)
3. Click on **Database**
4. Scroll down to **Connection string**
5. Select **URI** tab
6. Copy the connection string (it looks like this):
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres
   ```
7. Replace `[YOUR-PASSWORD]` with your actual database password

## Step 2: Update Backend Environment Variables

1. Navigate to your `backend` folder
2. Create a `.env` file (if it doesn't exist)
3. Add your Supabase database URL:

```env
# Supabase Database Connection
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres

# Application Environment
NODE_ENV=development

# Frontend Configuration
FRONTEND_URL=http://localhost:3000

# Email Configuration (using Resend)
EMAIL_PROVIDER=resend
EMAIL_FROM=noreply@coinhub.example.com
RESEND_API_KEY=your-resend-api-key-here

# Storage (keep using Specular for now)
STORAGE_API_BASE_URL=http://localhost:3000/api/storage
```

## Step 3: Run Database Migrations

Your backend uses Drizzle ORM which will automatically create all necessary tables in Supabase.

```bash
cd backend
npm run db:push
```

This will:
- Generate migration files
- Apply all schema changes to your Supabase database
- Create tables for: users, profiles, coins, trades, comments, likes, follows, etc.

## Step 4: Verify Connection

1. Go to your Supabase dashboard
2. Click on **Table Editor** in the sidebar
3. You should see all your CoinHub tables:
   - `user` (Better Auth users)
   - `session` (Better Auth sessions)
   - `profiles` (CoinHub user profiles)
   - `coins` (Coin collection data)
   - `trades` (Trading system)
   - `comments`, `likes`, `follows`, etc.

## Step 5: Test Your App

1. Start your backend:
   ```bash
   cd backend
   npm run dev
   ```

2. Start your frontend:
   ```bash
   npm run dev
   ```

3. Try signing up and creating a profile - data should now be stored in Supabase!

## 🎉 You're Done!

Your CoinHub app is now connected to Supabase's PostgreSQL database. All data will be stored in Supabase while keeping your existing backend logic.

## Optional: Use Supabase Storage

If you want to use Supabase Storage for coin images instead of Specular:

1. Go to Supabase dashboard → **Storage**
2. Create a bucket called `coin-images`
3. Set it to **Public** (or configure RLS policies)
4. Update your backend to use Supabase Storage SDK

## Optional: Use Supabase Auth

If you want to replace Better Auth with Supabase Auth:
- This requires more significant changes to your backend and frontend
- Let me know if you want help with this migration

## Troubleshooting

### Connection Issues
- Make sure your IP is allowed in Supabase (Settings → Database → Connection pooling)
- Verify your database password is correct
- Check that the connection string format is correct

### Migration Errors
- If tables already exist, you may need to reset your database
- In Supabase dashboard, you can drop all tables and re-run migrations

### Authentication Issues
- Better Auth will continue to work with Supabase's PostgreSQL
- Sessions are stored in the `session` table in Supabase

## Need Help?

If you encounter any issues:
1. Check the backend logs for error messages
2. Verify your DATABASE_URL is correct
3. Make sure Supabase project is active
4. Check Supabase dashboard for connection errors
</write file>

<write file="docs/SUPABASE_FULL_MIGRATION.md">
# 🔄 Full Supabase Migration Guide (Optional)

## Overview
This guide is for migrating from your current backend to **full Supabase integration** (Supabase Auth + Database + Storage).

⚠️ **Note**: This is a more complex migration. Only do this if you want to fully replace your backend with Supabase's built-in features.

## Why Migrate Fully?

**Pros:**
- Simplified architecture (no separate backend server)
- Built-in real-time subscriptions
- Supabase Auth with social providers
- Integrated storage solution
- Row Level Security (RLS) for data protection
- Auto-generated REST API

**Cons:**
- Requires rewriting all API calls
- Need to migrate Better Auth to Supabase Auth
- More frontend code changes
- Learning curve for Supabase SDK

## Migration Steps

### 1. Install Supabase Client

```bash
npm install @supabase/supabase-js
```

### 2. Create Supabase Client

Create `lib/supabase.ts`:

```typescript
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl || 'YOUR_SUPABASE_URL';
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey || 'YOUR_SUPABASE_ANON_KEY';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage, // For React Native
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
```

### 3. Update app.json

```json
{
  "expo": {
    "extra": {
      "supabaseUrl": "https://your-project.supabase.co",
      "supabaseAnonKey": "your-anon-key"
    }
  }
}
```

### 4. Migrate Authentication

Replace `lib/auth.ts` with Supabase Auth:

```typescript
import { supabase } from './supabase';

export const authClient = {
  signIn: async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  },
  
  signUp: async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    if (error) throw error;
    return data;
  },
  
  signOut: async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },
  
  getSession: async () => {
    const { data } = await supabase.auth.getSession();
    return data.session;
  },
};
```

### 5. Migrate Database Queries

Replace API calls with Supabase queries:

**Before (API call):**
```typescript
const response = await authenticatedFetch('/api/coins');
const coins = await response.json();
```

**After (Supabase query):**
```typescript
const { data: coins, error } = await supabase
  .from('coins')
  .select('*')
  .order('created_at', { ascending: false });
```

### 6. Set Up Row Level Security (RLS)

In Supabase dashboard, enable RLS and create policies:

```sql
-- Allow users to read public coins
CREATE POLICY "Public coins are viewable by everyone"
ON coins FOR SELECT
USING (visibility = 'public');

-- Allow users to insert their own coins
CREATE POLICY "Users can insert their own coins"
ON coins FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own coins
CREATE POLICY "Users can update their own coins"
ON coins FOR UPDATE
USING (auth.uid() = user_id);
```

### 7. Migrate File Uploads

Replace Specular storage with Supabase Storage:

```typescript
// Upload coin image
const { data, error } = await supabase.storage
  .from('coin-images')
  .upload(`${userId}/${Date.now()}.jpg`, file);

// Get public URL
const { data: { publicUrl } } = supabase.storage
  .from('coin-images')
  .getPublicUrl(data.path);
```

## Decision: Should You Migrate Fully?

**Stick with current setup (Supabase as DB only) if:**
- You're happy with your current backend architecture
- You want minimal code changes
- You prefer having a separate backend server
- You're already familiar with Fastify/Drizzle

**Migrate fully to Supabase if:**
- You want to simplify your architecture
- You want real-time features (live updates)
- You want to reduce backend maintenance
- You're comfortable rewriting API calls

## Recommendation

For CoinHub, I recommend **Option 1** (Supabase as database only) because:
1. Your backend is already well-structured
2. Minimal code changes required
3. You keep Better Auth which is working well
4. Easier to maintain your existing trade/moderation logic

You can always migrate to full Supabase later if needed!
</write file>

Now let me create a simple setup script to help you configure Supabase:

<write file="docs/SUPABASE_QUICK_START.md">
# ⚡ Supabase Quick Start (5 Minutes)

## What You're Doing
Connecting your CoinHub backend to Supabase's PostgreSQL database. Your app will continue to work exactly the same, but data will be stored in Supabase.

## Steps

### 1️⃣ Create Supabase Project (2 minutes)

1. Go to https://supabase.com
2. Click **"Start your project"** (sign up if needed)
3. Click **"New Project"**
4. Fill in:
   - **Name**: CoinHub
   - **Database Password**: Choose a strong password (save it!)
   - **Region**: Choose closest to you
5. Click **"Create new project"**
6. Wait ~2 minutes for project to be ready

### 2️⃣ Get Database Connection String (1 minute)

1. In your Supabase project, click **Settings** (⚙️ icon)
2. Click **Database** in the sidebar
3. Scroll to **Connection string**
4. Click **URI** tab
5. Copy the connection string
6. Replace `[YOUR-PASSWORD]` with the password you chose in step 1

Example:
```
postgresql://postgres:your-password-here@db.abcdefghijk.supabase.co:5432/postgres
```

### 3️⃣ Update Your Backend (1 minute)

1. Open your project in your code editor
2. Navigate to the `backend` folder
3. Create a file called `.env` (if it doesn't exist)
4. Paste this and replace with your connection string:

```env
DATABASE_URL=postgresql://postgres:your-password-here@db.abcdefghijk.supabase.co:5432/postgres
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
EMAIL_PROVIDER=console
EMAIL_FROM=noreply@coinhub.app
```

### 4️⃣ Run Migrations (1 minute)

Open terminal in the `backend` folder and run:

```bash
npm run db:push
```

This creates all your tables in Supabase (users, coins, trades, etc.)

### 5️⃣ Verify It Worked

1. Go back to Supabase dashboard
2. Click **Table Editor** in sidebar
3. You should see tables like:
   - `user`
   - `session`
   - `profiles`
   - `coins`
   - `trades`
   - `comments`
   - `likes`
   - `follows`

### 6️⃣ Start Your App

```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
npm run dev
```

## ✅ Done!

Your CoinHub app is now connected to Supabase! 

Try:
1. Sign up for a new account
2. Create a profile
3. Add a coin
4. Go to Supabase dashboard → Table Editor → `coins` to see your data!

## What Changed?

- **Data storage**: Now in Supabase instead of local database
- **Everything else**: Works exactly the same!

## Next Steps (Optional)

- **View your data**: Use Supabase Table Editor to browse/edit data
- **Set up backups**: Supabase automatically backs up your database
- **Add team members**: Invite others to your Supabase project
- **Monitor usage**: Check Supabase dashboard for database stats

## Troubleshooting

**"Connection refused" error:**
- Check your DATABASE_URL is correct
- Make sure you replaced `[YOUR-PASSWORD]` with actual password
- Verify Supabase project is active (not paused)

**"Migration failed" error:**
- Make sure you're in the `backend` folder
- Try `npm install` first
- Check backend logs for specific error

**Tables not showing in Supabase:**
- Refresh the Table Editor page
- Check that `npm run db:push` completed successfully
- Look for error messages in terminal

## Need Help?

Check the full guides:
- `SUPABASE_SETUP.md` - Detailed setup instructions
- `SUPABASE_FULL_MIGRATION.md` - Full Supabase integration (advanced)
