# Session Management API Examples

## Quick Reference

### Email-Only Signin
```
POST /api/auth/email/signin
Content-Type: application/json

Request:
{
  "email": "user@example.com"
}

Response (200):
{
  "user": {
    "id": "user_abc123",
    "email": "user@example.com",
    "name": "John Doe"
  },
  "session": {
    "token": "550e8400-e29b-41d4-a716-446655440000",
    "expiresAt": "2024-01-22T10:30:00Z"
  }
}

Also sets:
Set-Cookie: session=550e8400-e29b-41d4-a716-446655440000; HttpOnly; Path=/; SameSite=Lax; Max-Age=604800; Secure (production only)
```

### Retrieve Session
```
GET /api/auth/session
Cookie: session=550e8400-e29b-41d4-a716-446655440000

Response (200):
{
  "user": {
    "id": "user_abc123",
    "email": "user@example.com",
    "name": "John Doe",
    "emailVerified": false,
    "image": null,
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  },
  "session": {
    "id": "session_123abc",
    "token": "550e8400-e29b-41d4-a716-446655440000",
    "expiresAt": "2024-01-22T10:30:00Z",
    "createdAt": "2024-01-15T10:30:00Z",
    "ipAddress": "192.168.1.100",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)..."
  }
}

If no session:
{
  "user": null,
  "session": null
}
```

---

## JavaScript/Fetch Examples

### Example 1: Basic Email-Only Login

```javascript
async function emailLogin(email) {
  // Step 1: Send email to signin endpoint
  const response = await fetch('/api/auth/email/signin', {
    method: 'POST',
    credentials: 'include',  // ⚠️ Important: Include cookies
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email })
  });

  if (!response.ok) {
    throw new Error('Login failed');
  }

  const data = await response.json();

  // Step 2: Session cookie is automatically set and stored by browser
  // No manual action needed!

  console.log('Logged in as:', data.user.name);
  console.log('Session expires at:', data.session.expiresAt);

  return data.user;
}

// Usage
emailLogin('user@example.com')
  .then(user => console.log('Welcome', user.name))
  .catch(err => console.error('Login error:', err));
```

### Example 2: Check if User is Logged In

```javascript
async function checkSession() {
  // Retrieves session from cookie automatically
  const response = await fetch('/api/auth/session', {
    credentials: 'include'  // ⚠️ Important: Include cookies
  });

  const data = await response.json();

  if (data.user) {
    console.log('User is logged in:', data.user.email);
    return data.user;
  } else {
    console.log('User is not logged in');
    return null;
  }
}

// Usage
checkSession().then(user => {
  if (user) {
    // Redirect to dashboard
    window.location.href = '/dashboard';
  } else {
    // Show login page
    window.location.href = '/login';
  }
});
```

### Example 3: Page Load - Auto-Login If Session Exists

```javascript
// In your app initialization (e.g., main.tsx or App.tsx)

async function initializeAuth() {
  try {
    const user = await checkSession();

    if (user) {
      // User has valid session
      store.commit('setUser', user);
      store.commit('setIsAuthenticated', true);
    } else {
      // No valid session, redirect to login
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
  } catch (error) {
    console.error('Auth initialization error:', error);
    window.location.href = '/login';
  }
}

// Call on app startup
initializeAuth();
```

### Example 4: Complete Login Flow with Error Handling

```javascript
async function loginWithEmail(email) {
  try {
    // Validate email format
    if (!email.includes('@')) {
      throw new Error('Invalid email format');
    }

    // Step 1: Attempt email-only signin
    console.log('Signing in...');
    const signinResponse = await fetch('/api/auth/email/signin', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });

    // Handle specific error codes
    if (signinResponse.status === 404) {
      throw new Error('No account found with this email address');
    }
    if (signinResponse.status === 403) {
      throw new Error('Your profile is not complete. Please contact support.');
    }
    if (signinResponse.status === 500) {
      throw new Error('Server error during signin. Please try again later.');
    }
    if (!signinResponse.ok) {
      throw new Error('Signin failed');
    }

    const signinData = await signinResponse.json();

    // Step 2: Verify session was created
    console.log('Verifying session...');
    const sessionResponse = await fetch('/api/auth/session', {
      credentials: 'include'
    });

    if (!sessionResponse.ok) {
      throw new Error('Failed to verify session');
    }

    const sessionData = await sessionResponse.json();

    // Step 3: Check if we actually got a session
    if (!sessionData.user || !sessionData.session) {
      throw new Error('Session was not established properly');
    }

    console.log('✅ Login successful!');
    console.log('User:', sessionData.user.name);
    console.log('Session expires:', sessionData.session.expiresAt);

    return {
      success: true,
      user: sessionData.user,
      session: sessionData.session
    };

  } catch (error) {
    console.error('❌ Login failed:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

// Usage with UI feedback
document.getElementById('login-btn').addEventListener('click', async () => {
  const email = document.getElementById('email-input').value;
  const result = await loginWithEmail(email);

  if (result.success) {
    // Show success message
    showNotification('✅ Login successful! Redirecting...', 'success');

    // Redirect to dashboard after 1 second
    setTimeout(() => {
      window.location.href = '/dashboard';
    }, 1000);
  } else {
    // Show error message
    showNotification(`❌ ${result.error}`, 'error');
  }
});
```

