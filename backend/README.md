## Getting Started

```bash
npm install
npm run dev
```

## Database

This template uses Neon (Postgres) for the database.

**After editing `src/db/schema.ts`, push your changes:**
```bash
npm run db:push
```

This command generates migration files and applies them to the database.

**Or run steps separately:**
```bash
# Generate migration files
npm run db:generate

# Apply migrations
npm run db:migrate
```

## Authentication

CoinHub uses **Better Auth** for email/password authentication with a two-step process:

1. **Sign-Up**: `POST /api/auth/sign-up/email` - Create account (auto-provided by Better Auth)
2. **Profile Completion**: `POST /api/auth/complete-profile` - Set username and profile details
3. **Password Recovery**: `POST /api/auth/request-password-reset` - Reset forgotten passwords

**Documentation**:
- `AUTHENTICATION_DEBUG_GUIDE.md` - Complete authentication flow and session management
- `AUTHENTICATION_API_REFERENCE.md` - Full endpoint reference with curl examples
- `AUTHENTICATION_VERIFICATION_CHECKLIST.md` - Verify setup and troubleshoot issues
- `AUTHENTICATION_TROUBLESHOOTING.md` - Fix common authentication problems
- `PASSWORD_RECOVERY_GUIDE.md` - Implement and debug password recovery

## Customization

- Add your API endpoints in `src/index.ts`
- Define your database schema in `src/db/schema.ts`
- Generate and apply migrations as needed
- See documentation files for feature-specific guides
