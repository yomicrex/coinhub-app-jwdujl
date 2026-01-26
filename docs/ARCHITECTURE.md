
# 🏗️ CoinHub Architecture

## Current Setup (with Supabase)

```
┌─────────────────────────────────────────────────────────────┐
│                     FRONTEND (Expo App)                      │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐            │
│  │   React    │  │   Expo     │  │  Better    │            │
│  │  Native    │  │   Router   │  │   Auth     │            │
│  └────────────┘  └────────────┘  └────────────┘            │
│         │                │                │                  │
│         └────────────────┴────────────────┘                  │
│                          │                                   │
│                          ▼                                   │
│                  ┌──────────────┐                           │
│                  │  utils/api.ts │                           │
│                  │ (API Client)  │                           │
│                  └──────────────┘                           │
└──────────────────────────│──────────────────────────────────┘
                           │
                           │ HTTP Requests
                           │ (Bearer Token Auth)
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                  BACKEND (Fastify Server)                    │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐            │
│  │  Fastify   │  │  Drizzle   │  │  Better    │            │
│  │   Routes   │  │    ORM     │  │   Auth     │            │
│  └────────────┘  └────────────┘  └────────────┘            │
│         │                │                │                  │
│         └────────────────┴────────────────┘                  │
│                          │                                   │
│                          │ SQL Queries                       │
│                          ▼                                   │
└─────────────────────────────────────────────────────────────┘
                           │
                           │ PostgreSQL Protocol
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    SUPABASE (Database)                       │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              PostgreSQL Database                        │ │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │ │
│  │  │  users   │ │ profiles │ │  coins   │ │  trades  │ │ │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ │ │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │ │
│  │  │ comments │ │  likes   │ │ follows  │ │  reports │ │ │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  Features:                                                   │
│  ✓ Automatic backups                                        │
│  ✓ Real-time subscriptions (not used yet)                   │
│  ✓ Connection pooling                                       │
│  ✓ Table Editor UI                                          │
│  ✓ SQL Editor                                               │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow Example: Creating a Coin

```
1. User taps "Add Coin" button
   └─> app/add-coin.tsx

2. User fills form and submits
   └─> Calls authenticatedUpload()
       └─> utils/api.ts

3. API client adds Bearer token
   └─> POST /api/coins/upload
       └─> backend/src/routes/coins.ts

4. Backend validates auth token
   └─> Extracts user ID from session
       └─> backend/src/utils/auth-utils.ts

5. Backend saves to database
   └─> Drizzle ORM generates SQL
       └─> INSERT INTO coins (...)
           └─> Supabase PostgreSQL

6. Response sent back to frontend
   └─> Coin data returned
       └─> UI updates with new coin
```

## Authentication Flow

```
1. User enters email/password
   └─> app/auth.tsx

2. Frontend calls Better Auth
   └─> lib/auth.ts
       └─> authClient.signIn.email()

3. Better Auth creates session
   └─> Stores in Supabase 'session' table
       └─> Returns session token

4. Token stored locally
   └─> SecureStore (mobile)
   └─> localStorage (web)

5. All API requests include token
   └─> Authorization: Bearer <token>
       └─> Backend validates token
           └─> Extracts user ID
               └─> Allows/denies request
