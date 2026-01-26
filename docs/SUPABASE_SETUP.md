
# 🚀 Connecting CoinHub to Supabase - Complete Guide

## Overview

This guide shows you how to connect your CoinHub app to Supabase's PostgreSQL database while keeping your existing backend architecture.

## What You're Doing

**Simple explanation**: You're telling your backend where to store data permanently (in Supabase's cloud database instead of locally).

**Technical explanation**: You're configuring your Fastify backend to connect to a Supabase-hosted PostgreSQL database via a connection string, then running Drizzle ORM migrations to create all necessary tables.

## Prerequisites

- ✅ CoinHub app (you have this!)
- ✅ Code editor (VS Code, etc.)
- ✅ Terminal/command prompt
- ✅ Internet connection
- ⏱️ 5 minutes of time

## Step 1: Create Supabase Project (2 minutes)

### 1.1 Sign Up / Log In
1. Go to **https://supabase.com**
2. Click **"Start your project"** or **"Sign up"**
3. Sign up with:
   - GitHub account (recommended)
   - Google account
   - Or email/password

### 1.2 Create New Project
1. Click **"New Project"** button
2. Fill in the form:
   - **Organization**: Select or create one
   - **Name**: `CoinHub` (or any name you like)
   - **Database Password**: Choose a strong password
     - ⚠️ **CRITICAL**: Write this password down! You'll need it in Step 2.
     - Example: `MySecurePassword123!`
   - **Region**: Choose closest to your location
     - US East (North Virginia)
     - US West (Oregon)
     - Europe (Frankfurt)
     - Asia Pacific (Singapore)
     - Etc.
   - **Pricing Plan**: Free (default)

3. Click **"Create new project"**

### 1.3 Wait for Setup
- Supabase will set up your database (~2 minutes)
- You'll see a progress indicator
- When done, you'll see the project dashboard

## Step 2: Get Database Connection String (1 minute)

### 2.1 Navigate to Database Settings
1. In your Supabase project dashboard
2. Look at the left sidebar
3. Click the **Settings** icon (⚙️ gear icon at the bottom)
4. In the Settings menu, click **"Database"**

### 2.2 Find Connection String
1. Scroll down to the section called **"Connection string"**
2. You'll see several tabs: **Pooler**, **Direct**, **URI**
3. Click the **"URI"** tab
4. You'll see a connection string like this:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.abcdefghijklmnop.supabase.co:5432/postgres
   ```

### 2.3 Copy and Modify
1. Click the **"Copy"** button to copy the connection string
2. Open a text editor (Notepad, TextEdit, etc.)
3. Paste the connection string
4. **Replace** `[YOUR-PASSWORD]` with the actual password you chose in Step 1.2
   - Remove the square brackets `[` and `]`
   - Example:
     - Before: `postgresql://postgres:[YOUR-PASSWORD]@db.abc...`
     - After: `postgresql://postgres:MySecurePassword123!@db.abc...`
5. Keep this text editor open - you'll need this in Step 3

**Example of complete connection string:**
```
postgresql://postgres:MySecurePassword123!@db.abcdefghijklmnop.supabase.co:5432/postgres
```

## Step 3: Configure Backend (1 minute)

### 3.1 Open Project in Code Editor
1. Open your CoinHub project in your code editor (VS Code, etc.)
2. Navigate to the **`backend`** folder

### 3.2 Create .env File
1. In the `backend` folder, look for a file called **`.env`**
   - If it exists, open it
   - If it doesn't exist, create a new file called `.env`
     - Right-click in the `backend` folder
     - Select "New File"
     - Name it exactly: `.env` (with the dot at the start)

### 3.3 Add Configuration
1. Paste this into the `.env` file:

```env
# Supabase Database Connection
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@db.xxxxx.supabase.co:5432/postgres

# Application Settings
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# Email Configuration (for password reset)
EMAIL_PROVIDER=console
EMAIL_FROM=noreply@coinhub.app

# Storage (for coin images)
STORAGE_API_BASE_URL=http://localhost:3000/api/storage
```

