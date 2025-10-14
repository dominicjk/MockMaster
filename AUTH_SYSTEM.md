# Authentication System - Session-Based with PostgreSQL

## Overview
This authentication system uses **bcrypt** for password hashing and **express-session** with **connect-pg-simple** for persistent session storage in PostgreSQL.

## Features
- ✅ User signup with password hashing (bcrypt)
- ✅ Secure login with session management
- ✅ Session persistence in PostgreSQL database
- ✅ Password validation (minimum 8 characters)
- ✅ Email format validation
- ✅ Automatic last login tracking
- ✅ Secure password updates
- ✅ Session-based authentication check

## Installation

1. **Install dependencies:**
```bash
cd backend
npm install
```

New packages installed:
- `bcrypt` - Password hashing
- `pg` - PostgreSQL client
- `connect-pg-simple` - PostgreSQL session store

2. **Configure environment variables in `backend/.env`:**
```bash
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=your_database_name

# Session Secret (change in production!)
SESSION_SECRET=your-super-secret-session-key-change-in-production
```

3. **Ensure your database has the users table:**
Your existing schema is already set up:
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    role VARCHAR(50) DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);
```

The `session` table will be created automatically by connect-pg-simple.

## API Endpoints

All auth endpoints are available at `/api/user-auth`:

### 1. **Signup** - Create a new account
```http
POST /api/user-auth/signup

Request Body:
{
  "email": "user@example.com",
  "password": "securePassword123",
  "firstName": "John",      // optional
  "lastName": "Doe",        // optional
  "role": "user"            // optional, defaults to 'user'
}

Response (201):
{
  "message": "User created successfully",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "user",
    "createdAt": "2025-10-11T..."
  }
}
```

### 2. **Login** - Authenticate and create session
```http
POST /api/user-auth/login

Request Body:
{
  "email": "user@example.com",
  "password": "securePassword123"
}

Response (200):
{
  "message": "Login successful",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "user",
    "lastLogin": "2025-10-11T..."
  }
}
```

### 3. **Get Current User** - Fetch logged-in user info
```http
GET /api/user-auth/me

Response (200):
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "user",
    "createdAt": "2025-10-11T...",
    "lastLogin": "2025-10-11T..."
  }
}
```

### 4. **Logout** - Destroy session
```http
POST /api/user-auth/logout

Response (200):
{
  "message": "Logged out successfully"
}
```

### 5. **Update Password** - Change password (requires authentication)
```http
PUT /api/user-auth/password

Request Body:
{
  "currentPassword": "oldPassword123",
  "newPassword": "newSecurePassword456"
}

Response (200):
{
  "message": "Password updated successfully"
}
```

### 6. **Check Authentication Status**
```http
GET /api/user-auth/check

Response (200):
{
  "authenticated": true,
  "userId": "uuid"
}
```

## Session Management

- **Session Duration:** 7 days
- **Storage:** PostgreSQL (persistent across server restarts)
- **Cookie Settings:**
  - `httpOnly: true` - Prevents JavaScript access
  - `secure: true` in production (HTTPS only)
  - `sameSite` protection enabled

## Security Features

1. **Password Hashing:**
   - bcrypt with 10 salt rounds
   - Passwords never stored in plain text

2. **Session Security:**
   - HttpOnly cookies prevent XSS attacks
   - Secure flag in production (HTTPS only)
   - Sessions stored in PostgreSQL, not memory

3. **Validation:**
   - Email format validation
   - Minimum password length (8 characters)
   - Duplicate email prevention

## Usage Example (Frontend)

```javascript
// Signup
const signup = async () => {
  const response = await fetch('http://localhost:3001/api/user-auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include', // Important for cookies!
    body: JSON.stringify({
      email: 'user@example.com',
      password: 'password123',
      firstName: 'John',
      lastName: 'Doe'
    })
  });
  const data = await response.json();
  console.log(data);
};

// Login
const login = async () => {
  const response = await fetch('http://localhost:3001/api/user-auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      email: 'user@example.com',
      password: 'password123'
    })
  });
  const data = await response.json();
  console.log(data);
};

// Get current user
const getCurrentUser = async () => {
  const response = await fetch('http://localhost:3001/api/user-auth/me', {
    credentials: 'include'
  });
  const data = await response.json();
  console.log(data);
};

// Logout
const logout = async () => {
  const response = await fetch('http://localhost:3001/api/user-auth/logout', {
    method: 'POST',
    credentials: 'include'
  });
  const data = await response.json();
  console.log(data);
};
```

## Testing

Start the server:
```bash
cd backend
npm run dev
```

You should see:
```
✅ Connected to PostgreSQL database
✅ Database connection test successful
🚀 Backend server running on http://localhost:3001
🔑 Session Auth endpoints: /api/user-auth (signup/login)
```

## Error Handling

Common error responses:

- **400 Bad Request** - Missing or invalid input
- **401 Unauthorized** - Invalid credentials or not authenticated
- **404 Not Found** - User not found
- **409 Conflict** - Email already exists
- **500 Internal Server Error** - Server/database error

## Notes

- Sessions are stored in a `session` table in PostgreSQL (auto-created)
- The system co-exists with the existing JWT auth system at `/api/auth`
- Always use `credentials: 'include'` in frontend fetch requests
- Session cookies are automatically sent with subsequent requests
