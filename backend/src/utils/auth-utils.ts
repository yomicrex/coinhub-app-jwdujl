import type { FastifyRequest, FastifyReply } from 'fastify';
import type { App } from '../index.js';
import { eq } from 'drizzle-orm';
import * as authSchema from '../db/auth-schema.js';

/**
 * Helper function to extract session token from either:
 * 1. Authorization header: Bearer <token>
 * 2. Cookie header: session=<token> or better-auth.session_token=<token>
 *
 * Supports both web browsers (cookies) and React Native (Authorization header)
 *
 * Priority:
 * 1. Authorization header (explicit token for React Native)
 * 2. better-auth.session_token cookie (Better Auth's session cookie)
 * 3. session cookie (fallback for backward compatibility)
 *
 * @param request Fastify request object
 * @returns Session token string or null if not found
 */
export function extractSessionToken(request: FastifyRequest): string | null {
  // First try Authorization header (React Native / explicit token)
  const authHeader = request.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    if (token) return token;
  }

  // Fall back to cookie header (web browsers)
  const cookieHeader = request.headers.cookie || '';

  if (!cookieHeader) {
    return null;
  }

  // Parse cookie header - look for session cookies
  // Better Auth uses "better-auth.session_token" or "session" cookies
  const cookies = cookieHeader.split(';');
  for (const cookie of cookies) {
    const trimmed = cookie.trim();

    // Check for better-auth.session_token first (Better Auth's official cookie name)
    if (trimmed.startsWith('better-auth.session_token=')) {
      const value = trimmed.substring('better-auth.session_token='.length).trim();
      if (value) return value;
    }

    // Fall back to session cookie for backward compatibility
    if (trimmed.startsWith('session=')) {
      const value = trimmed.substring('session='.length).trim();
      if (value) return value;
    }
  }

  return null;
}

/**
 * Validates session by extracting token and looking it up in the database
 * Also validates that the session hasn't expired
 *
 * @param request Fastify request object
 * @param app App instance
 * @returns Session object with user data, or null if invalid/expired
 */
export async function validateSession(
  request: FastifyRequest,
  app: App
): Promise<{ user: { id: string; email: string }; session: any } | null> {
  const sessionToken = extractSessionToken(request);

  if (!sessionToken) {
    return null;
  }

  try {
    // Look up session in database
    const sessionRecord = await app.db.query.session.findFirst({
      where: eq(authSchema.session.token, sessionToken),
    });

    if (!sessionRecord) {
      return null;
    }

    // Check if session is expired
    if (new Date(sessionRecord.expiresAt) < new Date()) {
      return null;
    }

    // Get user record
    const userRecord = await app.db.query.user.findFirst({
      where: eq(authSchema.user.id, sessionRecord.userId),
    });

    if (!userRecord) {
      return null;
    }

    return {
      user: {
        id: userRecord.id,
        email: userRecord.email,
      },
      session: sessionRecord,
    };
  } catch {
    return null;
  }
}