2. **Replace the `DATABASE_URL` line** with your actual connection string from Step 2.3

3. **Save the file** (Ctrl+S or Cmd+S)

**Example of what your `.env` should look like:**
```env
DATABASE_URL=postgresql://postgres:MySecurePassword123!@db.abcdefghijklmnop.supabase.co:5432/postgres
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
EMAIL_PROVIDER=console
EMAIL_FROM=noreply@coinhub.app
STORAGE_API_BASE_URL=http://localhost:3000/api/storage
```

## Step 4: Create Database Tables (1 minute)

### 4.1 Open Terminal
1. Open a terminal/command prompt
2. Navigate to your backend folder:
   ```bash
   cd backend
   ```
   (Adjust the path if your project is in a different location)

### 4.2 Install Dependencies
If you haven't already, install the backend dependencies:
```bash
npm install
```

This will take ~30 seconds.

### 4.3 Run Migrations
Run this command to create all database tables:
```bash
npm run db:push
```

You should see output like:
```
Generating migrations...
Running migrations...
✓ Migration complete!
```

This command:
- Generates SQL migration files
- Connects to your Supabase database
- Creates all necessary tables:
  - `user` (Better Auth users)
  - `session` (Better Auth sessions)
  - `users` (CoinHub profiles)
  - `coins` (coin collection data)
  - `trades` (trading system)
  - `trade_offers` (trade proposals)
  - `trade_messages` (trade chat)
  - `trade_ratings` (user ratings)
  - `comments` (coin comments)
  - `likes` (coin likes)
  - `follows` (user follows)
  - `notifications` (user notifications)
  - `reports` (moderation)
  - `invite_codes` (invite system)
  - `coin_images` (image metadata)

## Step 5: Verify Connection (30 seconds)

### 5.1 Check Supabase Dashboard
1. Go back to your **Supabase dashboard** in your browser
2. In the left sidebar, click **"Table Editor"**
3. You should now see a list of tables on the left side:
   - user
   - session
   - users
   - coins
   - trades
   - trade_offers
   - trade_messages
   - trade_ratings
   - comments
   - likes
   - follows
   - notifications
   - reports
   - invite_codes
   - coin_images

### 5.2 Verify Tables
1. Click on any table (e.g., `coins`)
2. You should see the table structure (columns)
3. The table will be empty (no data yet)

✅ **If you see these tables, you're successfully connected!**

## Step 6: Start Your App

### 6.1 Start Backend
In your terminal (in the `backend` folder):
```bash
npm run dev
```

You should see:
```
CoinHub application running
Server listening at http://localhost:3000
```

### 6.2 Start Frontend
Open a **new terminal window** (keep the backend running):
```bash
cd ..  # Go back to root folder
npm run dev
```

You should see:
```
› Metro waiting on exp://...
› Scan the QR code above with Expo Go (Android) or the Camera app (iOS)
```

### 6.3 Open App
- **Mobile**: Scan QR code with Expo Go app (Android) or Camera app (iOS)
- **Web**: Press `w` in the terminal

## Step 7: Test It Works

### 7.1 Sign Up
1. In the app, tap **"Sign up"**
2. Enter email and password
3. Tap **"Create account"**

### 7.2 Create Profile
1. Enter username, display name
2. Optionally add bio, location
3. Tap **"Save"**

### 7.3 Add a Coin
1. Tap **"Add Coin"** button
2. Fill in coin details (title, country, year, etc.)
3. Optionally add photos
4. Tap **"Save"**

### 7.4 Verify in Supabase
1. Go to Supabase dashboard
2. Click **Table Editor**
3. Click **`coins`** table
4. You should see your coin data!

✅ **Success!** Your app is now connected to Supabase!

## What Just Happened?

### Before
- Data stored locally (temporary)
- Lost when backend restarts
- Not suitable for production

### After
- ✅ Data stored in Supabase (permanent)
- ✅ Backed up automatically
- ✅ Scalable to thousands of users
- ✅ Production-ready
- ✅ Can view/edit data in Supabase dashboard