### Example 5: Logout Flow

```javascript
async function logout() {
  try {
    // Call logout endpoint
    const response = await fetch('/api/auth/sign-out', {
      method: 'POST',
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error('Logout failed');
    }

    // Clear local storage/state
    localStorage.removeItem('user');
    store.commit('clearUser');

    console.log('✅ Logged out successfully');

    // Redirect to login
    window.location.href = '/login';
  } catch (error) {
    console.error('❌ Logout error:', error);
    // Still redirect even if backend logout failed
    window.location.href = '/login';
  }
}

// Usage
document.getElementById('logout-btn').addEventListener('click', logout);
```

### Example 6: Axios Configuration

```javascript
import axios from 'axios';

// Create axios instance with cookies enabled
const apiClient = axios.create({
  baseURL: 'http://localhost:3000/api',
  withCredentials: true  // ⚠️ Important: Include cookies
});

// Add request interceptor for debugging
apiClient.interceptors.request.use(config => {
  console.log('Request:', config.method.toUpperCase(), config.url);
  return config;
});

// Add response interceptor for error handling
apiClient.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      console.warn('Session expired, redirecting to login');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Login example with axios
async function loginWithAxios(email) {
  try {
    const { data } = await apiClient.post('/auth/email/signin', { email });
    console.log('Login successful:', data.user);
    return data;
  } catch (error) {
    console.error('Login error:', error.response?.data);
    throw error;
  }
}

// Get session example with axios
async function getSessionWithAxios() {
  try {
    const { data } = await apiClient.get('/auth/session');
    return data;
  } catch (error) {
    console.error('Session error:', error.response?.data);
    throw error;
  }
}
```

### Example 7: React Hook for Session Management

```typescript
import { useEffect, useState } from 'react';

interface User {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  image: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Session {
  id: string;
  token: string;
  expiresAt: string;
  createdAt: string;
  ipAddress: string | null;
  userAgent: string | null;
}

interface UseSessionResult {
  user: User | null;
  session: Session | null;
  loading: boolean;
  error: Error | null;
  logout: () => Promise<void>;
}

export function useSession(): UseSessionResult {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Check session on mount and when it might have changed
  useEffect(() => {
    checkSession();

    // Set up interval to refresh session every 5 minutes
    const interval = setInterval(checkSession, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  async function checkSession() {
    try {
      setLoading(true);
      const response = await fetch('/api/auth/session', {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to check session');
      }

      const data = await response.json();
      setUser(data.user);
      setSession(data.session);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      setUser(null);
      setSession(null);
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    try {
      await fetch('/api/auth/sign-out', {
        method: 'POST',
        credentials: 'include'
      });
    } finally {
      setUser(null);
      setSession(null);
    }
  }

  return { user, session, loading, error, logout };
}

// Usage in component
function Dashboard() {
  const { user, session, loading, error } = useSession();

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (!user) return <div>Not logged in</div>;

  return (
    <div>
      <h1>Welcome, {user.name}!</h1>
      <p>Email: {user.email}</p>
      <p>Session expires: {new Date(session.expiresAt).toLocaleString()}</p>
    </div>
  );
}
```

### Example 8: Vue 3 Composition API

