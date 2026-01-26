
# ✅ Supabase Connection Checklist

Use this checklist to connect CoinHub to Supabase in 5 minutes.

## Pre-Setup
- [ ] I have a Supabase account (or will create one)
- [ ] I have my code editor open
- [ ] I have terminal access

## Step 1: Supabase Project
- [ ] Go to https://supabase.com
- [ ] Create new project named "CoinHub"
- [ ] Choose database password (write it down!)
- [ ] Select region
- [ ] Wait for project to be ready (~2 min)

## Step 2: Get Connection String
- [ ] Click Settings → Database
- [ ] Find "Connection string" section
- [ ] Click "URI" tab
- [ ] Copy the connection string
- [ ] Replace `[YOUR-PASSWORD]` with actual password

## Step 3: Configure Backend
- [ ] Open project in code editor
- [ ] Navigate to `backend` folder
- [ ] Create `.env` file (if doesn't exist)
- [ ] Paste connection string as `DATABASE_URL=...`
- [ ] Add other config (see SETUP_STATUS.md)

## Step 4: Run Migrations
- [ ] Open terminal in `backend` folder
- [ ] Run: `npm install`
- [ ] Run: `npm run db:push`
- [ ] Wait for "Migration complete" message

## Step 5: Verify
- [ ] Go to Supabase dashboard
- [ ] Click "Table Editor"
- [ ] See tables: user, users, coins, trades, etc.
- [ ] All tables have correct columns

## Step 6: Test App
- [ ] Start backend: `cd backend && npm run dev`
- [ ] Start frontend: `npm run dev`
- [ ] Sign up for new account
- [ ] Create profile
- [ ] Add a coin
- [ ] Check Supabase Table Editor - see your data!

## ✅ Success Criteria

You're done when:
- [ ] Backend starts without errors
- [ ] Frontend loads successfully
- [ ] You can sign up / log in
- [ ] You can create coins
- [ ] Data appears in Supabase Table Editor
- [ ] Trades work
- [ ] Ratings work

## 🎉 Congratulations!

Your CoinHub app is now connected to Supabase!

## What Changed?
- **Before**: Data stored locally (temporary)
- **After**: Data stored in Supabase (permanent, scalable)

## What Stayed the Same?
- **Everything else**: App works exactly the same way
- **No code changes**: Frontend unchanged
- **Same features**: All functionality preserved

## Next Steps
- [ ] Test all features (signup, coins, trades, ratings)
- [ ] Invite beta testers
- [ ] Monitor Supabase dashboard
- [ ] Set up backups (automatic in Supabase)

## Troubleshooting

**Backend won't start:**
- Check `.env` file exists in `backend` folder
- Verify DATABASE_URL is correct
- Make sure no typos in connection string

**Tables not created:**
- Run `npm run db:push` again
- Check for error messages
- Verify Supabase project is active

**Can't connect to database:**
- Check Supabase project is running
- Verify password is correct
- Try copying connection string again

**Data not saving:**
- Check backend logs for errors
- Verify migrations ran successfully
- Check Supabase dashboard for connection issues

## Need Help?

1. Check backend logs: `cd backend && npm run dev`
2. Check Supabase logs: Dashboard → Logs
3. Review setup guides in `docs/` folder
4. Verify each checklist item above

## Files to Reference
- `docs/SETUP_STATUS.md` - Current status
- `docs/SUPABASE_QUICK_START.md` - Quick setup
- `docs/SUPABASE_SETUP.md` - Detailed guide
- `backend/.env.example` - Config template
