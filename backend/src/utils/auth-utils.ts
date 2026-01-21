import type { FastifyRequest, FastifyReply } from 'fastify';
import type { App } from '../index.js';
import { eq } from 'drizzle-orm';
import * as authSchema from '../db/auth-schema.js';

/**
 * Helper function to extract session token from either:
 * 1. Authorization header: Bearer <token>
 * 2. Cookie header: session=<token>
 *
 * Supports both web browsers (cookies) and React Native (Authorization header)
 *
 * Priority:
 * 1. Authorization header (explicit token for React Native)
 * 2. Session cookie (automatic for web browsers)
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

  // Parse cookie header - look for "session=" cookie
  // Handle both "session=value" and "session=value; Path=/" formats
  const cookies = cookieHeader.split(';');
  for (const cookie of cookies) {
    const trimmed = cookie.trim();
    if (trimmed.startsWith('session=')) {
      const value = trimmed.substring('session='.length).trim();
      if (value) return value;
    }
  }

  return null;
}

/**
 * Validates session token from cookies or Authorization header
 * and returns the user session object
 *
 * Replaces the requireAuth() middleware for manual session validation
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
