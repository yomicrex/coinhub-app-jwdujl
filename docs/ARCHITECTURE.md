
# 🏗️ CoinHub Architecture

## Current Architecture (After Supabase Connection)

```
┌─────────────────────────────────────────────────────────────┐
│                         USERS                                │
│  (iOS, Android, Web - using Expo app)                       │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ HTTP/HTTPS Requests
                     │ (REST API calls)
                     ↓
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (Expo)                           │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  React Native Components                              │  │
│  │  - Screens (Feed, Profile, Trades, etc.)            │  │
│  │  - Components (Buttons, Cards, etc.)                 │  │
│  │  - Navigation (Expo Router)                          │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  State Management                                     │  │
│  │  - AuthContext (user session)                        │  │
│  │  - Local state (useState, useEffect)                 │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  API Client (utils/api.ts)                           │  │
│  │  - authenticatedFetch()                              │  │
│  │  - Handles auth headers                              │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ API Calls
                     │ (GET /api/coins, POST /api/trades, etc.)
                     ↓
┌─────────────────────────────────────────────────────────────┐
│                   BACKEND (Fastify)                          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  API Routes                                           │  │
│  │  - /api/auth/* (login, signup, etc.)                │  │
│  │  - /api/coins/* (CRUD operations)                   │  │
│  │  - /api/trades/* (trading system)                   │  │
│  │  - /api/profiles/* (user profiles)                  │  │
│  │  - /api/feed (coin feed)                            │  │
│  │  - And more...                                       │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Business Logic                                       │  │
│  │  - Authentication (Better Auth)                      │  │
│  │  - Authorization (ownership checks)                  │  │
│  │  - Validation (input validation)                     │  │
│  │  - Trade workflows                                   │  │
│  │  - Rating calculations                               │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Database Layer (Drizzle ORM)                        │  │
│  │  - Schema definitions                                 │  │
│  │  - Query builder                                      │  │
│  │  - Migrations                                         │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ SQL Queries
                     │ (SELECT, INSERT, UPDATE, DELETE)
                     ↓
┌─────────────────────────────────────────────────────────────┐
│                  DATABASE (Supabase)                         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  PostgreSQL Database                                  │  │
│  │  ┌────────────────────────────────────────────────┐ │  │
│  │  │  Tables:                                        │ │  │
│  │  │  - user (Better Auth users)                    │ │  │
│  │  │  - session (Better Auth sessions)              │ │  │
│  │  │  - users (CoinHub profiles)                    │ │  │
│  │  │  - coins (coin collection data)                │ │  │
│  │  │  - trades (trading system)                     │ │  │
│  │  │  - trade_offers (trade proposals)              │ │  │
│  │  │  - trade_messages (trade chat)                 │ │  │
│  │  │  - trade_ratings (user ratings)                │ │  │
│  │  │  - comments (coin comments)                    │ │  │
│  │  │  - likes (coin likes)                          │ │  │
│  │  │  - follows (user follows)                      │ │  │
│  │  │  - notifications (user notifications)          │ │  │
│  │  │  - reports (moderation)                        │ │  │
│  │  │  - invite_codes (invite system)                │ │  │
│  │  │  - coin_images (image metadata)                │ │  │
│  │  └────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Supabase Features                                    │  │
│  │  - Automatic backups                                  │  │
│  │  - Connection pooling                                 │  │
│  │  - Performance monitoring                             │  │
│  │  - Table Editor (view/edit data)                     │  │
│  │  - SQL Editor (run queries)                          │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow Example: Adding a Coin

```
1. USER ACTION
   User taps "Add Coin" button
   ↓

2. FRONTEND
   - Validates form data
   - Calls: authenticatedFetch('/api/coins', { method: 'POST', body: coinData })
   ↓

3. BACKEND
   - Receives POST /api/coins request
   - Validates auth token (Better Auth)
   - Validates coin data
   - Calls: db.insert(coins).values({ ...coinData, userId })
   ↓

4. DRIZZLE ORM
   - Converts to SQL: INSERT INTO coins (title, country, year, ...) VALUES (...)
   - Sends to Supabase
   ↓

5. SUPABASE
   - Executes SQL query
   - Stores coin in database
   - Returns success
   ↓

6. BACKEND
   - Receives success from database
   - Returns coin data to frontend
   ↓

7. FRONTEND
   - Receives coin data
   - Updates UI
   - Shows success message
   ↓

8. USER
   - Sees new coin in their collection
```

## Authentication Flow

```
1. USER SIGNS UP
   ↓
2. FRONTEND
   - Calls: POST /api/auth/signup
   ↓
3. BACKEND (Better Auth)
   - Hashes password
   - Creates user in database
   - Creates session
   - Returns session token
   ↓
4. FRONTEND
   - Stores session token
   - Redirects to profile setup
   ↓
5. USER CREATES PROFILE
   ↓
6. FRONTEND
   - Calls: POST /api/profiles
   ↓
7. BACKEND
   - Validates session token
   - Creates profile in database
   - Returns profile data
   ↓
8. FRONTEND
   - Stores user data
   - Redirects to feed
```

## Trade Flow

```
1. USER A proposes trade
   ↓
2. BACKEND creates trade record
   ↓
3. USER B receives notification
   ↓
4. USER B accepts/rejects/counters
   ↓