```

## File Structure

```
CoinHub/
├── app/                          # Frontend screens
│   ├── (tabs)/                   # Tab navigation
│   │   ├── (home)/              # Home feed
│   │   ├── profile.tsx          # User profile
│   │   └── trades.tsx           # Trades inbox
│   ├── auth.tsx                 # Login/signup
│   ├── coin-detail.tsx          # Coin details
│   ├── trade-detail.tsx         # Trade conversation
│   └── ...
├── components/                   # Reusable components
├── contexts/                     # React contexts
│   └── AuthContext.tsx          # Auth state management
├── lib/                         # Libraries
│   └── auth.ts                  # Better Auth client
├── utils/                       # Utilities
│   └── api.ts                   # API client
├── backend/                     # Backend server
│   ├── src/
│   │   ├── routes/              # API endpoints
│   │   │   ├── auth.ts         # Auth endpoints
│   │   │   ├── coins.ts        # Coin endpoints
│   │   │   ├── trades.ts       # Trade endpoints
│   │   │   └── ...
│   │   ├── db/                  # Database
│   │   │   ├── schema.ts       # App tables
│   │   │   └── auth-schema.ts  # Auth tables
│   │   └── index.ts            # Server entry
│   └── .env                     # Environment variables
└── docs/                        # Documentation
    ├── SUPABASE_QUICK_START.md # This guide!
    └── ...
```

## Key Components

### Frontend
- **Expo Router**: File-based navigation
- **Better Auth Client**: Authentication
- **API Client**: HTTP requests with auth
- **React Context**: Global state (user, auth)

### Backend
- **Fastify**: Web framework
- **Drizzle ORM**: Database queries
- **Better Auth**: Session management
- **Multipart**: File uploads

### Database (Supabase)
- **PostgreSQL**: Relational database
- **Tables**: Users, coins, trades, etc.
- **Indexes**: Fast queries
- **Backups**: Automatic

## What Changed with Supabase?

### Before (Local Database)
```
Backend → PGlite (local SQLite-like DB)
```

### After (Supabase)
```
Backend → Supabase PostgreSQL (cloud)
```

### What Stayed the Same?
- ✅ All frontend code
- ✅ All backend code
- ✅ All API endpoints
- ✅ Authentication system
- ✅ File uploads

### What Changed?
- ✅ Database location (now in cloud)
- ✅ One environment variable (DATABASE_URL)

## Benefits of This Architecture

### Separation of Concerns
- Frontend: UI and user interaction
- Backend: Business logic and validation
- Database: Data storage and queries

### Security
- Backend validates all requests
- Database credentials never exposed to frontend
- Row-level security possible with Supabase

### Scalability
- Backend can be deployed separately
- Database can scale independently
- Frontend can be static (CDN)

### Flexibility
- Can switch databases easily (just change DATABASE_URL)
- Can add real-time features later (Supabase subscriptions)
- Can migrate to full Supabase if needed

## Alternative: Full Supabase Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     FRONTEND (Expo App)                      │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐            │
│  │   React    │  │   Expo     │  │  Supabase  │            │
│  │  Native    │  │   Router   │  │   Client   │            │
│  └────────────┘  └────────────┘  └────────────┘            │
│         │                │                │                  │
│         └────────────────┴────────────────┘                  │
│                          │                                   │
│                          │ Direct queries                    │
│                          ▼                                   │
└─────────────────────────────────────────────────────────────┘
                           │
                           │ HTTPS + PostgREST
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                         SUPABASE                             │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐            │
│  │ PostgreSQL │  │ Supabase   │  │  Storage   │            │
│  │  Database  │  │    Auth    │  │  (Files)   │            │
│  └────────────┘  └────────────┘  └────────────┘            │
└─────────────────────────────────────────────────────────────┘

No backend server needed!
```

See `SUPABASE_FULL_MIGRATION.md` for details.

## Recommendation

**For CoinHub, stick with current architecture** because:
1. ✅ Backend already built and working
2. ✅ Complex trade logic easier to maintain in backend
3. ✅ Moderation features need server-side validation
4. ✅ Minimal changes to connect to Supabase
5. ✅ Can always migrate to full Supabase later

## Questions?

- **"Do I need to change my frontend code?"** No! Just update backend .env
- **"Will my app work offline?"** No, it needs internet (same as before)
- **"Can I use Supabase real-time?"** Yes, but requires code changes
- **"Is my data secure?"** Yes, backend validates all requests
- **"Can I see my data?"** Yes, in Supabase Table Editor
