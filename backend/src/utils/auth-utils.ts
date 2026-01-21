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
 * Validates session using Better Auth's built-in session validation
 * (which correctly handles token hashing)
 *
 * This function wraps app.requireAuth() to provide a non-middleware validation method
 * suitable for use inside route handlers that need manual validation
 *
 * @param request Fastify request object
 * @param app App instance
 * @returns Session object with user data, or null if invalid/expired
 */
export async function validateSession(
  request: FastifyRequest,
  app: App
): Promise<{ user: { id: string; email: string; name?: string }; session?: any } | null> {
  try {
    // Use Better Auth's built-in session validation (handles token hashing correctly)
    const requireAuth = app.requireAuth();

    // Create a mock reply object to capture the status code and send behavior
    let statusCode = 500;
    let responded = false;
    let responseData: any = null;

    const reply = {
      status: (code: number) => {
        statusCode = code;
        return {
          send: (data: any) => {
            responded = true;
            responseData = data;
          }
        };
      }
    } as any;

    const result = await requireAuth(request, reply);

    // If requireAuth returned a user session, return it
    if (result && result.user) {
      return {
        user: {
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
        },
        session: result,
      };
    }

    // If no result or status was 401, session is invalid
    return null;
  } catch (error) {
    // Any error during validation means session is invalid
    return null;
  }
}