5. If accepted:
   - Trade status → "accepted"
   - Both users exchange addresses
   - Users mark items as shipped
   - Users mark items as received
   - Users rate each other
   ↓
6. Trade complete!
```

## Technology Stack

### Frontend
- **Framework**: React Native (via Expo)
- **Routing**: Expo Router (file-based)
- **State**: React Context + useState/useEffect
- **Styling**: StyleSheet (React Native)
- **Auth**: Better Auth client
- **HTTP**: Fetch API (via utils/api.ts)

### Backend
- **Framework**: Fastify (Node.js)
- **Language**: TypeScript
- **ORM**: Drizzle ORM
- **Auth**: Better Auth
- **Validation**: Zod
- **Storage**: Specular (for images)

### Database
- **Type**: PostgreSQL
- **Host**: Supabase
- **ORM**: Drizzle
- **Migrations**: Drizzle Kit

## File Structure

```
coinhub/
├── app/                          # Frontend screens
│   ├── (tabs)/                   # Tab navigation
│   │   ├── (home)/              # Feed screen
│   │   ├── profile.tsx          # Profile screen
│   │   └── trades.tsx           # Trades screen
│   ├── coin-detail.tsx          # Coin detail screen
│   ├── trade-detail.tsx         # Trade detail screen
│   └── ...
├── components/                   # Reusable components
├── contexts/                     # React contexts
│   └── AuthContext.tsx          # Auth state
├── utils/                        # Utilities
│   └── api.ts                   # API client
├── backend/                      # Backend server
│   ├── src/
│   │   ├── routes/              # API routes
│   │   │   ├── auth.ts          # Auth endpoints
│   │   │   ├── coins.ts         # Coin endpoints
│   │   │   ├── trades.ts        # Trade endpoints
│   │   │   └── ...
│   │   ├── db/
│   │   │   ├── schema.ts        # Database schema
│   │   │   └── migrate.ts       # Migration runner
│   │   └── index.ts             # Server entry point
│   ├── .env                     # Environment variables (YOU CREATE THIS)
│   └── package.json
└── docs/                         # Documentation
```

## Environment Variables

### Backend (.env)
```env
DATABASE_URL=postgresql://...     # Supabase connection string
NODE_ENV=development              # Environment
FRONTEND_URL=http://localhost:3000 # Frontend URL
EMAIL_PROVIDER=console            # Email provider
EMAIL_FROM=noreply@coinhub.app   # Email sender
STORAGE_API_BASE_URL=...         # Storage URL
```

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Create account
- `POST /api/auth/login` - Log in
- `POST /api/auth/logout` - Log out
- `GET /api/auth/session` - Get current session

### Profiles
- `GET /api/profiles/me` - Get my profile
- `GET /api/profiles/:username` - Get user profile
- `PUT /api/profiles/me` - Update my profile

### Coins
- `GET /api/coins` - Get my coins
- `GET /api/coins/:id` - Get coin detail
- `POST /api/coins` - Create coin
- `PUT /api/coins/:id` - Update coin
- `DELETE /api/coins/:id` - Delete coin

### Trades
- `GET /api/trades` - Get my trades
- `GET /api/trades/:id` - Get trade detail
- `POST /api/trades` - Create trade
- `POST /api/trades/:id/offers` - Make offer
- `PUT /api/trades/:id/offers/:offerId/accept` - Accept offer
- `POST /api/trades/:id/shipping/address` - Submit address
- `POST /api/trades/:id/ratings` - Rate trade partner

### Feed
- `GET /api/feed` - Get public coin feed
- `GET /api/feed/trade` - Get tradeable coins

### Social
- `POST /api/likes` - Like a coin
- `DELETE /api/likes/:id` - Unlike a coin
- `POST /api/comments` - Comment on coin
- `POST /api/follows` - Follow user
- `DELETE /api/follows/:id` - Unfollow user

## Security

### Authentication
- Better Auth handles password hashing
- Sessions stored in database
- Tokens sent via HTTP headers

### Authorization
- All endpoints check user ownership
- Can only edit/delete own content
- Trade endpoints verify both parties

### Data Validation
- Zod schemas validate all inputs
- SQL injection prevented by Drizzle ORM
- XSS prevented by React Native

## Scalability

### Current Setup (Development)
- Backend runs locally
- Database in Supabase cloud
- Good for: Development, beta testing

### Production Setup (Future)
- Backend deployed to cloud (Vercel, Railway, etc.)
- Database in Supabase cloud
- CDN for images
- Good for: Thousands of users

## Monitoring

### Supabase Dashboard
- View all data
- Run SQL queries
- Monitor performance
- Check logs

### Backend Logs
- Request/response logging
- Error tracking
- Performance metrics

## Backup & Recovery

### Automatic Backups
- Supabase backs up daily
- 7-day retention (free tier)
- Point-in-time recovery (paid tier)

### Manual Backups
- Export via Supabase dashboard
- Export via pg_dump command
- Export to SQL, CSV, or JSON

## Summary

**Architecture**: Three-tier (Frontend, Backend, Database)

**Frontend**: React Native (Expo) - User interface

**Backend**: Fastify (Node.js) - Business logic & API

**Database**: PostgreSQL (Supabase) - Data storage

**Connection**: Backend connects to Supabase via DATABASE_URL

**Result**: Scalable, secure, production-ready app! 🚀
