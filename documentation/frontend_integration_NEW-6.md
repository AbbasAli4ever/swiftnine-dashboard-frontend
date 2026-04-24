# FocusHub — Frontend Integration Guide

**Base URL:** `http://localhost:3020/api/v1`  
**Swagger UI:** `http://localhost:3020/api/docs`  
**Content-Type:** `application/json` on all requests with a body

---

## Table of Contents

1. [Response Format](#1-response-format)
2. [Auth Flow & Token Management](#2-auth-flow--token-management)
3. [Error Handling](#3-error-handling)
4. [Auth Endpoints](#4-auth-endpoints)
5. [User Endpoints](#5-user-endpoints)
6. [Workspace Endpoints](#6-workspace-endpoints)
7. [Member Management Endpoints](#7-member-management-endpoints)
8. [Project Endpoints](#8-project-endpoints)
9. [Status Endpoints](#9-status-endpoints)
10. [Task List Endpoints](#10-task-list-endpoints)
11. [Task Endpoints](#11-task-endpoints)
12. [Tag Endpoints](#12-tag-endpoints)
13. [Time Entry Endpoints](#13-time-entry-endpoints)
14. [Attachment Endpoints](#14-attachment-endpoints)
15. [Comments & Reactions Endpoints](#15-comments--reactions-endpoints)
16. [Activity Endpoints](#16-activity-endpoints)
17. [System](#17-system)

---

## 1. Response Format

There are **two response shapes** in this API. Auth and User endpoints return bare objects. All other endpoints follow the standard wrapper.

### Standard Wrapper

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

For delete/action endpoints with no return data:

```json
{
  "success": true,
  "data": null,
  "message": "Action completed successfully"
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

The refresh cookie is currently scoped to path `/`, so it can be sent across the API on same-site requests. In the browser, use `credentials: 'include'` / `withCredentials: true` for refresh/logout flows.

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
| 409 | Conflict (duplicate email, prefix already taken, tag already on task) |
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
  "message": "Account created. Check your email for the verification code."
}
```

If the email already exists but is still unverified, the backend resends the OTP instead of creating a second account.

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

Sets `refresh_token` httpOnly cookie (path: `/`, 7-day TTL).

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
window.location.href = 'http://localhost:3020/api/v1/auth/google';
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

Exchange the `refresh_token` cookie for a new token pair. The browser sends the cookie automatically when credentials are enabled. Call this when a request fails with `401`.

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

### `GET /user/:id`

Get any user's public profile by their UUID. Useful for rendering member cards and assignee info.

**Response `200`** — same shape as `GET /user/profile`

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

### `PATCH /user/notifications`

Update the user's notification preferences. Only send the fields you want to change — all are optional booleans.

**Request**
```json
{
  "inbox": true,
  "email": true,
  "browser": false,
  "mobile": false
}
```

**Response `200`**
```json
{
  "inbox": true,
  "email": true,
  "browser": false,
  "mobile": false
}
```

All four fields (`inbox`, `email`, `browser`, `mobile`) are returned in the response. Any field not yet set will be `null`.

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
  "logoUrl": "https://cdn.example.com/logo.png",
  "workspaceUse": "WORK",
  "managementType": "SOFTWARE_DEVELOPMENT"
}
```

| Field | Required | Rules |
|---|---|---|
| `name` | Yes | 1–100 chars |
| `logoUrl` | No | valid URL |
| `workspaceUse` | Yes | `"WORK"`, `"PERSONAL"`, `"SCHOOL"` |
| `managementType` | Yes | See values below |

**`managementType` values:**
`HR_RECRUITING`, `CREATIVE_DESIGN`, `PROFESSIONAL_SERVICES`, `FINANCE_ACCOUNTING`, `OPERATIONS`, `SOFTWARE_DEVELOPMENT`, `IT`, `SALES_CRM`, `PERSONAL_USE`, `SUPPORT`, `STARTUP`, `PMO`, `MARKETING`, `OTHER`

**Response `201`**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Acme Corp",
    "logoUrl": "https://cdn.example.com/logo.png",
    "workspaceUse": "WORK",
    "managementType": "SOFTWARE_DEVELOPMENT",
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
      "workspaceUse": "WORK",
      "managementType": "SOFTWARE_DEVELOPMENT",
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
    "workspaceUse": "WORK",
    "managementType": "SOFTWARE_DEVELOPMENT",
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

### `GET /workspaces/:workspaceId/members`

List all members of a workspace.

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
      "id": "user-uuid",
      "fullName": "Zaeem Hassan",
      "email": "zaeem@example.com",
      "role": "OWNER",
      "lastActive": "2026-04-14T12:00:00.000Z",
      "invitedBy": "Jane Doe",
      "invitedOn": "2026-04-10T09:00:00.000Z",
      "inviteStatus": "ACCEPTED"
    }
  ],
  "message": "Members returned successfully"
}
```

**Field notes:**
- `id` — the user's UUID (not the membership record ID)
- `lastActive` — `null` if user has never gone offline
- `invitedBy` — inviter's full name (string), or `null` if the user created the workspace
- `invitedOn` — invite created date, or `null` if the user created the workspace
- `inviteStatus` — `"PENDING"` | `"ACCEPTED"` | `"EXPIRED"` | `"REVOKED"` | `null` (null if user created the workspace and was never invited)

**Errors**
| Status | When |
|---|---|
| 403 | Not a workspace member |
| 404 | Workspace not found |

---

### `GET /workspaces/:workspaceId/members/:memberId`

Get detailed info for a single workspace member. This endpoint is useful when the frontend needs the **workspace membership record ID** for role changes, attachments, or member-specific views.

**Headers**
```
Authorization: Bearer <accessToken>
```

**Response `200`**
```json
{
  "success": true,
  "data": {
    "id": "user-uuid",
    "workspaceMemberId": "workspace-member-record-uuid",
    "fullName": "Zaeem Hassan",
    "email": "zaeem@example.com",
    "role": "MEMBER",
    "avatarUrl": null,
    "avatarColor": "#6366f1",
    "designation": "Backend Engineer",
    "bio": "Building APIs.",
    "isOnline": true,
    "lastActive": "2026-04-14T12:00:00.000Z",
    "timezone": "Asia/Karachi",
    "notificationPreferences": {
      "email": true,
      "browser": false
    },
    "invitedBy": "Jane Doe",
    "invitedOn": "2026-04-10T09:00:00.000Z",
    "inviteStatus": "ACCEPTED",
    "createdAt": "2026-04-14T12:00:00.000Z",
    "updatedAt": "2026-04-14T12:00:00.000Z"
  },
  "message": "Member returned successfully"
}
```

**Field notes:**
- `id` is the user UUID
- `workspaceMemberId` is the membership record UUID
- `memberId` in the path can be either the membership record ID or the user ID

**Errors**
| Status | When |
|---|---|
| 401 | Not authenticated |
| 404 | Member not found |

---

### `PATCH /workspaces/:workspaceId`

Update workspace fields. **OWNER only.**

**Headers**
```
Authorization: Bearer <accessToken>
x-workspace-id: <workspaceId>
```

**Request** — all fields optional
```json
{
  "name": "Acme Corporation",
  "logoUrl": null,
  "workspaceUse": "PERSONAL",
  "managementType": "OTHER"
}
```

Send `"logoUrl": null` to remove the logo. `workspaceUse` and `managementType` accept the same values as workspace creation.

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

### `POST /workspaces/:workspaceId/invites`

Invite multiple users at once (up to 50). **OWNER only.** Returns a per-email result so the frontend can show exactly who was invited, who was already a member, and who failed.

**Headers**
```
Authorization: Bearer <accessToken>
x-workspace-id: <workspaceId>
```

**Request**
```json
{
  "emails": ["alice@example.com", "bob@example.com"],
  "role": "MEMBER"
}
```

| Field | Required | Rules |
|---|---|---|
| `emails` | Yes | Array of valid emails, 1–50 items |
| `role` | No | `"OWNER"` or `"MEMBER"`, defaults to `"MEMBER"` |

**Response `200`**
```json
{
  "success": true,
  "data": {
    "results": [
      { "email": "alice@example.com", "status": "invited",        "message": null },
      { "email": "bob@example.com",   "status": "already_member", "message": null }
    ],
    "summary": {
      "total": 2,
      "invited": 1,
      "alreadyMember": 1,
      "failed": 0
    }
  },
  "message": "Batch invite processed"
}
```

`status` per email: `"invited"` | `"already_member"` | `"failed"`

**Errors**
| Status | When |
|---|---|
| 403 | Not OWNER |
| 404 | Workspace not found |
| 422 | Validation failed (empty array, >50 emails, invalid email) |

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
| `"claim_account"` | No verified account exists for this email | Show a sign-up form (name + password) → call `POST /workspaces/invite/claim` |
| `"login"` | A verified account already exists for this email | Show login prompt → after login call `POST /workspaces/invite/accept` |

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
| 409 | A verified account already exists for this email — use `POST /workspaces/invite/accept` instead |
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

## 7. Member Management Endpoints

These endpoints manage workspace membership. They live under `/organizations`. All require `Authorization: Bearer <accessToken>`. The workspace is identified in the request body (optionally also accepted via `x-workspace-id`).

> **Important:** Both endpoints use the **WorkspaceMember record ID** (membership UUID), not the user UUID. Use `GET /workspaces/:workspaceId/members/:memberId` to retrieve `workspaceMemberId` cleanly for frontend actions.

---

### `DELETE /organizations/members`

Remove a member from a workspace. **OWNER only.**

**Headers**
```
Authorization: Bearer <accessToken>
```

**Request**
```json
{
  "workspaceId": "uuid",
  "memberId": "workspace-member-record-uuid"
}
```

`memberId` is the **WorkspaceMember record UUID** (not the user UUID).

**Response `200`**
```json
{
  "success": true,
  "data": null,
  "message": "Member removed successfully"
}
```

**Errors**
| Status | When |
|---|---|
| 403 | Not OWNER |
| 404 | Workspace or member record not found |

---

### `PUT /organizations/members/:id/role`

Change the role of a workspace member. **OWNER only.** `:id` is the **WorkspaceMember record UUID**.

**Headers**
```
Authorization: Bearer <accessToken>
```

**Request**
```json
{
  "workspaceId": "uuid",
  "role": "MEMBER"
}
```

`role` must be `"OWNER"` or `"MEMBER"`.

**Response `200`**
```json
{
  "success": true,
  "data": null,
  "message": "Member role updated successfully"
}
```

**Errors**
| Status | When |
|---|---|
| 403 | Not OWNER |
| 404 | Workspace or member record not found |

---

## 8. Project Endpoints

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
      { "id": "uuid", "name": "To Do",       "color": "#94a3b8", "group": "NOT_STARTED", "position": 1000, "isDefault": true, "isProtected": false, "isClosed": false },
      { "id": "uuid", "name": "In Progress", "color": "#3b82f6", "group": "ACTIVE",      "position": 2000, "isDefault": true, "isProtected": false, "isClosed": false },
      { "id": "uuid", "name": "Review",      "color": "#f59e0b", "group": "DONE",        "position": 3000, "isDefault": true, "isProtected": false, "isClosed": false },
      { "id": "uuid", "name": "Completed",   "color": "#22c55e", "group": "CLOSED",      "position": 4000, "isDefault": true, "isProtected": true,  "isClosed": true  }
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

## 9. Status Endpoints

All status endpoints require `Authorization: Bearer <accessToken>` and `x-workspace-id`. Status write operations (create, update, delete, reorder, reset) are **OWNER only**. Read operations are available to any workspace member.

Statuses belong to a project and are organized into four **groups** that represent lifecycle stages:

| Group | Meaning | Mutable? |
|---|---|---|
| `NOT_STARTED` | Work hasn't begun | Yes — create/move statuses here |
| `ACTIVE` | Work in progress | Yes |
| `DONE` | Work finished | Yes |
| `CLOSED` | Permanently closed (e.g. Cancelled) | No — cannot create statuses here; only the system-managed closed status lives here |

`isProtected: true` means the status cannot be deleted or moved to a different group.

---

### `POST /statuses`

Create a custom status in a project. **OWNER only.**

**Headers**
```
Authorization: Bearer <accessToken>
x-workspace-id: <workspaceId>
```

**Request**
```json
{
  "projectId": "uuid",
  "name": "Blocked",
  "color": "#ef4444",
  "group": "ACTIVE"
}
```

| Field | Required | Rules |
|---|---|---|
| `projectId` | Yes | UUID of the project |
| `name` | Yes | 1–100 chars |
| `color` | No | Hex color `#RGB` or `#RRGGBB` |
| `group` | Yes | `"NOT_STARTED"`, `"ACTIVE"`, or `"DONE"` (cannot create in `"CLOSED"`) |

**Response `201`**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "projectId": "uuid",
    "name": "Blocked",
    "color": "#ef4444",
    "group": "ACTIVE",
    "position": 3500,
    "isDefault": false,
    "isProtected": false,
    "isClosed": false,
    "createdAt": "2026-04-14T12:00:00.000Z",
    "updatedAt": "2026-04-14T12:00:00.000Z"
  },
  "message": "Status created successfully"
}
```

**Errors**
| Status | When |
|---|---|
| 403 | Not OWNER |
| 404 | Project not found |
| 422 | Validation failed |

---

### `GET /statuses`

List all statuses for a project, grouped by lifecycle stage.

**Headers**
```
Authorization: Bearer <accessToken>
x-workspace-id: <workspaceId>
```

**Query params**
```
?projectId=<uuid>
```

**Response `200`**
```json
{
  "success": true,
  "data": {
    "projectId": "uuid",
    "groups": {
      "notStarted": [
        { "id": "uuid", "name": "To Do", "color": "#94a3b8", "group": "NOT_STARTED", "position": 1000, "isDefault": true, "isProtected": false, "isClosed": false }
      ],
      "active": [
        { "id": "uuid", "name": "In Progress", "color": "#3b82f6", "group": "ACTIVE", "position": 2000, "isDefault": true, "isProtected": false, "isClosed": false },
        { "id": "uuid", "name": "Blocked",     "color": "#ef4444", "group": "ACTIVE", "position": 2500, "isDefault": false, "isProtected": false, "isClosed": false }
      ],
      "done": [
        { "id": "uuid", "name": "Review", "color": "#f59e0b", "group": "DONE", "position": 3000, "isDefault": true, "isProtected": false, "isClosed": false }
      ],
      "closed": [
        { "id": "uuid", "name": "Completed", "color": "#22c55e", "group": "CLOSED", "position": 4000, "isDefault": true, "isProtected": true, "isClosed": true }
      ]
    }
  },
  "message": null
}
```

**Errors**
| Status | When |
|---|---|
| 400 | `projectId` query param missing |
| 403 | Not a workspace member |
| 404 | Project not found |

---

### `GET /statuses/:id`

Get a single status by ID.

**Headers**
```
Authorization: Bearer <accessToken>
x-workspace-id: <workspaceId>
```

**Response `200`** — single status object (same shape as items in `GET /statuses` groups, wrapped in `{ success, data, message }`)

**Errors**
| Status | When |
|---|---|
| 403 | Not a workspace member |
| 404 | Status not found |

---

### `PUT /statuses/:id`

Update a status name and/or color. **OWNER only.** At least one field must be provided.

**Headers**
```
Authorization: Bearer <accessToken>
x-workspace-id: <workspaceId>
```

**Request** — at least one field required
```json
{
  "name": "In Review",
  "color": "#a855f7"
}
```

**Response `200`** — updated status object wrapped in `{ success, data, message }`

**Errors**
| Status | When |
|---|---|
| 400 | No fields provided |
| 403 | Not OWNER |
| 404 | Status not found |
| 422 | Validation failed |

---

### `DELETE /statuses/:id`

Delete a status. **OWNER only.** Protected statuses (`isProtected: true`) cannot be deleted.

If the status has tasks assigned to it, you must provide a `replacementStatusId` to reassign those tasks — otherwise the request will fail.

**Headers**
```
Authorization: Bearer <accessToken>
x-workspace-id: <workspaceId>
```

**Request body** — optional
```json
{
  "replacementStatusId": "uuid"
}
```

**Response `200`**
```json
{
  "success": true,
  "data": null,
  "message": "Status deleted successfully"
}
```

**Errors**
| Status | When |
|---|---|
| 400 | Status is protected / tasks exist but no replacementStatusId given |
| 403 | Not OWNER |
| 404 | Status not found |

---

### `PUT /statuses/reorder`

Reorder statuses within and across groups. **OWNER only.** You must include **every** status UUID for the project exactly once — partial updates are rejected.

**Headers**
```
Authorization: Bearer <accessToken>
x-workspace-id: <workspaceId>
```

**Request**
```json
{
  "projectId": "uuid",
  "groups": {
    "notStarted": ["uuid-1"],
    "active":     ["uuid-2", "uuid-3"],
    "done":       ["uuid-4"],
    "closed":     ["uuid-5"]
  }
}
```

The order within each array determines display order. Moving a UUID to a different group changes its `group` value (except `closed` — protected statuses cannot be moved out of `closed`).

**Response `200`** — grouped statuses (same shape as `GET /statuses`)

**Errors**
| Status | When |
|---|---|
| 400 | Missing statuses / duplicate UUIDs / attempt to move protected status |
| 403 | Not OWNER |
| 404 | Project not found |

---

### `POST /statuses/default`

Reset statuses to the default template. **OWNER only.**

> Warning: this may remove custom statuses. Tasks on deleted statuses must be handled — check if `replacementStatusId` is needed first.

**Headers**
```
Authorization: Bearer <accessToken>
x-workspace-id: <workspaceId>
```

**Request**
```json
{
  "projectId": "uuid"
}
```

**Response `200`** — grouped statuses after reset

**Errors**
| Status | When |
|---|---|
| 403 | Not OWNER |
| 404 | Project not found |

---

## 10. Task List Endpoints

All task list endpoints require `Authorization: Bearer <accessToken>` and `x-workspace-id`. Any workspace member can create, view, update, archive/restore, and reorder task lists. Any member can delete a task list.

---

### `POST /projects/:projectId/lists`

Create a new task list inside a project.

**Headers**
```
Authorization: Bearer <accessToken>
x-workspace-id: <workspaceId>
```

**Request**
```json
{
  "name": "Sprint 1"
}
```

| Field | Required | Rules |
|---|---|---|
| `name` | Yes | 1–255 chars |

**Response `201`**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "projectId": "uuid",
    "name": "Sprint 1",
    "position": 1000,
    "isArchived": false,
    "createdBy": "user-uuid",
    "createdAt": "2026-04-14T12:00:00.000Z",
    "updatedAt": "2026-04-14T12:00:00.000Z"
  },
  "message": "Task list created successfully"
}
```

**Errors**
| Status | When |
|---|---|
| 403 | Not a workspace member |
| 404 | Project not found |

---

### `GET /projects/:projectId/lists`

List all task lists in a project. By default returns only active (non-archived) lists.

**Headers**
```
Authorization: Bearer <accessToken>
x-workspace-id: <workspaceId>
```

**Query params**
```
?includeArchived=true     (optional — also return archived lists)
```

**Response `200`**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "projectId": "uuid",
      "name": "Sprint 1",
      "position": 1000,
      "isArchived": false,
      "createdBy": "user-uuid",
      "createdAt": "2026-04-14T12:00:00.000Z",
      "updatedAt": "2026-04-14T12:00:00.000Z"
    }
  ],
  "message": null
}
```

**Errors**
| Status | When |
|---|---|
| 403 | Not a workspace member |
| 404 | Project not found |

---

### `PATCH /projects/:projectId/lists/:listId`

Rename a task list.

**Headers**
```
Authorization: Bearer <accessToken>
x-workspace-id: <workspaceId>
```

**Request**
```json
{
  "name": "Sprint 2"
}
```

**Response `200`**
```json
{
  "success": true,
  "data": { ... },
  "message": "Task list updated successfully"
}
```

**Errors**
| Status | When |
|---|---|
| 403 | Not a workspace member |
| 404 | Task list not found |

---

### `PATCH /projects/:projectId/lists/:listId/archive`

Archive a task list. Archived lists are hidden from the default list view but their tasks are not deleted.

**Headers**
```
Authorization: Bearer <accessToken>
x-workspace-id: <workspaceId>
```

**Request** — no body

**Response `200`** — task list object with `isArchived: true`

**Errors**
| Status | When |
|---|---|
| 403 | Not a workspace member |
| 404 | Task list not found |

---

### `PATCH /projects/:projectId/lists/:listId/restore`

Restore an archived task list.

**Headers**
```
Authorization: Bearer <accessToken>
x-workspace-id: <workspaceId>
```

**Request** — no body

**Response `200`** — task list object with `isArchived: false`

**Errors**
| Status | When |
|---|---|
| 403 | Not a workspace member |
| 404 | Task list not found |

---

### `PUT /projects/:projectId/lists/reorder`

Reorder task lists within a project. Send every active list ID in the desired display order.

**Headers**
```
Authorization: Bearer <accessToken>
x-workspace-id: <workspaceId>
```

**Request**
```json
{
  "listIds": ["uuid-1", "uuid-2", "uuid-3"]
}
```

The server assigns gap-based positions (1000, 2000, 3000 …) in the order given.

**Response `200`**
```json
{
  "success": true,
  "data": [ ... ],
  "message": "Task lists reordered successfully"
}
```

**Errors**
| Status | When |
|---|---|
| 400 | Missing or duplicate list IDs |
| 403 | Not a workspace member |
| 404 | Project not found |

---

### `DELETE /projects/:projectId/lists/:listId`

Delete a task list and **all its tasks**. This is permanent — there is no undo.

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
  "message": "Task list deleted successfully"
}
```

**Errors**
| Status | When |
|---|---|
| 403 | Not a workspace member |
| 404 | Task list not found |

---

## 11. Task Endpoints

All task endpoints require `Authorization: Bearer <accessToken>` and `x-workspace-id`. Any workspace member can create, view, and update tasks. Only the task creator or workspace OWNER can delete.

### Task Data Shapes

**`TaskDetailData`** — returned by create, get by ID, update, complete/uncomplete, assignee/tag mutations:

```json
{
  "id": "uuid",
  "taskId": "API-1",
  "taskNumber": 1,
  "parentId": null,
  "depth": 0,
  "title": "Implement auth module",
  "description": "JWT + OAuth2",
  "priority": "HIGH",
  "startDate": "2026-04-14T00:00:00.000Z",
  "dueDate": "2026-04-21T00:00:00.000Z",
  "position": 1000,
  "isCompleted": false,
  "completedAt": null,
  "createdBy": "user-uuid",
  "createdAt": "2026-04-14T12:00:00.000Z",
  "updatedAt": "2026-04-14T12:00:00.000Z",
  "totalTimeLogged": 7200,
  "status": {
    "id": "uuid",
    "name": "In Progress",
    "color": "#3b82f6",
    "group": "ACTIVE"
  },
  "creator": {
    "id": "uuid",
    "fullName": "Zaeem Hassan",
    "avatarUrl": null,
    "avatarColor": "#6366f1"
  },
  "assignees": [
    {
      "user": { "id": "uuid", "fullName": "Jane Doe", "avatarUrl": null, "avatarColor": "#6366f1" },
      "assignedBy": "assigner-user-uuid"
    }
  ],
  "tags": [
    {
      "tag": { "id": "uuid", "name": "backend", "color": "#6366f1" }
    }
  ],
  "list": {
    "id": "list-uuid",
    "name": "Sprint 1",
    "project": { "id": "proj-uuid", "name": "Backend API", "taskIdPrefix": "API" }
  },
  "children": [
    {
      "id": "subtask-uuid",
      "taskNumber": 5,
      "title": "Write unit tests",
      "priority": "NORMAL",
      "isCompleted": false,
      "completedAt": null,
      "depth": 1,
      "position": 1000,
      "status": { "id": "uuid", "name": "To Do", "color": "#94a3b8", "group": "NOT_STARTED" },
      "assignees": [ ... ]
    }
  ],
  "timeEntries": [
    {
      "id": "entry-uuid",
      "userId": "user-uuid",
      "description": "Working on JWT",
      "startTime": "2026-04-14T09:00:00.000Z",
      "endTime": "2026-04-14T11:00:00.000Z",
      "duration": 7200,
      "isManual": true,
      "createdAt": "...",
      "updatedAt": "...",
      "user": { "id": "uuid", "fullName": "Zaeem Hassan", "avatarUrl": null, "avatarColor": "#6366f1" }
    }
  ]
}
```

**Key field notes:**
- `taskId` — human-readable display ID (e.g. `API-1`). Computed from `taskIdPrefix-taskNumber`. Use for display only; use `id` (UUID) for all API calls.
- `totalTimeLogged` — sum of all `duration` values for this task's time entries, in **seconds**.
- `timeEntries[].duration` — in **seconds**. `null` if the timer is still running.
- `depth` — `0` for root tasks, `1` for subtasks (max 2 levels).
- `assignees` — array of `{ user, assignedBy }`. No top-level record ID or `userId` field on the assignee object.
- `tags` — array of `{ tag }`. No top-level record ID or `tagId` field on the task-tag object.
- `children` — subtasks, ordered by position. Only present on `TaskDetailData` (not on list items).

**`TaskListItemData`** — lighter shape returned by list and reorder endpoints:

```json
{
  "id": "uuid",
  "taskId": "API-1",
  "taskNumber": 1,
  "title": "Implement auth module",
  "priority": "HIGH",
  "startDate": "...",
  "dueDate": "...",
  "position": 1000,
  "depth": 0,
  "isCompleted": false,
  "completedAt": null,
  "createdAt": "...",
  "updatedAt": "...",
  "status": { "id": "uuid", "name": "In Progress", "color": "#3b82f6", "group": "ACTIVE" },
  "assignees": [
    { "user": { "id": "uuid", "fullName": "Jane Doe", "avatarUrl": null, "avatarColor": "#6366f1" }, "assignedBy": "uuid" }
  ],
  "tags": [
    { "tag": { "id": "uuid", "name": "backend", "color": "#6366f1" } }
  ],
  "list": {
    "id": "uuid",
    "name": "Sprint 1",
    "project": { "id": "uuid", "name": "Backend API", "taskIdPrefix": "API" }
  },
  "_count": { "children": 2 }
}
```

Note: `TaskListItemData` does NOT include `description`, `parentId`, `createdBy`, `children`, or `timeEntries`.

---

### `POST /projects/:projectId/lists/:listId/tasks`

Create a new task inside a list.

**Headers**
```
Authorization: Bearer <accessToken>
x-workspace-id: <workspaceId>
```

**Request**
```json
{
  "title": "Implement auth module",
  "description": "JWT + OAuth2",
  "statusId": "uuid",
  "priority": "HIGH",
  "startDate": "2026-04-14T00:00:00.000Z",
  "dueDate": "2026-04-21T00:00:00.000Z",
  "assigneeIds": ["user-uuid-1"],
  "tagIds": ["tag-uuid-1"]
}
```

| Field | Required | Rules |
|---|---|---|
| `title` | Yes | 1–500 chars |
| `description` | No | max 10000 chars |
| `statusId` | Yes | UUID of a status in this project |
| `priority` | No | `"URGENT"`, `"HIGH"`, `"NORMAL"`, `"LOW"`, `"NONE"` — defaults to `"NONE"` |
| `startDate` | No | ISO 8601 datetime string |
| `dueDate` | No | ISO 8601 datetime string |
| `assigneeIds` | No | Array of workspace member user UUIDs |
| `tagIds` | No | Array of workspace tag UUIDs |

**Response `201`** — `TaskDetailData` wrapped in `{ success, data, message }`

**Errors**
| Status | When |
|---|---|
| 400 | One or more `assigneeIds` are not workspace members |
| 403 | Not a workspace member |
| 404 | Project, list, or status not found |
| 422 | Validation failed |

---

### `GET /tasks`

Search and filter tasks across the active workspace. Use this for global task search, "My Tasks", dashboard task widgets, and assignee-focused views.

**Headers**
```
Authorization: Bearer <accessToken>
x-workspace-id: <workspaceId>
```

**Common query params**
```
?q=login
&page=1
&limit=20
&sort_by=due_date
&sort_order=asc
&status_ids=<uuid1>,<uuid2>
&status_groups=ACTIVE,DONE
&priority=HIGH,URGENT
&assignee_ids=<userId1>,<userId2>
&assignee_match=any
&tag_ids=<tagId1>,<tagId2>
&tag_match=all
&due_date=today_or_earlier
&include_subtasks=true
&include_closed=false
&me=true
```

**Response `200`**
```json
{
  "success": true,
  "data": [ ...TaskListItemData ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 42,
    "total_pages": 3,
    "has_next": true,
    "has_prev": false
  },
  "message": null
}
```

**Notes**
- `q` and `search` are aliases
- `assignee_ids` supports special value `unassigned`
- `include_subtasks` defaults to `false`
- `include_closed` defaults to `true`
- `include_archived` defaults to `false`
- `me=true` filters to tasks assigned to the current user

---

### `GET /projects/:projectId/tasks`

Search and filter tasks across all active lists in one project. Supports the same filters and paginated response shape as `GET /tasks`.

**Headers**
```
Authorization: Bearer <accessToken>
x-workspace-id: <workspaceId>
```

**Response `200`** — paginated `TaskListItemData`

---

### `GET /projects/:projectId/lists/:listId/tasks`

Search and filter tasks in a specific list. Supports the same filter query params and paginated response shape as `GET /tasks`, scoped to one list.

**Headers**
```
Authorization: Bearer <accessToken>
x-workspace-id: <workspaceId>
```

**Response `200`** — paginated `TaskListItemData`

**Errors**
| Status | When |
|---|---|
| 403 | Not a workspace member |
| 404 | Project or list not found |

---

### `PUT /projects/:projectId/lists/:listId/tasks/reorder`

Reorder tasks within a list. Must include **every** active root task ID exactly once.

**Headers**
```
Authorization: Bearer <accessToken>
x-workspace-id: <workspaceId>
```

**Request**
```json
{
  "taskIds": ["uuid-1", "uuid-2", "uuid-3"]
}
```

**Response `200`** — array of `TaskListItemData` with updated positions

**Errors**
| Status | When |
|---|---|
| 400 | Missing, duplicate, or extra task IDs |
| 403 | Not a workspace member |
| 404 | Project or list not found |

---

### `GET /tasks/:taskId`

Get full task detail by task UUID.

**Headers**
```
Authorization: Bearer <accessToken>
x-workspace-id: <workspaceId>
```

**Response `200`** — `TaskDetailData` wrapped in `{ success, data, message }`

**Errors**
| Status | When |
|---|---|
| 403 | Not a workspace member |
| 404 | Task not found |

---

### `PATCH /tasks/:taskId`

Update task fields. Only send fields you want to change. At least one field required.

**Headers**
```
Authorization: Bearer <accessToken>
x-workspace-id: <workspaceId>
```

**Request** — all fields optional
```json
{
  "title": "Updated title",
  "description": "Updated description",
  "statusId": "uuid",
  "priority": "URGENT",
  "startDate": "2026-04-14T00:00:00.000Z",
  "dueDate": "2026-04-28T00:00:00.000Z",
  "listId": "new-list-uuid"
}
```

- Send `"description": null` to clear it.
- `listId` moves the task to a different list within the **same project**. The task gets a new position at the end of the target list.

**Response `200`** — `TaskDetailData`

**Errors**
| Status | When |
|---|---|
| 403 | Not a workspace member |
| 404 | Task, status, or target list not found |
| 422 | Validation failed |

---

### `DELETE /tasks/:taskId`

Soft-delete a task and all its subtasks. **Task creator or workspace OWNER only.**

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
  "message": "Task deleted successfully"
}
```

**Errors**
| Status | When |
|---|---|
| 403 | Not the task creator and not OWNER |
| 404 | Task not found |

---

### `PATCH /tasks/:taskId/complete`

Mark a task as completed. Sets `isCompleted: true` and records `completedAt`.

**Headers**
```
Authorization: Bearer <accessToken>
x-workspace-id: <workspaceId>
```

**Request** — no body

**Response `200`** — `TaskDetailData` with `isCompleted: true`

---

### `PATCH /tasks/:taskId/uncomplete`

Revert a completed task. Clears `completedAt`.

**Headers**
```
Authorization: Bearer <accessToken>
x-workspace-id: <workspaceId>
```

**Request** — no body

**Response `200`** — `TaskDetailData` with `isCompleted: false`, `completedAt: null`

---

### `POST /tasks/:taskId/subtasks`

Create a subtask under a task. Maximum depth is 2 — a subtask cannot itself have subtasks.

**Headers**
```
Authorization: Bearer <accessToken>
x-workspace-id: <workspaceId>
```

**Request**
```json
{
  "title": "Write unit tests",
  "description": null,
  "statusId": "uuid",
  "priority": "NORMAL",
  "startDate": null,
  "dueDate": null
}
```

Same field rules as task creation. `assigneeIds` and `tagIds` are not available at subtask creation — add them using the assignee/tag endpoints with the subtask's UUID after creation.

**Response `201`** — `TaskDetailData` of the **new subtask** (not the parent)

**Errors**
| Status | When |
|---|---|
| 400 | Parent is already a subtask (depth limit reached) |
| 403 | Not a workspace member |
| 404 | Parent task or status not found |

---

### `GET /tasks/:taskId/subtasks`

List all subtasks of a task, ordered by position ascending.

**Headers**
```
Authorization: Bearer <accessToken>
x-workspace-id: <workspaceId>
```

**Response `200`** — array of `TaskListItemData`

---

### `POST /tasks/:taskId/assignees`

Add assignees to a task. Existing assignees are not removed — this appends. Duplicate user IDs are silently ignored.

**Headers**
```
Authorization: Bearer <accessToken>
x-workspace-id: <workspaceId>
```

**Request**
```json
{
  "userIds": ["user-uuid-1", "user-uuid-2"]
}
```

**Response `200`** — `TaskDetailData`

**Errors**
| Status | When |
|---|---|
| 400 | One or more users are not workspace members |
| 403 | Not a workspace member |
| 404 | Task not found |

---

### `DELETE /tasks/:taskId/assignees/:userId`

Remove a single assignee from a task. `:userId` is the user's UUID.

**Headers**
```
Authorization: Bearer <accessToken>
x-workspace-id: <workspaceId>
```

**Response `200`** — `TaskDetailData`

**Errors**
| Status | When |
|---|---|
| 403 | Not a workspace member |
| 404 | Task not found |

---

### `POST /tasks/:taskId/tags`

Add a tag to a task.

**Headers**
```
Authorization: Bearer <accessToken>
x-workspace-id: <workspaceId>
```

**Request**
```json
{
  "tagId": "uuid"
}
```

**Response `200`** — `TaskDetailData`

**Errors**
| Status | When |
|---|---|
| 403 | Not a workspace member |
| 404 | Task or tag not found |
| 409 | Tag is already on this task |

---

### `DELETE /tasks/:taskId/tags/:tagId`

Remove a tag from a task.

**Headers**
```
Authorization: Bearer <accessToken>
x-workspace-id: <workspaceId>
```

**Response `200`** — `TaskDetailData`

**Errors**
| Status | When |
|---|---|
| 403 | Not a workspace member |
| 404 | Tag is not on this task |

---

## 12. Tag Endpoints

Tags are **workspace-scoped** — they can be attached to any task in the workspace. All tag endpoints require `Authorization: Bearer <accessToken>` and `x-workspace-id`. Any workspace member can manage tags.

---

### `POST /tags`

Create a new workspace tag.

**Headers**
```
Authorization: Bearer <accessToken>
x-workspace-id: <workspaceId>
```

**Request**
```json
{
  "name": "backend",
  "color": "#6366f1"
}
```

| Field | Required | Rules |
|---|---|---|
| `name` | Yes | 1+ chars |
| `color` | No | hex color, default `#6366f1` |

**Response `201`**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "workspaceId": "uuid",
    "name": "backend",
    "color": "#6366f1",
    "createdAt": "2026-04-14T12:00:00.000Z",
    "updatedAt": "2026-04-14T12:00:00.000Z"
  },
  "message": "Tag created successfully"
}
```

**Errors**
| Status | When |
|---|---|
| 403 | Not a workspace member |
| 409 | Tag name already exists in this workspace |

---

### `GET /tags`

List all tags in the workspace.

**Headers**
```
Authorization: Bearer <accessToken>
x-workspace-id: <workspaceId>
```

**Response `200`** — array of tag objects

---

### `PATCH /tags/:tagId`

Update a tag's name or color. At least one field required.

**Headers**
```
Authorization: Bearer <accessToken>
x-workspace-id: <workspaceId>
```

**Request** — at least one field required
```json
{
  "name": "api",
  "color": "#10b981"
}
```

**Response `200`** — updated tag object

**Errors**
| Status | When |
|---|---|
| 403 | Not a workspace member |
| 404 | Tag not found |

---

### `DELETE /tags/:tagId`

Delete a tag from the workspace. The tag is removed from all tasks it was attached to.

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
  "message": "Tag deleted successfully"
}
```

**Errors**
| Status | When |
|---|---|
| 403 | Not a workspace member |
| 404 | Tag not found |

---

## 13. Time Entry Endpoints

Time tracking supports both **manual log entries** and **live timer sessions**. All time entry endpoints require `Authorization: Bearer <accessToken>` and `x-workspace-id`.

Only the user who created a time entry can edit or delete it.

> **Duration unit:** All `duration` fields are in **seconds** throughout the API — both in time entry responses and in `totalTimeLogged` on tasks. Convert to minutes/hours in the UI (`seconds / 60` for minutes, `seconds / 3600` for hours).

### Time Entry Data Shape

```json
{
  "id": "uuid",
  "taskId": "task-uuid",
  "userId": "user-uuid",
  "description": "Working on auth",
  "startTime": "2026-04-14T09:00:00.000Z",
  "endTime": "2026-04-14T11:00:00.000Z",
  "duration": 7200,
  "isManual": true,
  "createdAt": "2026-04-14T12:00:00.000Z",
  "updatedAt": "2026-04-14T12:00:00.000Z",
  "user": {
    "id": "uuid",
    "fullName": "Zaeem Hassan",
    "avatarUrl": null,
    "avatarColor": "#6366f1"
  }
}
```

`duration` is in **seconds**. For running timers, `endTime` and `duration` are `null` until stopped.

---

### `POST /tasks/:taskId/time/manual`

Log a manual time entry for a task.

**Headers**
```
Authorization: Bearer <accessToken>
x-workspace-id: <workspaceId>
```

**Request** — provide **either** `startTime + endTime` **or** `durationMinutes` (not both, not neither)

```json
{
  "description": "Working on auth",
  "startTime": "2026-04-14T09:00:00.000Z",
  "endTime": "2026-04-14T11:00:00.000Z"
}
```

or:

```json
{
  "description": "Working on auth",
  "durationMinutes": 120
}
```

| Field | Required | Rules |
|---|---|---|
| `description` | No | max 500 chars |
| `startTime` | Conditional | ISO 8601 datetime — required with `endTime` |
| `endTime` | Conditional | ISO 8601 datetime — required with `startTime`, must be after `startTime` |
| `durationMinutes` | Conditional | Integer 1–1440. Use this instead of time range |

The server converts `durationMinutes` to seconds for storage. The `duration` in the response will be in seconds (`durationMinutes * 60`).

**Response `201`** — `TimeEntryData`

**Errors**
| Status | When |
|---|---|
| 400 | Neither form provided / `endTime` before `startTime` |
| 403 | Not a workspace member |
| 404 | Task not found |

---

### `POST /tasks/:taskId/time/start`

Start a live timer for a task. If the user already has an active timer anywhere in the workspace, it is **automatically stopped** first.

**Headers**
```
Authorization: Bearer <accessToken>
x-workspace-id: <workspaceId>
```

**Request** — no body

**Response `201`**
```json
{
  "success": true,
  "data": {
    "stoppedEntry": null,
    "activeEntry": { ... }
  },
  "message": "Timer started"
}
```

`stoppedEntry` is non-null when a previously running timer was automatically stopped. `activeEntry` is the new running timer. When a previous timer was auto-stopped, the message will be `"Previous timer stopped. New timer started."`.

**Errors**
| Status | When |
|---|---|
| 403 | Not a workspace member |
| 404 | Task not found |

---

### `POST /tasks/:taskId/time/stop`

Stop the active timer for a specific task.

**Headers**
```
Authorization: Bearer <accessToken>
x-workspace-id: <workspaceId>
```

**Request** — no body

**Response `200`** — `TimeEntryData` with `endTime` and `duration` (in seconds) populated

**Errors**
| Status | When |
|---|---|
| 403 | Not a workspace member |
| 404 | Task not found, or no active timer on this task |

---

### `GET /tasks/:taskId/time`

List all time entries for a task, ordered by `startTime` descending.

**Headers**
```
Authorization: Bearer <accessToken>
x-workspace-id: <workspaceId>
```

**Response `200`** — array of `TimeEntryData`

---

### `GET /time-entries/active`

Get the current user's active timer (if any) in the workspace. Use on app load to restore timer UI state.

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
  "message": null
}
```

`data` is `null` if no timer is running, or `TimeEntryData` with `endTime: null` if a timer is active.

---

### `PATCH /time-entries/:entryId`

Edit a time entry's description and/or time range. Only the entry owner can do this.

**Headers**
```
Authorization: Bearer <accessToken>
x-workspace-id: <workspaceId>
```

**Request** — at least one field required
```json
{
  "description": "Updated note",
  "startTime": "2026-04-14T10:00:00.000Z",
  "endTime": "2026-04-14T12:00:00.000Z"
}
```

| Field | Rules |
|---|---|
| `description` | max 500 chars, send `null` to clear |
| `startTime` | ISO 8601 datetime |
| `endTime` | ISO 8601 datetime, must be after `startTime` |

> Note: `durationMinutes` is **not** accepted here. Duration is recalculated automatically from `startTime` and `endTime`.

**Response `200`** — updated `TimeEntryData`

**Errors**
| Status | When |
|---|---|
| 403 | Not the entry owner |
| 404 | Time entry not found |

---

### `DELETE /time-entries/:entryId`

Delete a time entry. Only the entry owner can do this.

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
  "message": "Time entry deleted successfully"
}
```

**Errors**
| Status | When |
|---|---|
| 403 | Not the entry owner |
| 404 | Time entry not found |

---

## 14. Attachment Endpoints

File attachments are uploaded to S3 via a two-step presign flow. All attachment endpoints require `Authorization: Bearer <accessToken>`. There is **no** `x-workspace-id` header needed — the workspace is resolved server-side from the task.

### Upload Flow

```
POST /attachments/presign    → get a presigned S3 URL + s3Key
    ↓
PUT <uploadUrl>              → upload the file directly to S3 (from the browser)
    ↓
POST /attachments            → record the attachment in the DB (pass back the s3Key)
```

---

### `POST /attachments/presign`

Generate a presigned S3 URL for direct browser upload.

**Headers**
```
Authorization: Bearer <accessToken>
```

**Request**
```json
{
  "mimeType": "image/png",
  "fileName": "screenshot.png",
  "taskId": "task-uuid",
  "workspaceId": "workspace-uuid"
}
```

| Field | Required | Rules |
|---|---|---|
| `mimeType` | Yes | MIME type string (e.g. `"image/png"`) |
| `fileName` | No | Original file name — used to build the S3 key |
| `taskId` | No | UUID — scopes the upload to a task folder |
| `workspaceId` | No | UUID — scopes the upload to a workspace folder (used if `taskId` not provided) |

If neither `taskId` nor `workspaceId` is provided, the file is scoped to the user's folder.

**Response `200`**
```json
{
  "success": true,
  "data": {
    "uploadUrl": "https://s3.amazonaws.com/bucket/...?X-Amz-Signature=...",
    "s3Key": "swiftnine/docs/app/attachments/task-uuid/abc123-screenshot.png",
    "expiresAt": "2026-04-14T12:15:00.000Z"
  },
  "message": "Presigned URL generated"
}
```

The presigned URL expires in **15 minutes**. Upload by sending a `PUT` request directly to `uploadUrl` from the browser — do not proxy through your server.

---

### `PUT <uploadUrl>` (Direct S3 Upload)

Upload the file directly to S3 using the presigned URL. This is a browser-to-S3 request, not an API call.

```ts
await fetch(uploadUrl, {
  method: 'PUT',
  body: file,
  headers: { 'Content-Type': file.type },
});
```

Do not include auth headers — the presigned URL contains its own credentials. After this succeeds, call `POST /attachments` to record the attachment.

---

### `POST /attachments`

Record an attachment in the database after the S3 upload completes.

**Headers**
```
Authorization: Bearer <accessToken>
```

**Request**
```json
{
  "taskId": "task-uuid",
  "memberId": "workspace-member-record-uuid-or-user-uuid",
  "s3Key": "swiftnine/docs/app/attachments/task-uuid/abc123-screenshot.png",
  "fileName": "screenshot.png",
  "mimeType": "image/png",
  "fileSize": 245000
}
```

| Field | Required | Rules |
|---|---|---|
| `taskId` | Yes | UUID of the task this attachment belongs to |
| `memberId` | Yes | WorkspaceMember record UUID **or** user UUID — server resolves either |
| `s3Key` | Yes | The `s3Key` returned by `POST /attachments/presign` |
| `fileName` | No | Original file name — server falls back to S3 metadata if omitted |
| `mimeType` | No | MIME type — server falls back to S3 metadata if omitted |
| `fileSize` | No | File size in bytes — server fetches from S3 `HeadObject` if omitted |

**Response `200`**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "s3Key": "swiftnine/docs/app/attachments/task-uuid/abc123-screenshot.png",
    "fileName": "screenshot.png",
    "mimeType": "image/png",
    "fileSize": 245000,
    "createdAt": "2026-04-14T12:00:00.000Z"
  },
  "message": "Attachment created"
}
```

**Errors**
| Status | When |
|---|---|
| 403 | `actorId` does not match the resolved member's `userId` |
| 404 | Task or workspace member not found |

---

### `POST /attachments/view`

List all attachments for a task and get presigned download URLs for each.

**Headers**
```
Authorization: Bearer <accessToken>
```

**Request**
```json
{
  "taskId": "task-uuid",
  "memberId": "workspace-member-record-uuid-or-user-uuid"
}
```

**Response `200`**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "fileName": "screenshot.png",
      "mimeType": "image/png",
      "s3Key": "swiftnine/docs/app/attachments/task-uuid/abc123-screenshot.png",
      "fileSize": 245000,
      "url": "https://s3.amazonaws.com/bucket/...?X-Amz-Signature=...",
      "expiresAt": "2026-04-14T12:15:00.000Z"
    }
  ],
  "message": "Attachments returned"
}
```

Each `url` is a presigned GET URL valid for **15 minutes**. Attachments are ordered by upload time (oldest first).

**Errors**
| Status | When |
|---|---|
| 404 | Task or workspace member not found |

---

### `DELETE /attachments`

Soft-delete an attachment from a task.

**Headers**
```
Authorization: Bearer <accessToken>
```

**Request**
```json
{
  "taskId": "task-uuid",
  "memberId": "workspace-member-record-uuid-or-user-uuid",
  "s3Key": "swiftnine/docs/app/attachments/task-uuid/abc123-screenshot.png"
}
```

**Response `200`**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "s3Key": "swiftnine/docs/app/attachments/task-uuid/abc123-screenshot.png"
  },
  "message": "Attachment deleted"
}
```

**Errors**
| Status | When |
|---|---|
| 403 | `actorId` does not match the resolved member's `userId` |
| 404 | Task, workspace member, or attachment not found |

---

## 15. Comments & Reactions Endpoints

All comment and reaction endpoints require `Authorization: Bearer <accessToken>` and `x-workspace-id`.

These endpoints support both CRUD and live task-side-panel updates through Server-Sent Events (SSE).

### `GET /tasks/:taskId/comments/stream`

Open an SSE stream for comments and reactions on a task.

**Headers**
```
Authorization: Bearer <accessToken>
x-workspace-id: <workspaceId>
```

**Behavior**
- response type is `text/event-stream`
- backend sends a heartbeat every 15 seconds
- the first event is `comments:init`

**Current SSE event names**
- `comments:init`
- `comment:created`
- `comment:updated`
- `comment:deleted`
- `reaction:created`
- `reaction:deleted`

### `POST /tasks/:taskId/comments`

Create a comment on a task, or a threaded reply if `parentId` is provided.

**Headers**
```
Authorization: Bearer <accessToken>
x-workspace-id: <workspaceId>
```

**Request**
```json
{
  "content": "This needs a retry guard",
  "parentId": "optional-parent-comment-uuid"
}
```

**Response `200`**
```json
{
  "success": true,
  "data": {
    "id": "comment-uuid",
    "taskId": "task-uuid",
    "content": "This needs a retry guard",
    "parentId": null,
    "isEdited": false,
    "createdAt": "2026-04-24T12:00:00.000Z",
    "author": {
      "id": "user-uuid",
      "fullName": "Zaeem Hassan",
      "avatarUrl": null
    },
    "reactions": []
  },
  "message": "Comment created"
}
```

### `PUT /comments/:commentId`

Update a comment. Only the author can edit, and only within 5 minutes of creation.

### `DELETE /comments/:commentId`

Delete a comment. Allowed for the comment author or the workspace OWNER.

### `POST /comments/:commentId/reactions`

Add a reaction to a comment.

**Request**
```json
{
  "reactFace": "like"
}
```

`reactFace` is a non-empty string. The frontend can treat it as an emoji identifier or symbolic reaction name.

### `DELETE /reactions/:reactionId`

Delete a reaction. Only the reaction owner can delete it.

---

## 16. Activity Endpoints

All activity endpoints require `Authorization: Bearer <accessToken>` and `x-workspace-id`.

These endpoints use **cursor pagination**, not page/limit pagination like task search.

### `GET /activity`

List workspace activity feed items.

**Headers**
```
Authorization: Bearer <accessToken>
x-workspace-id: <workspaceId>
```

**Common query params**
```
?q=status
&cursor=<activity-row-uuid>
&limit=25
&entityType=task
&entityId=<uuid>
&projectId=<uuid>
&listId=<uuid>
&taskId=<uuid>
&actorIds=<user1>,<user2>
&actions=status_changed,tag_added
&categories=status,assignee,attachments
&includeSubtasks=true
&me=true
&from=2026-04-01T00:00:00.000Z
&to=2026-04-24T23:59:59.999Z
```

**Response `200`**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "activity-uuid",
        "action": "tag_added",
        "entityType": "task",
        "entityId": "task-uuid",
        "fieldName": null,
        "message": null,
        "metadata": {},
        "createdAt": "2026-04-24T12:00:00.000Z",
        "performedBy": {
          "id": "user-uuid",
          "fullName": "Zaeem Hassan",
          "email": "zaeem@example.com"
        }
      }
    ],
    "nextCursor": "next-activity-row-uuid"
  },
  "message": null
}
```

### `GET /tasks/:taskId/activity`

List activity for one task timeline. Supports the same filter shape as `GET /activity`, but scoped to a single task.

**Notes**
- default `limit` is `25`
- max `limit` is `100`
- use `nextCursor` for infinite scroll
- `me=true` gives "my activity only" behavior

---

## 17. System

### `GET /health`

No auth required. Returns database connectivity status.

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
| Member management (`/organizations`) | `Authorization: Bearer <token>` (workspaceId in body) |
| Invite preview (`GET /workspaces/invite/:token`) | None |
| Invite claim (new user) | None |
| Invite accept (existing user) | `Authorization: Bearer <token>` |
| All project endpoints | `Authorization: Bearer <token>` + `x-workspace-id` |
| All status endpoints | `Authorization: Bearer <token>` + `x-workspace-id` |
| All task list endpoints | `Authorization: Bearer <token>` + `x-workspace-id` |
| All task endpoints | `Authorization: Bearer <token>` + `x-workspace-id` |
| All tag endpoints | `Authorization: Bearer <token>` + `x-workspace-id` |
| All time entry endpoints | `Authorization: Bearer <token>` + `x-workspace-id` |
| All attachment endpoints | `Authorization: Bearer <token>` (no `x-workspace-id`) |
| All comments / reactions endpoints | `Authorization: Bearer <token>` + `x-workspace-id` |
| All activity endpoints | `Authorization: Bearer <token>` + `x-workspace-id` |

### Who Can Do What

| Action | Required Role |
|---|---|
| Register / verify email / login | Public |
| Create workspace | Any authenticated user |
| List / view workspaces + members | Member of that workspace |
| Update workspace | OWNER |
| Delete workspace | OWNER |
| Invite members (single or batch) | OWNER |
| Remove member / change role | OWNER |
| Claim invite (new user, no account) | Public |
| Accept invite (existing user) | Any authenticated user (email must match) |
| Create project | Any workspace member |
| View / update project | Any workspace member |
| Delete project | OWNER |
| View statuses | Any workspace member |
| Create / update / delete / reorder statuses | OWNER |
| Create / view / update / archive / restore / reorder task lists | Any workspace member |
| Delete task list | Any workspace member |
| Create / view / update tasks | Any workspace member |
| Delete task | Task creator or OWNER |
| Complete / uncomplete task | Any workspace member |
| Add / remove assignees | Any workspace member |
| Create / update / delete tags | Any workspace member |
| Log manual time / start-stop timer | Any workspace member (own entries only) |
| Edit / delete time entry | Entry owner only |
| Upload / view / delete attachments | Authenticated user (must match memberId) |
| Create comment | Any workspace member |
| Edit comment | Comment author only, within 5 minutes |
| Delete comment | Comment author or OWNER |
| Add / delete reaction | Reaction owner for delete |
| View activity | Any workspace member |

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
POST /workspaces/invite/claim   log in via
 { token, fullName,             POST /auth/login
   password }                         ↓
         ↓                   POST /workspaces/invite/accept
  account created +              { token }
  workspace joined                    ↓
         ↓                    workspace joined
  redirect to workspace      redirect to workspace
  (workspaceId in data)      (workspaceId in data)
```

### Attachment Upload Flow Summary

```
POST /attachments/presign   → { uploadUrl, s3Key, expiresAt }
PUT <uploadUrl>             → direct browser → S3 upload (no auth header)
POST /attachments           → record in DB { taskId, memberId, s3Key, ... }
```

### Task ID Format

Tasks have a display ID like `API-1`, `API-2`, computed as `taskIdPrefix + '-' + taskNumber`. It is **not stored in the DB** — computed at query time. The `taskIdPrefix` set on project creation is permanent. Use the UUID `id` for all API calls; use `taskId` only for display.

### Priority Values

`"URGENT"` | `"HIGH"` | `"NORMAL"` | `"LOW"` | `"NONE"` (default)

### Duration Units

All `duration` fields (time entries, `totalTimeLogged` on tasks) are in **seconds**.

| To display as | Formula |
|---|---|
| Minutes | `duration / 60` |
| Hours | `duration / 3600` |
| `"1h 30m"` | `Math.floor(d/3600) + 'h ' + Math.floor((d%3600)/60) + 'm'` |

### Timer Behavior

- Only one active timer per user at a time across the entire workspace.
- Starting a new timer on task B auto-stops any running timer on task A.
- On app load call `GET /time-entries/active` to check for a running timer and restore UI state.

### Task List & Status Positioning

Both task lists and statuses use gap-based integer `position` values (1000, 2000, …). Always use positions returned by the server — never hardcode or persist them on the frontend. Send all IDs in the desired order when reordering; the server recalculates positions.

### profilePicture Format (User Module)

| Value | What it means |
|---|---|
| `"initials:ZH"` | Show colored circle with letters ZH |
| `"ZH"` | Shorthand — server normalizes to `"initials:ZH"` |
| `"https://..."` | Direct image URL |

To render: check if value starts with `"initials:"` → render an avatar circle with those letters. Otherwise treat as `<img>` src.

### Google OAuth Callback Page

Your frontend needs a `/auth/callback` route:

```ts
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

### Password Rules (All Endpoints)

Min 8 characters, must contain at least one uppercase letter, one lowercase letter, one number, and one special character.

Applies to: register, reset-password, change-password, invite claim.

### Invite Endpoint Paths (Correct Full Paths)

The invite endpoints live under `/workspaces`, not `/invite`:

| Action | Correct path |
|---|---|
| Preview invite | `GET /workspaces/invite/:token` |
| Claim invite (new user) | `POST /workspaces/invite/claim` |
| Accept invite (existing user) | `POST /workspaces/invite/accept` |
