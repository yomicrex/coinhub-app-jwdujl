# Frontend Session Integration Guide

## Quick Start

### The Critical Fix - Add `credentials: 'include'`

```javascript
// ❌ BEFORE - Sessions don't work
fetch('http://localhost:3000/api/auth/me')

// ✅ AFTER - Sessions work
fetch('http://localhost:3000/api/auth/me', {
  credentials: 'include'  // Include cookies with request
})
```

---

## Complete Implementation

### Step 1: Configure Fetch Defaults

Create an API client with credentials enabled:

```javascript
// api-client.js or similar
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

export const apiFetch = async (endpoint, options = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;

  const defaultOptions = {
    credentials: 'include',  // 👈 CRITICAL - Include cookies
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  };

  const config = {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...options.headers,
    },
  };

  const response = await fetch(url, config);

  if (!response.ok) {
    throw new Error(`API Error: ${response.status}`);
  }

  return response.json();
};

// Usage
await apiFetch('/api/auth/me');  // Works!
```

### Step 2: Sign-In Implementation

```javascript
const handleSignIn = async (email, password) => {
  try {
    const response = await apiFetch('/api/auth/sign-in/username-email', {
      method: 'POST',
      body: JSON.stringify({
        identifier: email,
        password: password,
      }),
    });

    // Response includes:
    // {
    //   "user": { id, email, username, ... },
    //   "session": { token, expiresAt }
    // }

    console.log('Sign-in successful!');
    console.log('User:', response.user);

    // Optional: Store session token as backup
    if (response.session?.token) {
      localStorage.setItem('sessionToken', response.session.token);
    }

    // Browser cookie is automatically set by server
    // No need to manually store it

    return response.user;
  } catch (error) {
    console.error('Sign-in failed:', error);
    throw error;
  }
};
```

### Step 3: Session Verification

```javascript
const getSession = async () => {
  try {
    // This request will include cookies automatically
    // because we have credentials: 'include'
    const response = await apiFetch('/api/auth/me');

    console.log('Session valid!');
    console.log('User profile:', response.profile);

    return response;
  } catch (error) {
    if (error.message.includes('401')) {
      console.log('Session invalid - not authenticated');
      // Redirect to login
    }
    throw error;
  }
};

// Usage
useEffect(() => {
  getSession()
    .then(data => setUser(data.user))
    .catch(() => setUser(null));
}, []);
```

### Step 4: Protected Routes

```javascript
import { useEffect, useState } from 'react';

const ProtectedRoute = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const response = await apiFetch('/api/auth/me');
        setUser(response.user);
      } catch (error) {
        setUser(null);
        // Redirect to login
      } finally {
        setLoading(false);
      }
    };

    checkSession();
  }, []);

  if (loading) return <div>Loading...</div>;
  if (!user) return <Navigate to="/login" />;

  return children;
};
```

### Step 5: Sign-Out Implementation

```javascript
const handleSignOut = async () => {
  try {
    // Clear local storage
    localStorage.removeItem('sessionToken');

    // Sign out from server (clears session)
    await apiFetch('/api/auth/sign-out', {
      method: 'POST',
    });

    // Redirect to login
    window.location.href = '/login';
  } catch (error) {
    console.error('Sign-out failed:', error);
    // Still redirect even if server call fails
    window.location.href = '/login';
  }
};
```

---

## React Hooks Implementation

### Custom Hook: useAuth

```javascript
import { useEffect, useState, useCallback } from 'react';

export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const checkSession = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiFetch('/api/auth/me');
      setUser(response.user);
      setError(null);
    } catch (err) {
      setUser(null);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const signIn = useCallback(async (email, password) => {
    try {
      setLoading(true);
      const response = await apiFetch('/api/auth/sign-in/username-email', {
        method: 'POST',
        body: JSON.stringify({ identifier: email, password }),
      });
      setUser(response.user);
      setError(null);
      return response.user;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await apiFetch('/api/auth/sign-out', { method: 'POST' });
      setUser(null);
    } catch (err) {
      console.error('Sign-out error:', err);
    }
  }, []);

  // Check session on mount
  useEffect(() => {
    checkSession();
  }, [checkSession]);

  return {
    user,
    loading,
    error,
    signIn,
    signOut,
    checkSession,
    isAuthenticated: !!user,
  };
};

// Usage
const { user, loading, signIn, signOut, isAuthenticated } = useAuth();
```

### Usage in Components

```javascript
function Dashboard() {
  const { user, signOut, loading } = useAuth();

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <h1>Welcome, {user?.displayName}</h1>
      <p>Email: {user?.email}</p>
      <button onClick={signOut}>Sign Out</button>
    </div>
  );
}
```

---

## TypeScript Types

