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
   - [POST /auth/verify-email](#post-authverify-email)
   - [POST /auth/login](#post-authlogin)
   - [GET /auth/google](#get-authgoogle)
   - [GET /auth/google/callback](#get-authgooglecallback)
   - [POST /auth/refresh](#post-authrefresh)
   - [POST /auth/logout](#post-authlogout)
   - [POST /auth/forgot-password](#post-authforgot-password)
   - [POST /auth/reset-password](#post-authreset-password)
5. [User Endpoints](#5-user-endpoints)
6. [Workspace Endpoints](#6-workspace-endpoints)
   - [POST /workspaces/:workspaceId/invite](#post-workspacesworkspaceidinvite)
   - [GET /workspaces/invite/:token](#get-workspacesinvitetoken)
   - [POST /workspaces/invite/claim](#post-workspacesinviteclaim)
   - [POST /workspaces/invite/accept](#post-workspacesinviteaccept)
7. [Project Endpoints](#7-project-endpoints)
8. [System](#8-system)

---

## 1. Response Format

There are **two response shapes** in this API. Auth and User endpoints return bare objects. Workspace, Invite, and Project endpoints follow the standard wrapper.

### Standard Wrapper (Workspace + Invite + Project)

```json
{
  "success": true,
  "data": { ... },
  "message": "Human readable message or null"
}
```

For list endpoints (arrays):

```json
{
  "success": true,
  "data": [ ... ],
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

### Registration Flow (Email Verification Required)

Registration is a **two-step flow** — you must verify the OTP before the account is usable:

```
POST /auth/register  →  OTP sent to email (no token issued yet)
    ↓
POST /auth/verify-email  →  accessToken + refresh cookie issued
    ↓
Store accessToken in memory, navigate to dashboard
```

### Token Architecture

| Token | Where | Lifetime | Purpose |
|---|---|---|---|
| Access token | Response body → memory | 15 min | Sent as `Authorization: Bearer <token>` on every protected request |
| Refresh token | `httpOnly` cookie (`refresh_token`) | 7 days | Used only on `POST /auth/refresh` to get a new access token |

**Never store the access token in `localStorage`.** Store it in memory (React state, Zustand, etc.). The browser automatically sends the refresh cookie on requests to the same origin.

The refresh cookie is scoped to path `/api/v1/auth`, so it is only sent on auth requests — not every API call.

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
| 400 | Bad request (malformed body or missing required field) |
| 401 | Missing, invalid, or expired token / OTP |
| 403 | Authenticated but not allowed (wrong role, unverified email, wrong password) |
| 404 | Resource not found |
| 409 | Conflict (duplicate email, prefix already taken) |
| 422 | Validation failed — check `errors` array |
| 500 | Server error |

---

## 4. Auth Endpoints

Auth endpoints are **public** — no `Authorization` header needed.

---

### `POST /auth/register`

Create a new account. Does **not** issue a token — sends a 6-digit OTP to the email instead. Call `POST /auth/verify-email` next.

If the email was previously registered but never verified, a new OTP is resent.

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
  "message": "OTP sent to your email. Please verify to complete registration."
}
```

**Errors**
| Status | When |
|---|---|
| 409 | Email already registered and verified |
| 422 | Validation failed |

---

### `POST /auth/verify-email`

Verify the OTP sent during registration. Issues the access token and sets the refresh cookie — this is where the session starts.

**Request**
```json
{
  "email": "zaeem@example.com",
  "otp": "482931"
}
```

`otp` must be exactly 6 numeric digits. Valid for **15 minutes**.

**Response `200`**
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

Sets `refresh_token` httpOnly cookie (path: `/api/v1/auth`, 7-day TTL).

**Errors**
| Status | When |
|---|---|
| 401 | OTP wrong, expired (>15 min), or already used |
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

**Response `200`** — same shape as `/auth/verify-email`

**Errors**
| Status | When |
|---|---|
| 401 | Wrong email or password |
| 403 | Email not yet verified (must complete OTP flow first) |
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

**Notes**
- Google accounts auto-verify email — no OTP step needed
- If a user with the same email already exists (different Google ID), the server returns 409

**Errors**
| Status | When |
|---|---|
| 401 | Google account could not be authenticated |
| 409 | Google account conflicts with an existing account |

---

### `POST /auth/refresh`

Exchange the `refresh_token` cookie for a new token pair. The browser sends the cookie automatically (same-origin, cookie path `/api/v1/auth`). Call this when a request fails with `401`.

Token rotation is enforced — the old refresh token is invalidated and a new one is issued.

**Request** — no body required

**Response `200`** — same shape as login (new `accessToken` in body, new cookie set)

**Errors**
| Status | When |
|---|---|
| 401 | Cookie missing, expired, or already rotated |

---

### `POST /auth/logout`

Logs out the **current session** only. Invalidates the `refresh_token` cookie. Does **not** affect other active sessions on other devices.

**Request** — no body required

**Response `200`** — no body

> If the cookie is missing or already invalid, the endpoint still returns `200`.

---

### `POST /auth/forgot-password`

Request a password reset link. Always returns `200` regardless of whether the email exists (prevents enumeration).

**Request**
```json
{
  "email": "zaeem@example.com"
}
```

**Response `200`** — no body

A reset link is emailed to the address (if a password-based account exists). Link format:

```
<FRONTEND_URL>/reset-password?token=<uuid>
```

Token is valid for **1 hour**. Only one active reset token per user — previous tokens are revoked on new request.

> Google-only accounts (no password set) receive no email — the response is still `200`.

---

### `POST /auth/reset-password`

Reset password using the token from the reset link.

**Request**
```json
{
  "token": "uuid-from-reset-link",
  "newPassword": "NewSecure123!"
}
```

Password rules same as register. `token` is the UUID from the email link (not a 6-digit OTP).

**Response `200`** — no body

This endpoint **logs out all active sessions** — the user must log in again after resetting.

**Errors**
| Status | When |
|---|---|
| 401 | Token wrong, expired (>1 hour), or already used |
| 422 | Validation failed |

---

## 5. User Endpoints

All user endpoints require `Authorization: Bearer <accessToken>`.

---

### `POST /user/profile`

Initialize the current user's profile after registration. Call this once after the user completes onboarding.

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

**Errors**
| Status | When |
|---|---|
| 404 | User not found |

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

**Notes**
- If `fullName` changes and the user is using an initials avatar, initials are auto-updated
- Send `"bio": null` or `"designation": null` to clear optional fields

**Response `200`** — updated profile shape

**Errors**
| Status | When |
|---|---|
| 400 | No fields provided / invalid timezone |
| 404 | User not found |

---

### `PATCH /user/status`

Quick presence update without touching other profile fields. Sets `lastSeenAt` when going offline.

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

> This endpoint returns `403` for Google-only accounts (accounts with no password).

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

Soft-delete the current user's account. The account is deactivated and all sessions are revoked. Redirect to login after calling this.

**Response `204`** — no body

---

## 6. Workspace Endpoints

**Create workspace** and **list workspaces** do not require the workspace header. All other workspace endpoints require `x-workspace-id`.

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

### `POST /workspaces/:workspaceId/invite`

Invite a user to the workspace by email. **OWNER only.**

The server sends an invitation email with a link containing a token. If the email is already a member, the request silently succeeds (no error, no duplicate email). Any previously pending invite for the same email is revoked.

**Headers**
```
Authorization: Bearer <accessToken>
x-workspace-id: <workspaceId>
```

**Request**
```json
{
  "email": "colleague@example.com",
  "role": "MEMBER"
}
```

`role` is optional — defaults to `"MEMBER"`. Valid values: `"OWNER"`, `"MEMBER"`.

**Response `200`**
```json
{
  "success": true,
  "data": null,
  "message": "Invite sent successfully"
}
```

Invite link format sent in the email:
```
<FRONTEND_URL>/invite?token=<uuid>
```

Token is valid for **7 days**.

**Errors**
| Status | When |
|---|---|
| 403 | Not OWNER |
| 404 | Workspace not found |

---

### `GET /workspaces/invite/:token`

Preview an invite without consuming it. Use this on the `/invite` page to display workspace details before the user decides what to do next.

**Public — no auth required.**

**Response `200`**
```json
{
  "success": true,
  "data": {
    "workspaceId": "uuid",
    "workspaceName": "Acme Corp",
    "invitedEmail": "colleague@example.com",
    "role": "MEMBER",
    "inviterName": "Zaeem Hassan",
    "nextStep": "claim_account"
  },
  "message": null
}
```

**`nextStep` drives your frontend routing:**

| Value | Meaning | What to show |
|---|---|---|
| `"claim_account"` | No verified account exists for this email | Show a sign-up form (name + password) → call `POST /invite/claim` |
| `"login"` | A verified account already exists for this email | Show login prompt → after login call `POST /invite/accept` |

**Errors**
| Status | When |
|---|---|
| 404 | Token not found, already used, or expired |

---

### `POST /workspaces/invite/claim`

For **new users** who don't have an account yet. Creates the account and joins the workspace in a single step — no OTP or email verification needed (the invite itself proves email ownership).

**Public — no auth required.**

**Request**
```json
{
  "token": "uuid-from-invite-link",
  "fullName": "Jane Doe",
  "password": "Secure123!"
}
```

| Field | Required | Rules |
|---|---|---|
| `token` | Yes | UUID from the invite link |
| `fullName` | Yes | 2–100 chars |
| `password` | Yes | Min 8 chars, uppercase, lowercase, number, special char |

**Response `200`**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "fullName": "Jane Doe",
      "email": "colleague@example.com",
      "avatarUrl": null,
      "avatarColor": "#6366f1"
    },
    "accessToken": "eyJ...",
    "workspaceId": "uuid"
  },
  "message": "Invite claimed successfully"
}
```

Sets `refresh_token` httpOnly cookie (same as login). Store the `accessToken` in memory and redirect the user to the workspace using the returned `workspaceId`.

**Errors**
| Status | When |
|---|---|
| 404 | Token not found, already used, or expired |
| 409 | A verified account already exists for this email — use `POST /invite/accept` instead |
| 422 | Validation failed |

---

### `POST /workspaces/invite/accept`

For **existing users** who already have a verified account. The logged-in user's email must match the invited email.

**Headers**
```
Authorization: Bearer <accessToken>
```

**Request**
```json
{
  "token": "uuid-from-invite-link"
}
```

**Response `200`**
```json
{
  "success": true,
  "data": {
    "workspaceId": "uuid"
  },
  "message": "Invite accepted successfully"
}
```

Redirect the user to the workspace using the returned `workspaceId`.

**Errors**
| Status | When |
|---|---|
| 400 | Logged-in user's email does not match the invite email |
| 404 | Token not found, already used, or expired |

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
| `color` | No | hex color `#RRGGBB`, default `#6366f1` |
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
```json
{
  "status": "error",
  "database": "disconnected",
  "message": "<error details>"
}
```

---

## Quick Reference

### Headers Cheatsheet

| Situation | Headers needed |
|---|---|
| Auth endpoints | None |
| User endpoints | `Authorization: Bearer <token>` |
| Workspace create/list | `Authorization: Bearer <token>` |
| Workspace get/update/delete/invite | `Authorization: Bearer <token>` + `x-workspace-id` |
| Invite preview (`GET /invite/:token`) | None |
| Invite claim (new user) | None |
| Invite accept (existing user) | `Authorization: Bearer <token>` |
| All project endpoints | `Authorization: Bearer <token>` + `x-workspace-id` |

### Who Can Do What

| Action | Required Role |
|---|---|
| Register / verify email / login | Public |
| Create workspace | Any authenticated user |
| List / view workspaces | Member of that workspace |
| Update workspace | OWNER |
| Delete workspace | OWNER |
| Invite members | OWNER |
| Claim invite (new user, no account) | Public |
| Accept invite (existing user) | Any authenticated user (email must match) |
| Create project | Any workspace member |
| View / update project | Any workspace member |
| Delete project | OWNER |

### Registration Flow Summary

```
POST /auth/register         → sends OTP to email (no token)
POST /auth/verify-email     → issues accessToken + sets refresh cookie
                            → navigate to /onboarding or /dashboard
POST /user/profile          → (optional) set designation, bio, timezone
```

### Invite Flow Summary

```
OWNER:  POST /workspaces/:id/invite        → email sent with link

User opens link → GET /workspaces/invite/:token  (public — preview details)
                       ↓
              check "nextStep" field
                 /              \
   "claim_account"            "login"
  (no account yet)        (account exists)
         ↓                       ↓
POST /invite/claim          log in via
 { token, fullName,        POST /auth/login
   password }                    ↓
         ↓               POST /invite/accept
  account created +         { token }
  workspace joined               ↓
         ↓               workspace joined
  redirect to workspace  redirect to workspace
  (workspaceId in data)  (workspaceId in data)
```

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

### Password Rules (All Endpoints)

Min 8 characters, must contain:
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character

Applies to: register, verify-email (password set at register), reset-password, change-password.