```typescript
import { ref, onMounted } from 'vue';

interface User {
  id: string;
  email: string;
  name: string;
}

interface Session {
  id: string;
  token: string;
  expiresAt: string;
}

export function useAuth() {
  const user = ref<User | null>(null);
  const session = ref<Session | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  async function checkSession() {
    isLoading.value = true;
    try {
      const response = await fetch('/api/auth/session', {
        credentials: 'include'
      });

      if (!response.ok) throw new Error('Session check failed');

      const data = await response.json();
      user.value = data.user;
      session.value = data.session;
      error.value = null;
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Unknown error';
      user.value = null;
      session.value = null;
    } finally {
      isLoading.value = false;
    }
  }

  async function emailLogin(email: string) {
    isLoading.value = true;
    try {
      const response = await fetch('/api/auth/email/signin', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      if (!response.ok) throw new Error('Login failed');

      const data = await response.json();
      user.value = data.user;
      session.value = data.session;
      error.value = null;
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Unknown error';
    } finally {
      isLoading.value = false;
    }
  }

  async function logout() {
    try {
      await fetch('/api/auth/sign-out', {
        method: 'POST',
        credentials: 'include'
      });
    } finally {
      user.value = null;
      session.value = null;
    }
  }

  onMounted(() => {
    checkSession();
  });

  return {
    user,
    session,
    isLoading,
    error,
    checkSession,
    emailLogin,
    logout
  };
}

// Usage in component
<template>
  <div v-if="isLoading">Loading...</div>
  <div v-else-if="error">Error: {{ error }}</div>
  <div v-else-if="user">
    <h1>Welcome, {{ user.name }}!</h1>
    <p>Session expires: {{ new Date(session.expiresAt).toLocaleString() }}</p>
    <button @click="logout">Logout</button>
  </div>
  <div v-else>
    <input v-model="email" type="email" placeholder="Enter email">
    <button @click="() => emailLogin(email)">Login</button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useAuth } from '@/composables/useAuth';

const email = ref('');
const { user, session, isLoading, error, emailLogin, logout } = useAuth();
</script>
```

---

## cURL Examples

### Email Login
```bash
curl -X POST http://localhost:3000/api/auth/email/signin \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com"}' \
  -c cookies.txt \
  -i
```

### Get Session (Using Saved Cookies)
```bash
curl -X GET http://localhost:3000/api/auth/session \
  -b cookies.txt \
  -i
```

### Get Session (Using Cookie Header Directly)
```bash
curl -X GET http://localhost:3000/api/auth/session \
  -H "Cookie: session=550e8400-e29b-41d4-a716-446655440000" \
  -i
```

### Logout
```bash
curl -X POST http://localhost:3000/api/auth/sign-out \
  -b cookies.txt \
  -i
```

---

## TypeScript Types

```typescript
export interface User {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  image: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Session {
  id: string;
  token: string;
  expiresAt: string;
  createdAt: string;
  ipAddress: string | null;
  userAgent: string | null;
}

export interface SigninResponse {
  user: User;
  session: Session;
}

export interface SessionResponse {
  user: User | null;
  session: Session | null;
}

export interface ErrorResponse {
  error: string;
  details?: any;
}
```

---

## Common Issues & Solutions

### Issue: Session Not Persisting
**Problem:** Session cookie not being set or sent
**Solution:** Ensure `credentials: 'include'` in fetch options
```javascript
// ❌ Wrong
fetch('/api/auth/email/signin', {
  method: 'POST',
  body: JSON.stringify({ email })
})

// ✅ Correct
fetch('/api/auth/email/signin', {
  method: 'POST',
  credentials: 'include',  // Include cookies!
  body: JSON.stringify({ email })
})
```

### Issue: "No account found" After Successful Signin
**Problem:** User doesn't have a complete profile in CoinHub users table
**Solution:** Call `POST /api/auth/complete-profile` after signin
```javascript
// After email signin
const signinData = await emailLogin(email);

// Complete profile if needed
if (!userHasProfile) {
  await fetch('/api/auth/complete-profile', {
    method: 'POST',
    credentials: 'include',
    body: JSON.stringify({
      username: 'johndoe',
      displayName: 'John Doe'
    })
  });
}
```

### Issue: CORS Error
**Problem:** Frontend and backend on different origins
**Solution:** Backend must allow credentials in CORS
```
Access-Control-Allow-Credentials: true
Access-Control-Allow-Origin: <frontend-url>
```

### Issue: Session Returns Null After Refresh
**Problem:** Page refresh loses in-memory user state
**Solution:** Call `GET /api/auth/session` on app initialization
```javascript
// App.tsx or main.tsx
useEffect(() => {
  // Check session on mount
  fetch('/api/auth/session', { credentials: 'include' })
    .then(r => r.json())
    .then(data => {
      if (data.user) {
        setUser(data.user);
      } else {
        redirectToLogin();
      }
    });
}, []);
```

---

## Summary

**Key Endpoints:**
- `POST /api/auth/email/signin` - Email-only login
- `GET /api/auth/session` - Retrieve current session
- `POST /api/auth/sign-out` - Logout

**Important:** Always use `credentials: 'include'` in fetch requests to send cookies automatically.

**Session Lifecycle:**
1. User calls email signin
2. Browser receives and stores session cookie
3. Frontend calls session endpoint to verify
4. Session persists across page refreshes (cookie sent automatically)
5. Session expires after 7 days or on explicit logout