### What Changed
- **Only**: Where data is stored (local → Supabase)

### What Stayed the Same
- ✅ Your frontend code (no changes)
- ✅ Your backend code (no changes)
- ✅ How the app works (exactly the same)
- ✅ All features (coins, trades, ratings, etc.)

## Troubleshooting

### ❌ "Connection refused" or "Connection timeout"

**Symptoms**: Backend can't connect to Supabase

**Solutions**:
1. Check your `.env` file in the `backend` folder exists
2. Verify `DATABASE_URL` is correct
3. Make sure you replaced `[YOUR-PASSWORD]` with actual password (no brackets!)
4. Check for extra spaces before/after the connection string
5. Verify your Supabase project is active (not paused)
6. Try copying the connection string again from Supabase dashboard

### ❌ "Migration failed" or "npm run db:push" errors

**Symptoms**: Tables couldn't be created

**Solutions**:
1. Make sure you're in the `backend` folder when running commands
2. Try running `npm install` first
3. Check that your `DATABASE_URL` is correct in `.env`
4. Look at the error message - it usually tells you what's wrong
5. Try running `npm run db:push` again
6. Check Supabase dashboard → Logs for database errors

### ❌ Tables not showing in Supabase

**Symptoms**: Table Editor is empty

**Solutions**:
1. Refresh the page in your browser
2. Check that `npm run db:push` completed successfully (no errors)
3. Make sure you're looking at the correct Supabase project
4. Try clicking different sections in the left sidebar
5. Check Supabase dashboard → Logs for errors

### ❌ Backend won't start

**Symptoms**: `npm run dev` fails

**Solutions**:
1. Check that `.env` file exists in `backend` folder
2. Verify `DATABASE_URL` is set correctly
3. Make sure you ran `npm install` in the backend folder
4. Look at the error message in the terminal
5. Check that port 3000 isn't already in use
6. Try stopping any other running processes on port 3000

### ❌ App works but data doesn't save

**Symptoms**: Can create coins but they disappear

**Solutions**:
1. Check backend terminal for error messages
2. Verify migrations ran successfully (`npm run db:push`)
3. Check Supabase dashboard → Logs for errors
4. Make sure your Supabase project isn't paused
5. Verify `DATABASE_URL` is correct
6. Try restarting the backend

### ❌ "Password authentication failed"

**Symptoms**: Backend can't authenticate with Supabase

**Solutions**:
1. Double-check your database password is correct
2. Make sure you replaced `[YOUR-PASSWORD]` in the connection string
3. Try resetting your database password in Supabase dashboard
4. Get a new connection string after resetting password

## Next Steps (Optional)

### View Your Data
1. Go to Supabase dashboard
2. Click **Table Editor**
3. Click on any table (e.g., `coins`, `users`, `trades`)
4. See all your data in a spreadsheet-like view
5. You can even edit data directly here!

### Run SQL Queries
1. Go to Supabase dashboard
2. Click **SQL Editor**
3. Try running queries like:
   ```sql
   -- See all users
   SELECT * FROM users;
   
   -- Count total coins
   SELECT COUNT(*) FROM coins;
   
   -- See recent trades
   SELECT * FROM trades ORDER BY created_at DESC LIMIT 10;
   
   -- Get user with most coins
   SELECT u.username, COUNT(c.id) as coin_count
   FROM users u
   LEFT JOIN coins c ON c.user_id = u.user_id
   GROUP BY u.id, u.username
   ORDER BY coin_count DESC
   LIMIT 1;
   ```

### Monitor Your Database
1. Go to Supabase dashboard
2. Click **Reports**
3. See:
   - Database size
   - Query performance
   - API requests
   - Active connections

### Set Up Backups
- Supabase automatically backs up your database daily (free tier)
- On paid plans, you get point-in-time recovery
- You can also manually export data:
  - Settings → Database → Export
  - Choose format: SQL, CSV, or JSON