```typescript
interface User {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  bio?: string;
  location?: string;
  collectionPrivacy: 'public' | 'private';
  role: 'user' | 'moderator' | 'admin';
  createdAt: string;
  updatedAt: string;
}

interface Session {
  token: string;
  expiresAt: string;
}

interface SignInResponse {
  user: User;
  session: Session;
}

interface MeResponse {
  user: User;
  profile: User;
}
```

---

## Advanced: Using Authorization Header Fallback

If cookies don't work for some reason, use Authorization header:

```javascript
// Store token after signin
let authToken: string | null = null;

const handleSignIn = async (email: string, password: string) => {
  const response = await fetch('/api/auth/sign-in/username-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: email, password }),
  });

  const data = await response.json();
  authToken = data.session.token;  // Store token
  localStorage.setItem('authToken', authToken);  // Persist
  return data.user;
};

// Use token in requests
const apiFetchWithToken = async (endpoint: string, options = {}) => {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  // Add auth token if available
  const token = localStorage.getItem('authToken') || authToken;
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(endpoint, {
    ...options,
    credentials: 'include',  // Still include cookies
    headers,
  });

  if (response.status === 401) {
    // Clear token and redirect to login
    localStorage.removeItem('authToken');
    authToken = null;
    window.location.href = '/login';
  }

  return response.json();
};
```

---

## Testing Session Handling

### Test 1: Verify Cookies Work

```javascript
async function testCookies() {
  // Sign in
  const signInResponse = await apiFetch('/api/auth/sign-in/username-email', {
    method: 'POST',
    body: JSON.stringify({
      identifier: 'user@example.com',
      password: 'password123',
    }),
  });

  console.log('✅ Sign-in successful');
  console.log('Session token:', signInResponse.session.token);

  // Immediately check session
  const meResponse = await apiFetch('/api/auth/me');

  console.log('✅ Session valid');
  console.log('User:', meResponse.user.email);

  return true;
}

testCookies().catch(console.error);
```

### Test 2: Debug Session Status

```javascript
async function debugSession() {
  const response = await apiFetch('/api/auth/debug/session');

  console.log('Session Status:', response.status);
  console.log('Cookies Present:', response.cookies);
  console.log('Has Cookie:', response.hasCookie);

  return response;
}

debugSession();
```

---

## Common Issues & Solutions

### Issue 1: "Session validation failed - no active session"
**Symptom:** Sign-in works, but `/api/auth/me` returns 401

**Solution:** Add `credentials: 'include'` to fetch requests

```javascript
// ❌ Wrong
fetch('/api/auth/me')

// ✅ Correct
fetch('/api/auth/me', { credentials: 'include' })
```

### Issue 2: Cookie not being sent in cross-origin requests
**Symptom:** Works on localhost, fails on deployed app

**Solution:** Use Authorization header as fallback

```javascript
const token = localStorage.getItem('sessionToken');
fetch('/api/auth/me', {
  credentials: 'include',  // Try cookies first
  headers: {
    'Authorization': `Bearer ${token}`  // Fallback to header
  }
})
```

### Issue 3: Session expires immediately
**Symptom:** Session works once, then 401 on next request

**Possible Causes:**
- Browser not accepting cookies
- CORS issue preventing cookie storage
- Session validation error

**Solution:**
1. Check browser DevTools → Application → Cookies
2. Verify `session` cookie is present
3. Check if `HttpOnly` flag is set (should be)
4. Use `/api/auth/debug/session` endpoint to diagnose

---

## Environment Configuration

### Development (.env.local)
```
REACT_APP_API_URL=http://localhost:3000
REACT_APP_CREDENTIALS=include
```

### Production (.env.production)
```
REACT_APP_API_URL=https://api.example.com
REACT_APP_CREDENTIALS=include
```

---

## Complete Example: Login Flow

```javascript
import React, { useState } from 'react';
import { useAuth } from './hooks/useAuth';

export const LoginPage = () => {
  const { signIn, loading, error } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await signIn(email, password);
      // useAuth hook redirects automatically on success
      // OR navigate programmatically
      // navigate('/dashboard');
    } catch (err) {
      console.error('Login failed:', err);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        required
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        required
      />
      <button type="submit" disabled={loading}>
        {loading ? 'Signing in...' : 'Sign In'}
      </button>
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </form>
  );
};
```

---

## Summary

### Essential Steps
1. ✅ Add `credentials: 'include'` to ALL fetch requests
2. ✅ Create API client wrapper with credentials enabled
3. ✅ Store session token from response (optional fallback)
4. ✅ Check session on app load
5. ✅ Handle 401 errors (session expired)

### What NOT to Do
- ❌ Don't manually set cookies (browser does it)
- ❌ Don't forget `credentials: 'include'`
- ❌ Don't assume cookies work without checking

### Testing
- Test with `/api/auth/debug/session` endpoint
- Check browser DevTools for cookies
- Verify credentials are being sent

Ready to integrate! Follow the steps above and sessions will work properly.
