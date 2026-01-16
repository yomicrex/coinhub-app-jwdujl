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
3. **Password Recovery**: `POST /api/auth/request-password-reset` - Reset forgotten passwords with email

**Documentation**:
- `AUTHENTICATION_DEBUG_GUIDE.md` - Complete authentication flow and session management
- `AUTHENTICATION_API_REFERENCE.md` - Full endpoint reference with curl examples
- `AUTHENTICATION_VERIFICATION_CHECKLIST.md` - Verify setup and troubleshoot issues
- `AUTHENTICATION_TROUBLESHOOTING.md` - Fix common authentication problems
- `PASSWORD_RECOVERY_GUIDE.md` - Implement and debug password recovery

## Email Setup

Password reset emails are sent via **Resend**. To enable email functionality:

```bash
# 1. Get Resend API key from https://resend.com
# 2. Set environment variable
export RESEND_API_KEY=re_your_api_key_here

# 3. Start server
npm run dev
```

**Configuration**:
```bash
# Required
RESEND_API_KEY=re_your_api_key_here

# Optional (with defaults)
RESEND_FROM_EMAIL=noreply@coinhub.app      # From address
FRONTEND_URL=https://coinhub.app            # Reset link base URL
```

**See**: `.env.example` for example configuration

## Quick Email Setup

1. Get API key from https://resend.com
2. Set environment variable: `export RESEND_API_KEY=re_your_key`
3. Emails are automatically sent on password reset requests

**Optional Configuration**:
```bash
RESEND_FROM_EMAIL=noreply@coinhub.app      # Sender email
FRONTEND_URL=https://coinhub.app           # Reset link URL
```

**Verify Setup**:
```bash
npm run dev
# Look for: [INFO] Email service initialized
```

## Customization

- Add your API endpoints in `src/index.ts`
- Define your database schema in `src/db/schema.ts`
- Generate and apply migrations as needed
- See documentation files for feature-specific guides
- Customize email templates in `src/services/email.ts`
