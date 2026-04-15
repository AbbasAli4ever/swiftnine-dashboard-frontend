# FocusHub — Frontend Integration Guide

**Base URL:** `http://localhost:3000/api/v1`  
**Swagger UI:** `http://localhost:3000/api/docs`  
**Content-Type:** `application/json` on all requests with a body

---

## Table of Contents

1. [Response Format](#1-response-format)
2. [Auth Flow & Token Management](#2-auth-flow--token-management)
3. [Error Handling](#3-error-handling)
4. [Auth Endpoints](#4-auth-endpoints)
   - [POST /auth/register](#post-authregister)
   - [POST /auth/login](#post-authlogin)
   - [GET /auth/google](#get-authgoogle)
   - [GET /auth/google/callback](#get-authgooglecallback)
   - [POST /auth/refresh](#post-authrefresh)
   - [POST /auth/logout](#post-authlogout)
   - [POST /auth/forgot-password](#post-authforgot-password)
   - [POST /auth/reset-password](#post-authreset-password)
5. [User Endpoints](#5-user-endpoints)
6. [Workspace Endpoints](#6-workspace-endpoints)
7. [Project Endpoints](#7-project-endpoints)
8. [System](#8-system)

---

## 1. Response Format

There are **two response shapes** in this API. Auth and User endpoints return bare objects (legacy pattern). Workspace and Project endpoints follow the standard contract wrapper.

### Standard Wrapper (Workspace + Project)

```json
{
  "success": true,
  "data": { ... },
  "message": "Human readable message or null"
}
```

For paginated lists:

```json
{
  "success": true,
  "data": [ ... ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "total_pages": 8,
    "has_next": true,
    "has_prev": false
  },
  "message": null
}
```

### Bare Response (Auth + User)

Auth and User endpoints return the data object directly — no `success` or `data` wrapper.

```json
{
  "accessToken": "eyJ...",
  "user": { ... }
}
```

---

## 2. Auth Flow & Token Management

### Token Architecture

| Token | Where | Lifetime | Purpose |
|---|---|---|---|
| Access token | Response body → memory | 15 min | Sent as `Authorization: Bearer <token>` on every protected request |
| Refresh token | `httpOnly` cookie (`refresh_token`) | 7 days | Used only on `POST /auth/refresh` to get a new access token |

**Never store the access token in `localStorage`.** Store it in memory (React state, Zustand, etc.). The browser automatically sends the refresh cookie on requests to the same origin.

### Token Refresh Strategy

When any request returns `401`, call `POST /auth/refresh` (the cookie is sent automatically). On success, store the new access token and retry the original request. On failure (cookie expired), redirect to login.

```
Request fails with 401
    → POST /auth/refresh
        → success: store new accessToken, retry original request
        → failure (401): clear state, redirect to /login
```

### Google OAuth Flow

1. Redirect the browser (full page navigation, not fetch) to `GET /api/v1/auth/google`
2. Google redirects back to `GET /api/v1/auth/google/callback` (handled server-side)
3. The server redirects to `<FRONTEND_URL>/auth/callback?token=<accessToken>` — read the `token` query param and store in memory
4. A `refresh_token` httpOnly cookie is set automatically — no extra handling needed

---

## 3. Error Handling

All errors follow this shape:

```json
{
  "statusCode": 401,
  "message": "Invalid or expired access token"
}
```

Validation errors (422) include field details:

```json
{
  "statusCode": 422,
  "message": "Validation failed",
  "errors": [
    { "field": "email", "message": "Invalid email address" },
    { "field": "password", "message": "Must contain at least one uppercase letter" }
  ]
}
```

| Status | Meaning |
|---|---|
| 400 | Bad request (malformed body) |
| 401 | Missing, invalid, or expired access token |
| 403 | Authenticated but not allowed (wrong role, not a member) |
| 404 | Resource not found |
| 409 | Conflict (duplicate email, prefix already taken) |
| 422 | Validation failed — check `errors` array |
| 500 | Server error |

---

## 4. Auth Endpoints

Auth endpoints are **public** — no `Authorization` header needed.

---

### `POST /auth/register`

Create a new account. Returns access token in body and sets `refresh_token` cookie.

**Request**
```json
{
  "fullName": "Zaeem Hassan",
  "email": "zaeem@example.com",
  "password": "Secure123!"
}
```

Password rules: min 8 chars, at least one uppercase, one lowercase, one number, one special character.

**Response `201`**
```json
{
  "user": {
    "id": "uuid",
    "fullName": "Zaeem Hassan",
    "email": "zaeem@example.com",
    "avatarUrl": null,
    "avatarColor": "#6366f1"
  },
  "accessToken": "eyJ..."
}
```

**Errors**
| Status | When |
|---|---|
| 409 | Email already registered |
| 422 | Validation failed |

---

### `POST /auth/login`

**Request**
```json
{
  "email": "zaeem@example.com",
  "password": "Secure123!"
}
```

**Response `200`** — same shape as register

**Errors**
| Status | When |
|---|---|
| 401 | Wrong email or password |
| 422 | Validation failed |

---

### `GET /auth/google`

Redirect the browser here to start Google OAuth. Do **not** call with fetch — must be a full page navigation.

```ts
window.location.href = 'http://localhost:3000/api/v1/auth/google';
```

---

### `GET /auth/google/callback`

Handled by the server — Google redirects here automatically. The server does **not** return JSON. Instead it redirects the browser to:

```
<FRONTEND_URL>/auth/callback?token=<accessToken>
```

Read the `token` query param from the URL and store it in memory as your access token. A `refresh_token` cookie is also set automatically.

```ts
// On your /auth/callback page:
const params = new URLSearchParams(window.location.search);
const accessToken = params.get('token');
// store in memory (Zustand, React state, etc.)
```

**Errors**
| Status | When |
|---|---|
| 401 | Google account could not be authenticated |
| 409 | Google account conflicts with an existing or inactive account |

---

### `POST /auth/refresh`

Exchange the `refresh_token` cookie for a new token pair. The browser sends the cookie automatically (same-origin). Call this when a request fails with `401`.

**Request** — no body required (cookie is sent automatically)

**Response `200`** — same shape as login (new `accessToken` in body, new cookie set)

**Errors**
| Status | When |
|---|---|
| 401 | Cookie missing, expired, or already used |

---

### `POST /auth/logout`

Logs out the **current session** only. Invalidates the `refresh_token` cookie and deletes that token from the database. Does **not** affect other active sessions on other devices.

Call this when the user clicks "Sign out" on the current device.

**Request** — no body required (cookie is read automatically)

**Response `200`** — no body

> If the cookie is missing or already invalid, the endpoint still returns `200` — it is safe to call without checking first.

---

### `POST /auth/forgot-password`

Request a 6-digit OTP for password reset. Always returns `200` regardless of whether the email exists (prevents enumeration).

**Request**
```json
{
  "email": "zaeem@example.com"
}
```

**Response `200`** — no body (empty)

OTP is currently logged to server console. Valid for **15 minutes**.

---

### `POST /auth/reset-password`

Reset password using the OTP received on email.

**Request**
```json
{
  "email": "zaeem@example.com",
  "otp": "482931",
  "newPassword": "NewSecure123!"
}
```

`otp` must be the exact 6-digit code sent to the email. Password rules same as register.

**Response `200`** — no body

This endpoint **logs out all active sessions** — the user must log in again after resetting.

**Errors**
| Status | When |
|---|---|
| 401 | OTP wrong, expired (>15 min), or already used |
| 422 | Validation failed |

---

## 5. User Endpoints

All user endpoints require `Authorization: Bearer <accessToken>`.

---

### `POST /user/profile`

Initialize the current user's profile after registration. Call this once after the user completes onboarding.

**Headers**
```
Authorization: Bearer <accessToken>
```

**Request**
```json
{
  "designation": "Senior Backend Engineer",
  "profilePicture": "initials:ZH",
  "status": "ONLINE",
  "bio": "Building scalable APIs.",
  "timezone": "Asia/Karachi",
  "showLocalTime": true
}
```

All fields are optional. `profilePicture` accepts:
- `"initials:ZH"` — shows colored circle with initials (1–4 letters)
- `"ZH"` — shorthand, server normalizes to `"initials:ZH"`
- `"https://cdn.example.com/avatar.png"` — direct image URL

`timezone` must be a valid IANA timezone string (e.g. `"Asia/Karachi"`, `"Europe/London"`).

**Response `201`**
```json
{
  "id": "uuid",
  "fullName": "Zaeem Hassan",
  "email": "zaeem@example.com",
  "designation": "Senior Backend Engineer",
  "profilePicture": "initials:ZH",
  "status": "ONLINE",
  "bio": "Building scalable APIs.",
  "timezone": "Asia/Karachi",
  "showLocalTime": true,
  "localTime": "14/04/2026, 17:30:00",
  "createdAt": "2026-04-14T12:00:00.000Z",
  "updatedAt": "2026-04-14T12:00:00.000Z"
}
```

`localTime` is computed server-side from `timezone`. It is `null` if `showLocalTime` is `false` or no timezone is set.

---

### `GET /user/profile`

Get the current user's profile.

**Response `200`** — same shape as above

---

### `PATCH /user/profile`

Update one or more profile fields. Only send fields you want to change — all are optional.

**Request**
```json
{
  "fullName": "Zaeem Ul Hassan",
  "designation": "Lead Engineer",
  "profilePicture": "https://cdn.example.com/new-avatar.png",
  "status": "OFFLINE",
  "bio": "I love clean architecture.",
  "timezone": "Europe/London",
  "showLocalTime": false
}
```

At least one field must be present (server returns 400 otherwise).

**Response `200`** — updated profile shape

---

### `PATCH /user/status`

Quick status update without touching other profile fields.

**Request**
```json
{
  "status": "ONLINE"
}
```

`status` must be `"ONLINE"` or `"OFFLINE"`.

**Response `200`** — updated profile shape

---

### `PATCH /user/change-password`

Change the account password. Requires the current password for verification. **Logs out all active sessions** — the user must log in again.

**Request**
```json
{
  "currentPassword": "OldSecure123!",
  "newPassword": "NewSecure456!"
}
```

**Response `200`**
```json
{
  "message": "Password changed successfully. Please login again."
}
```

**Errors**
| Status | When |
|---|---|
| 400 | New password is the same as current |
| 403 | Current password is wrong, or account uses Google OAuth (no password to change) |
| 422 | Validation failed |

---

### `DELETE /user/profile`

Soft-delete the current user's account. This is irreversible from the frontend — the account is deactivated and all sessions are revoked. Redirect to login after calling this.

**Response `204`** — no body

---

## 6. Workspace Endpoints

**Create workspace** does not require a workspace header. All other workspace endpoints and all project endpoints require `x-workspace-id`.

---

### `POST /workspaces`

Create a new workspace. The calling user automatically becomes the `OWNER`.

**Headers**
```
Authorization: Bearer <accessToken>
```

**Request**
```json
{
  "name": "Acme Corp",
  "logoUrl": "https://cdn.example.com/logo.png"
}
```

`logoUrl` is optional.

**Response `201`**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Acme Corp",
    "logoUrl": "https://cdn.example.com/logo.png",
    "createdBy": "user-uuid",
    "createdAt": "2026-04-14T12:00:00.000Z",
    "updatedAt": "2026-04-14T12:00:00.000Z"
  },
  "message": "Workspace created successfully"
}
```

---

### `GET /workspaces`

List all workspaces the current user is a member of.

**Headers**
```
Authorization: Bearer <accessToken>
```

**Response `200`**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Acme Corp",
      "logoUrl": null,
      "createdBy": "user-uuid",
      "createdAt": "2026-04-14T12:00:00.000Z",
      "updatedAt": "2026-04-14T12:00:00.000Z"
    }
  ],
  "message": null
}
```

---

### `GET /workspaces/:workspaceId`

Get a single workspace. User must be a member.

**Headers**
```
Authorization: Bearer <accessToken>
x-workspace-id: <workspaceId>
```

The `:workspaceId` in the URL and the `x-workspace-id` header should be the same value.

**Response `200`**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Acme Corp",
    "logoUrl": null,
    "createdBy": "user-uuid",
    "createdAt": "2026-04-14T12:00:00.000Z",
    "updatedAt": "2026-04-14T12:00:00.000Z",
    "memberCount": 5
  },
  "message": null
}
```

**Errors**
| Status | When |
|---|---|
| 403 | `x-workspace-id` header missing or user is not a member |
| 404 | Workspace does not exist |

---

### `PATCH /workspaces/:workspaceId`

Update workspace name or logo. **OWNER only.**

**Headers**
```
Authorization: Bearer <accessToken>
x-workspace-id: <workspaceId>
```

**Request** — all fields optional
```json
{
  "name": "Acme Corporation",
  "logoUrl": null
}
```

Send `"logoUrl": null` to remove the logo.

**Response `200`**
```json
{
  "success": true,
  "data": { ... },
  "message": "Workspace updated successfully"
}
```

**Errors**
| Status | When |
|---|---|
| 403 | Not a member, or member but not OWNER |
| 404 | Workspace not found |

---

### `DELETE /workspaces/:workspaceId`

Soft delete the workspace. **OWNER only.** All projects, task lists, and tasks inside become inaccessible.

**Headers**
```
Authorization: Bearer <accessToken>
x-workspace-id: <workspaceId>
```

**Response `200`**
```json
{
  "success": true,
  "data": null,
  "message": "Workspace deleted successfully"
}
```

**Errors**
| Status | When |
|---|---|
| 403 | Not OWNER |
| 404 | Workspace not found |

---

## 7. Project Endpoints

All project endpoints require both the `Authorization` header and the `x-workspace-id` header. Any workspace member can create, view, and edit projects. Only the workspace OWNER can delete.

---

### `POST /projects`

Create a new project. Automatically creates 4 default statuses: **To Do**, **In Progress**, **Review**, **Completed**.

**Headers**
```
Authorization: Bearer <accessToken>
x-workspace-id: <workspaceId>
```

**Request**
```json
{
  "name": "Backend API",
  "description": "Core REST API for FocusHub",
  "color": "#6366f1",
  "icon": "code",
  "taskIdPrefix": "API"
}
```

| Field | Required | Rules |
|---|---|---|
| `name` | Yes | 1–100 chars |
| `description` | No | max 500 chars |
| `color` | No | hex color string, default `#6366f1` |
| `icon` | No | max 50 chars, any icon identifier string |
| `taskIdPrefix` | Yes | 2–6 uppercase letters/numbers (e.g. `API`, `FH`, `PROJ`). Auto-uppercased. Must be unique in the workspace. |

**Response `201`**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "workspaceId": "uuid",
    "name": "Backend API",
    "description": "Core REST API for FocusHub",
    "color": "#6366f1",
    "icon": "code",
    "taskIdPrefix": "API",
    "isArchived": false,
    "createdBy": "user-uuid",
    "createdAt": "2026-04-14T12:00:00.000Z",
    "updatedAt": "2026-04-14T12:00:00.000Z",
    "statuses": [
      { "id": "uuid", "name": "To Do",       "color": "#94a3b8", "position": 1000, "isDefault": true, "isClosed": false },
      { "id": "uuid", "name": "In Progress", "color": "#3b82f6", "position": 2000, "isDefault": true, "isClosed": false },
      { "id": "uuid", "name": "Review",      "color": "#f59e0b", "position": 3000, "isDefault": true, "isClosed": false },
      { "id": "uuid", "name": "Completed",   "color": "#22c55e", "position": 4000, "isDefault": true, "isClosed": true  }
    ],
    "_count": { "taskLists": 0 }
  },
  "message": "Project created successfully"
}
```

**Errors**
| Status | When |
|---|---|
| 403 | Not a workspace member |
| 409 | `taskIdPrefix` already used in this workspace |
| 422 | Validation failed |

---

### `GET /projects`

List all active (non-archived, non-deleted) projects in the workspace.

**Headers**
```
Authorization: Bearer <accessToken>
x-workspace-id: <workspaceId>
```

**Response `200`**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "workspaceId": "uuid",
      "name": "Backend API",
      "description": "...",
      "color": "#6366f1",
      "icon": "code",
      "taskIdPrefix": "API",
      "isArchived": false,
      "createdBy": "user-uuid",
      "createdAt": "...",
      "updatedAt": "...",
      "statuses": [ ... ],
      "_count": { "taskLists": 3 }
    }
  ],
  "message": null
}
```

---

### `GET /projects/:projectId`

Get a single project with its full status list.

**Headers**
```
Authorization: Bearer <accessToken>
x-workspace-id: <workspaceId>
```

**Response `200`** — same data shape as individual item in list above

**Errors**
| Status | When |
|---|---|
| 403 | Not a workspace member |
| 404 | Project not found (wrong workspace or deleted) |

---

### `PATCH /projects/:projectId`

Update project metadata. Any workspace member can do this. Only send fields you want to change.

**Headers**
```
Authorization: Bearer <accessToken>
x-workspace-id: <workspaceId>
```

**Request** — all fields optional
```json
{
  "name": "Backend API v2",
  "description": "Updated description",
  "color": "#10b981",
  "icon": "server"
}
```

Send `"description": null` or `"icon": null` to clear those fields.

**Note:** `taskIdPrefix` cannot be changed after creation.

**Response `200`**
```json
{
  "success": true,
  "data": { ... },
  "message": "Project updated successfully"
}
```

**Errors**
| Status | When |
|---|---|
| 403 | Not a workspace member |
| 404 | Project not found |

---

### `DELETE /projects/:projectId`

Soft delete the project and **all its data** (task lists, tasks, statuses). **OWNER only.** This is a hard operation — there is no undo from the frontend.

**Headers**
```
Authorization: Bearer <accessToken>
x-workspace-id: <workspaceId>
```

**Response `200`**
```json
{
  "success": true,
  "data": null,
  "message": "Project deleted successfully"
}
```

**Errors**
| Status | When |
|---|---|
| 403 | Not OWNER |
| 404 | Project not found |

---

## 8. System

### `GET /health`

No auth required. Returns database connectivity status. Use for uptime monitoring or app startup checks.

**Response `200`**
```json
{
  "status": "ok",
  "database": "connected"
}
```

**Response `503`** — database unreachable

---

## Quick Reference

### Headers Cheatsheet

| Situation | Headers needed |
|---|---|
| Auth endpoints | None |
| User endpoints | `Authorization: Bearer <token>` |
| Workspace create/list | `Authorization: Bearer <token>` |
| Workspace get/update/delete | `Authorization: Bearer <token>` + `x-workspace-id` |
| All project endpoints | `Authorization: Bearer <token>` + `x-workspace-id` |

### Who Can Do What

| Action | Required Role |
|---|---|
| Create workspace | Any authenticated user |
| List / view workspaces | Member of that workspace |
| Update workspace | OWNER |
| Delete workspace | OWNER |
| Create project | Any workspace member |
| View / update project | Any workspace member |
| Delete project | OWNER |

### profilePicture Format (User Module)

The `profilePicture` field in user endpoints is non-standard. It stores either a URL or an initials string:

| Value | What it means |
|---|---|
| `"initials:ZH"` | Show colored circle with letters ZH |
| `"ZH"` | Shorthand — server normalizes to `"initials:ZH"` |
| `"https://..."` | Direct image URL |

To render on the frontend: check if it starts with `"initials:"` → render an avatar with the letters. Otherwise treat as an `<img>` src.

### Google OAuth Callback Page

Your frontend needs a `/auth/callback` route. The server redirects there with the access token in the URL:

```ts
// pages/auth/callback.tsx (or equivalent)
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  if (token) {
    setAccessToken(token);         // store in memory / Zustand
    router.replace('/dashboard');  // clean up the URL
  } else {
    router.replace('/login?error=oauth_failed');
  }
}, []);
```

### Task ID Format

Tasks (coming soon) will have a display ID like `API-1`, `API-2`, computed from `taskIdPrefix + '-' + taskNumber`. This is not stored in the DB — it is computed at query time. The `taskIdPrefix` set on project creation is permanent.