### Add Team Members
1. Go to Supabase dashboard
2. Click **Settings** → **Team**
3. Invite team members to manage the database

## Understanding Your Setup

### Architecture
```
Your Expo App (Frontend)
        ↓
   HTTP Requests
        ↓
Your Fastify Backend
        ↓
   SQL Queries (Drizzle ORM)
        ↓
Supabase PostgreSQL Database
```

### What Each Part Does

**Frontend (Expo App)**:
- React Native UI
- Handles user interactions
- Makes API calls to backend
- Located in: `app/`, `components/`, etc.

**Backend (Fastify Server)**:
- Handles API requests
- Business logic (trades, ratings, etc.)
- Authentication (Better Auth)
- Located in: `backend/src/`

**Database (Supabase)**:
- Stores all data permanently
- PostgreSQL database
- Managed by Supabase
- Accessed via connection string

### Why This Setup?

✅ **Separation of Concerns**: Frontend, backend, and database are separate
✅ **Scalability**: Each part can scale independently
✅ **Security**: Backend validates all requests before touching database
✅ **Flexibility**: Can change database without changing frontend
✅ **Professional**: Industry-standard architecture

## Common Questions

### Q: Do I need to change my frontend code?
**A**: No! Your frontend code stays exactly the same. It still makes the same API calls to your backend.

### Q: Will my existing data be lost?
**A**: If you had local data, it won't automatically transfer. But going forward, all new data will be in Supabase.

### Q: Can I use Supabase's client library directly?
**A**: You could, but it's not recommended. Your backend handles all database logic, which is more secure and maintainable.

### Q: What if I want to switch from Supabase later?
**A**: Easy! Just change the `DATABASE_URL` to point to another PostgreSQL database (like Neon, Railway, or your own server).

### Q: Is this production-ready?
**A**: Yes! Supabase is used by thousands of production apps. Just make sure to:
- Use a strong database password
- Set up proper backups
- Monitor your usage
- Consider upgrading to a paid plan for more resources

### Q: How much does Supabase cost?
**A**: 
- **Free tier**: 500MB database, 1GB file storage, 50,000 monthly active users
- **Pro tier**: $25/month - 8GB database, 100GB storage, unlimited users
- For CoinHub beta, free tier should be plenty!

### Q: Can I see my data?
**A**: Yes! Use the Supabase Table Editor to view/edit all your data in a spreadsheet-like interface.

### Q: What if Supabase goes down?
**A**: Supabase has 99.9% uptime. If it goes down, your app can't access data until it's back up. (This is true for any cloud database)

### Q: Can I export my data?
**A**: Yes! You can export to SQL, CSV, or JSON anytime from the Supabase dashboard.

## Resources

- **Supabase Docs**: https://supabase.com/docs
- **Drizzle ORM Docs**: https://orm.drizzle.team
- **Better Auth Docs**: https://www.better-auth.com
- **Fastify Docs**: https://fastify.dev
- **PostgreSQL Docs**: https://www.postgresql.org/docs/

## Need More Help?

Check these files in your `docs/` folder:
- `QUICK_CONNECT.md` - Quick reference (5 minutes)
- `WHAT_IS_SUPABASE.md` - Simple explanation
- `SUPABASE_COMMANDS.md` - Database commands
- `CONNECTION_CHECKLIST.md` - Step-by-step checklist
- `ARCHITECTURE.md` - Technical architecture

## Summary

**What you did**:
1. ✅ Created Supabase project
2. ✅ Got database connection string
3. ✅ Added it to `.env` file
4. ✅ Ran migrations to create tables
5. ✅ Started your app
6. ✅ Tested it works

**Result**:
- 🎉 Your CoinHub app is now connected to Supabase!
- 💾 All data is stored permanently
- 📈 Ready to scale to thousands of users
- 🔒 Production-grade security
- 💰 Free tier is plenty for beta testing

**Time taken**: ~5 minutes

**Code changes**: Zero! Just configuration.

**Congratulations! Your app is now production-ready!** 🚀
