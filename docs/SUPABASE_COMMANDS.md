
# 🛠️ Supabase Commands & Tips

## Database Management

### View All Tables
```sql
-- In Supabase SQL Editor
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public';
```

### Check Table Structure
```sql
-- See columns in a table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'coins';
```

### View Data
```sql
-- Get all coins
SELECT * FROM coins LIMIT 10;

-- Get user profiles
SELECT * FROM profiles;

-- Get recent trades
SELECT * FROM trades ORDER BY created_at DESC LIMIT 10;
```

## Backend Commands

### Initial Setup
```bash
cd backend

# Install dependencies
npm install

# Create .env file
# Add your DATABASE_URL

# Run migrations
npm run db:push

# Start backend
npm run dev
```

### Database Operations
```bash
# Generate new migration (after schema changes)
npm run db:generate

# Apply migrations
npm run db:migrate

# Push schema changes directly (dev only)
npm run db:push

# Type check
npm run typecheck
```

## Supabase Dashboard

### Table Editor
- View/edit data visually
- Add/delete rows
- Filter and search
- Export to CSV

### SQL Editor
- Run custom queries
- Create views
- Set up triggers
- Manage indexes

### Database Settings
- **Connection string**: Get your DATABASE_URL
- **Connection pooling**: For production
- **Extensions**: Enable PostGIS, pg_cron, etc.
- **Backups**: Configure automatic backups

## Common Tasks

### Reset Database
```sql
-- ⚠️ WARNING: This deletes ALL data!
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
```

Then re-run migrations:
```bash
npm run db:push
```

### Add Sample Data
```sql
-- Add a test user (after running migrations)
INSERT INTO profiles (id, user_id, username, display_name)
VALUES (
  gen_random_uuid(),
  'test-user-id',
  'testuser',
  'Test User'
);

-- Add a test coin
INSERT INTO coins (id, user_id, title, country, year, visibility, trade_status)
VALUES (
  gen_random_uuid(),
  'test-user-id',
  'Test Coin',
  'USA',
  2024,
  'public',
  'not_for_trade'
);
```

### Check Database Size
```sql
SELECT 
  pg_size_pretty(pg_database_size(current_database())) as size;
```

### View Active Connections
```sql
SELECT 
  count(*) as connections,
  state
FROM pg_stat_activity
GROUP BY state;
```

## Monitoring

### Check Slow Queries
In Supabase Dashboard:
1. Go to **Reports**
2. Click **Query Performance**
3. See slowest queries

### Database Usage
1. Go to **Settings** → **Usage**
2. See:
   - Database size
   - Active connections
   - API requests
   - Bandwidth

## Backup & Restore

### Manual Backup
```bash
# Using pg_dump
pg_dump "postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres" > backup.sql
```

### Restore from Backup
```bash
psql "postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres" < backup.sql
```

### Automatic Backups
Supabase Pro plan includes:
- Daily automatic backups
- Point-in-time recovery
- 7-day retention

## Security

### Row Level Security (RLS)
```sql
-- Enable RLS on a table
ALTER TABLE coins ENABLE ROW LEVEL SECURITY;

-- Create policy: Users can only see public coins
CREATE POLICY "Public coins visible to all"
ON coins FOR SELECT
USING (visibility = 'public');

-- Create policy: Users can only edit their own coins
CREATE POLICY "Users can edit own coins"
ON coins FOR UPDATE
USING (user_id = auth.uid());
```

### View Policies
```sql
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public';
```

## Performance

### Add Indexes
```sql
-- Index for faster coin lookups
CREATE INDEX idx_coins_user_id ON coins(user_id);
CREATE INDEX idx_coins_created_at ON coins(created_at DESC);

-- Index for trade queries
CREATE INDEX idx_trades_status ON trades(status);
CREATE INDEX idx_trades_initiator ON trades(initiator_id);
```

### View Indexes
```sql
SELECT 
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
```

## Useful Queries

### User Statistics
```sql
SELECT 
  COUNT(*) as total_users,
  COUNT(CASE WHEN created_at > NOW() - INTERVAL '7 days' THEN 1 END) as new_this_week
FROM profiles;
```

### Coin Statistics
```sql
SELECT 
  COUNT(*) as total_coins,
  COUNT(CASE WHEN visibility = 'public' THEN 1 END) as public_coins,
  COUNT(CASE WHEN trade_status = 'open_to_trade' THEN 1 END) as tradeable_coins
FROM coins;
```

### Trade Statistics
```sql
SELECT 
  status,
  COUNT(*) as count
FROM trades
GROUP BY status
ORDER BY count DESC;
```

### Most Active Users
```sql
SELECT 
  p.username,
  COUNT(c.id) as coin_count,
  COUNT(DISTINCT l.id) as likes_received
FROM profiles p
LEFT JOIN coins c ON c.user_id = p.user_id
LEFT JOIN likes l ON l.coin_id = c.id
GROUP BY p.id, p.username
ORDER BY coin_count DESC
LIMIT 10;
```

## Tips

1. **Use Connection Pooling** in production (Settings → Database → Connection pooling)
2. **Enable RLS** for security (especially if using Supabase client directly)
3. **Add Indexes** for frequently queried columns
4. **Monitor Query Performance** regularly
5. **Set up Backups** before making schema changes
6. **Use Transactions** for multi-step operations
7. **Test Locally** before pushing to production

## Resources

- **Supabase Docs**: https://supabase.com/docs
- **PostgreSQL Docs**: https://www.postgresql.org/docs/
- **Drizzle ORM Docs**: https://orm.drizzle.team
- **Better Auth Docs**: https://www.better-auth.com

## Need Help?

- Check Supabase Discord: https://discord.supabase.com
- Check backend logs: `npm run dev` (watch for errors)
- Check Supabase logs: Dashboard → Logs
