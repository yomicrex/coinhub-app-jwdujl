
# ⚡ Connect to Supabase in 5 Minutes

## Before You Start
- [ ] I have a code editor open
- [ ] I have a terminal/command prompt open
- [ ] I'm ready to create a Supabase account (free)

---

## Step 1: Create Supabase Project (2 min)

1. Go to: **https://supabase.com**
2. Click: **"Sign up"** or **"Start your project"**
3. Click: **"New Project"**
4. Fill in:
   - Name: `CoinHub`
   - Password: `[Choose a strong password]` ← **Write this down!**
   - Region: `[Choose closest to you]`
5. Click: **"Create new project"**
6. Wait ~2 minutes ⏳

---

## Step 2: Get Connection String (1 min)

1. In Supabase dashboard, click: **Settings** (⚙️ icon)
2. Click: **Database**
3. Scroll to: **"Connection string"**
4. Click: **URI** tab
5. Click: **Copy** button
6. You'll have something like:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.xxxxx.supabase.co:5432/postgres
   ```
7. **Replace** `[YOUR-PASSWORD]` with your actual password from Step 1

---

## Step 3: Configure Backend (1 min)

1. Open your project in code editor
2. Go to `backend` folder
3. Create file: `.env`
4. Paste this (replace with YOUR connection string):

```env
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@db.xxxxx.supabase.co:5432/postgres
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
EMAIL_PROVIDER=console
EMAIL_FROM=noreply@coinhub.app
STORAGE_API_BASE_URL=http://localhost:3000/api/storage
```

5. Save file

---

## Step 4: Create Tables (1 min)

Open terminal in `backend` folder:

```bash
cd backend
npm install
npm run db:push
```

Wait for: `Migration complete!` ✅

---

## Step 5: Verify (30 sec)

1. Go to Supabase dashboard
2. Click: **Table Editor**
3. See tables: `user`, `users`, `coins`, `trades`, etc. ✅

---

## Step 6: Start App

**Terminal 1:**
```bash
cd backend
npm run dev
```

**Terminal 2:**
```bash
npm run dev
```

---

## ✅ Test It Works

1. Open app (scan QR or press `w`)
2. Sign up
3. Create profile
4. Add a coin
5. Check Supabase Table Editor → `coins` table
6. See your coin! 🎉

---

## 🎉 Done!

Your CoinHub app is now connected to Supabase!

**What changed**: Data now stored permanently in Supabase
**What stayed same**: Everything else!

---

## ❌ Troubleshooting

**Backend won't start:**
- Check `.env` file exists in `backend` folder
- Verify `DATABASE_URL` is correct (no `[YOUR-PASSWORD]` text)
- Make sure password has no spaces

**Tables not created:**
- Run `npm run db:push` again
- Check for error messages
- Verify Supabase project is active

**Can't connect:**
- Check password is correct
- Make sure Supabase project isn't paused
- Try copying connection string again

---

## 📚 Need More Help?

Read the detailed guide: `docs/SUPABASE_CONNECTION_GUIDE.md`

---

## Summary

✅ Created Supabase project
✅ Got connection string  
✅ Added to `.env`
✅ Ran migrations
✅ Started app
✅ **You're production-ready!** 🚀
