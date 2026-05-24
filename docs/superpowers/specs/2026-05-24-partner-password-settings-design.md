# Partner Password Settings Design

## Goal

Add DB-backed email/password login for both partners and salesmen while keeping Google OAuth available for partners, and provide a `/settings` page where signed-in users can update their display name and password.

## Scope

This work covers:

- credentials login for `partner` and `salesman` users from the `User` collection
- keeping partner Google login active
- a settings page inside the dashboard for profile and password changes
- one-time password initialization for existing users with password `123`

This work does not cover:

- password reset by email
- forced password rotation
- role management changes
- any updates to business transaction data

## Current State

- Partners authenticate only through Google allowlist flow in [lib/auth.ts](/D:/Others/w/dpe/lib/auth.ts:1).
- Salesmen authenticate through `.env` credentials in the same file.
- User records already include `passwordHash`, `role`, `authProvider`, `name`, and `email` in [models/User.ts](/D:/Others/w/dpe/models/User.ts:1).
- The dashboard layout already has a consistent shell and mobile nav in [app/(dashboard)/layout.tsx](/D:/Others/w/dpe/app/(dashboard)/layout.tsx:1) and [app/(dashboard)/_components/dashboard-shell.tsx](/D:/Others/w/dpe/app/(dashboard)/_components/dashboard-shell.tsx:1).

## Decisions

### Authentication Model

- Credentials login will become DB-backed for both `partner` and `salesman`.
- Google login will remain available for partners.
- A partner account may authenticate through Google and credentials using the same email.
- `passwordHash` will be the source of truth for credentials login.
- `authProvider` will continue describing the user's primary account origin, not block additional allowed login methods.

### Initial Password Seeding

- Existing partner and salesman users will receive password `123` through a one-time script.
- The script will only update `User.passwordHash` for targeted users.
- No purchase, sale, stock, approval, expense, investment, asset, or return data will be modified.
- The script will not be auto-run by the app.

### Settings UX

- `/settings` will be available to both partners and salesmen inside the dashboard shell.
- The page will use the current design language: panel layout, compact cards, and responsive stacked sections.
- The page will have two focused cards:
  - Profile: update display name
  - Security: change password with old password, new password, and confirm password
- The forms will be lightweight client components inside a server-rendered page to keep mobile load fast.

## Data Flow

### Credentials Sign-In

1. User submits email and password from the login page.
2. NextAuth credentials provider validates the payload.
3. App loads the matching active `User` record from MongoDB.
4. App compares the submitted password against `passwordHash` with `bcryptjs`.
5. If valid, session is created with the stored user role and identity.

### Partner Google Sign-In

1. Partner signs in with Google.
2. Allowlist validation still uses `PARTNER_EMAILS`.
3. Existing partner record is upserted or refreshed.
4. If the record already has `passwordHash`, that value remains untouched.

### Profile Update

1. Authenticated user submits a trimmed name.
2. API validates session and payload.
3. App updates only the current user record.
4. Response returns updated name so the client can refresh UI state cleanly.

### Password Update

1. Authenticated user submits old password, new password, and confirmation.
2. API validates payload and matches old password against current `passwordHash`.
3. API rejects mismatched confirmation or invalid old password.
4. API writes the new hashed password to `User.passwordHash`.

## Backend Structure

### Auth

- Update [lib/auth.ts](/D:/Others/w/dpe/lib/auth.ts:1) to support DB-backed credentials login for both roles.
- Extract password verification and payload parsing into small helper functions so auth logic stays readable.

### Services

Add focused helpers instead of expanding auth/page files too much:

- `lib/services/user-auth.ts`
  - load active user by email
  - verify password hash
  - hash new password
- `lib/services/user-settings.ts`
  - update current user name
  - update current user password
- `lib/domain/settings.ts`
  - request validation helpers for profile/password forms

### API

Add route handlers:

- `app/api/settings/profile/route.ts`
- `app/api/settings/password/route.ts`

These routes will require an authenticated session for `partner` or `salesman`.

### Script

Add a one-time script, likely:

- `scripts/set-user-passwords.mjs`

Behavior:

- connect with `MONGODB_URI`
- find active partners and salesmen
- hash `123`
- update only `passwordHash`
- print counts of updated users

The script will be run only with explicit user approval because it changes production user records.

## Frontend Structure

### Login Page

Update [app/login/login-form.tsx](/D:/Others/w/dpe/app/login/login-form.tsx:1):

- keep partner Google card
- add a shared credentials form for email/password sign-in
- remove salesman-only wording
- keep messaging clear that partners may use Google or password

### Settings Page

Add:

- `app/(dashboard)/settings/page.tsx`
- `app/(dashboard)/settings/_components/profile-settings-form.tsx`
- `app/(dashboard)/settings/_components/password-settings-form.tsx`

The page should:

- render quickly with small forms only
- avoid large client-side data fetching
- use shadcn primitives already present in the repo where helpful
- stay touch-friendly on mobile with full-width actions and readable spacing

### Navigation

Add `/settings` to dashboard nav in [app/(dashboard)/layout.tsx](/D:/Others/w/dpe/app/(dashboard)/layout.tsx:1).

## Validation Rules

- Name must be non-empty after trimming.
- Old password is required to change password.
- New password and confirmation must match.
- New password cannot be empty.
- Inactive users cannot authenticate or update settings.
- Credentials login fails cleanly when `passwordHash` is missing.

## Error Handling

- Login should return the same generic credentials error for invalid email/password combinations.
- Settings forms should show inline or toast feedback for validation and save results.
- API responses should avoid leaking whether an email exists during login.
- Password change must never return the existing hash or sensitive metadata.

## Performance Notes

- Keep settings page mostly server-rendered with isolated client forms.
- Reuse the current dashboard shell instead of adding a new layout.
- Avoid refetch-heavy patterns; update local UI from response payload when possible.
- Keep form state local to each card so mobile devices do not re-render the whole page unnecessarily.

## Testing Strategy

### Unit Tests

- credentials auth helper validates correct password acceptance/rejection
- profile update validator trims and rejects empty names
- password update validator enforces old/new/confirm rules

### Integration Tests

- credentials sign-in works for a seeded partner user
- credentials sign-in works for a seeded salesman user
- Google partner flow still preserves existing `passwordHash`
- settings profile route updates only current user name
- settings password route rejects bad old password and accepts valid changes

### Verification

- run focused Vitest coverage for new auth/settings helpers
- run lint
- run build

## Risks And Mitigations

- Risk: overwriting existing password hashes during Google sign-in
  - Mitigation: keep password updates out of partner Google upsert path
- Risk: mixing `.env` salesman auth with DB auth creates ambiguity
  - Mitigation: credentials login reads only DB users after this feature
- Risk: accidental broad DB mutation from seed script
  - Mitigation: isolate script to `User.passwordHash` updates only and require explicit execution approval

## Success Criteria

- Partners can sign in with Google or email/password.
- Salesmen can sign in with email/password from DB.
- Both roles can open `/settings`.
- Both roles can change display name and password.
- Existing users can be initialized to password `123` through one explicit script run.
- No business records are modified by this feature.
