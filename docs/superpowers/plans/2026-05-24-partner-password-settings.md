# Partner Password Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add DB-backed email/password login for partners and salesmen, keep Google sign-in for partners, add a dashboard settings page for name/password changes, and prepare a one-time password seed script for existing users.

**Architecture:** Move credentials login onto the existing `User` model with small auth/settings service helpers, keep Google partner upsert behavior intact, and add two focused settings APIs plus lightweight dashboard form components. Seed existing user password hashes through an explicit one-time script that only touches `User.passwordHash`.

**Tech Stack:** Next.js App Router, React 19, TypeScript, NextAuth, Mongoose, bcryptjs, shadcn UI, Vitest

---

### Task 1: Add failing tests for DB credentials and settings validation

**Files:**
- Create: `tests/unit/user-auth.test.ts`
- Create: `tests/unit/user-settings.test.ts`
- Modify: `tests/integration/expenses.test.ts` only if existing test helpers need shared auth setup
- Modify: `tests/helpers/mongodb.ts` only if needed for deterministic auth fixture setup

- [ ] **Step 1: Write failing unit tests for password helpers**

Add tests that expect:
- password hashing helper returns a hash different from plaintext
- password verification accepts a matching password
- password verification rejects a wrong password
- credential auth returns `null` when user is inactive or has no password hash

- [ ] **Step 2: Write failing validation tests for settings payloads**

Add tests that expect:
- profile payload trims and rejects empty names
- password payload rejects missing old password
- password payload rejects empty new password
- password payload rejects mismatched confirmation

- [ ] **Step 3: Run focused tests to confirm red**

Run: `npm test -- tests/unit/user-auth.test.ts tests/unit/user-settings.test.ts`

Expected: FAIL because helpers do not exist yet.

- [ ] **Step 4: Commit red test checkpoint if helpful**

Optional if the red checkpoint is clean and isolated.

### Task 2: Build auth and settings domain helpers

**Files:**
- Create: `lib/services/user-auth.ts`
- Create: `lib/services/user-settings.ts`
- Create: `lib/domain/settings.ts`

- [ ] **Step 1: Add password helper functions in `lib/services/user-auth.ts`**

Implement focused helpers for:
- finding an active user by normalized email
- hashing a password with `bcryptjs`
- verifying a plaintext password against `passwordHash`
- building the auth-safe session payload shape

- [ ] **Step 2: Add request validation helpers in `lib/domain/settings.ts`**

Implement pure helpers for:
- `parseProfileSettingsInput`
- `parsePasswordSettingsInput`

- [ ] **Step 3: Add user settings mutation helpers in `lib/services/user-settings.ts`**

Implement focused service functions for:
- updating the current user's name
- changing the current user's password after verifying old password

- [ ] **Step 4: Re-run focused unit tests and confirm green**

Run: `npm test -- tests/unit/user-auth.test.ts tests/unit/user-settings.test.ts`

Expected: PASS

### Task 3: Switch credentials auth to DB users while preserving partner Google

**Files:**
- Modify: `lib/auth.ts`
- Modify: `models/User.ts` only if a tiny type expansion is needed

- [ ] **Step 1: Add failing auth integration tests**

Create or extend tests to prove:
- partner credentials login succeeds for a DB user with a valid hash
- salesman credentials login succeeds for a DB user with a valid hash
- partner Google sign-in upsert path does not clear an existing `passwordHash`

- [ ] **Step 2: Run the focused auth tests and confirm red**

Run the exact focused Vitest command for the new auth tests.

Expected: FAIL because auth still uses salesman `.env` credentials only.

- [ ] **Step 3: Update credentials parsing in `lib/auth.ts`**

Replace salesman-only credential logic with DB-backed logic that:
- accepts email/password
- normalizes email
- loads active user from MongoDB
- verifies password hash
- returns session payload with `role`

- [ ] **Step 4: Preserve Google partner flow**

Keep allowlist behavior and ensure Google upsert:
- leaves `passwordHash` untouched
- does not deactivate active users
- keeps partner role

- [ ] **Step 5: Run focused auth tests and confirm green**

Run the same focused auth test command.

Expected: PASS

### Task 4: Add settings APIs

**Files:**
- Create: `app/api/settings/profile/route.ts`
- Create: `app/api/settings/password/route.ts`
- Modify: `lib/auth.ts` only if session helper exposure is needed

- [ ] **Step 1: Add failing route tests for profile and password updates**

Cover:
- authenticated partner can update name
- authenticated salesman can update name
- password route rejects invalid old password
- password route accepts correct old password and updates hash

- [ ] **Step 2: Run focused route tests and confirm red**

Run the exact settings route test command.

Expected: FAIL because routes do not exist yet.

- [ ] **Step 3: Implement profile route**

Require `partner` or `salesman` session and update only current user name.

- [ ] **Step 4: Implement password route**

Require `partner` or `salesman` session and change only current user password after validation and old-password verification.

- [ ] **Step 5: Run focused route tests and confirm green**

Run the same focused route test command.

Expected: PASS

### Task 5: Update login UI for shared credentials sign-in

**Files:**
- Modify: `app/login/login-form.tsx`
- Create: `app/login/login-form.types.ts` only if needed to keep component readable

- [ ] **Step 1: Add or update UI tests only if a stable pattern already exists**

If no UI test pattern exists, skip test creation and keep verification at build + manual review level.

- [ ] **Step 2: Refactor login form copy and state**

Change salesman-only wording to shared credentials wording:
- keep Google partner card
- keep one email/password form for both roles
- update error copy to generic invalid credentials feedback

- [ ] **Step 3: Keep interaction light for mobile**

Use minimal client state, full-width buttons, and no unnecessary extra fetches or conditional trees.

- [ ] **Step 4: Verify through lint/build and auth-focused tests**

Run the relevant verification command set after UI change.

### Task 6: Build dashboard settings page and components

**Files:**
- Create: `app/(dashboard)/settings/page.tsx`
- Create: `app/(dashboard)/settings/_components/profile-settings-form.tsx`
- Create: `app/(dashboard)/settings/_components/password-settings-form.tsx`
- Modify: `app/(dashboard)/layout.tsx`
- Modify: `proxy.ts` if route protection rules need extension

- [ ] **Step 1: Add server page shell**

Create a small server page that:
- requires `partner` or `salesman` session
- passes current user display info into focused client forms

- [ ] **Step 2: Build profile form**

Use shadcn-style form controls consistent with current dashboard panels.

- [ ] **Step 3: Build password form**

Include:
- old password
- new password
- confirm new password
- clear success/error feedback

- [ ] **Step 4: Add nav item**

Add `/settings` to dashboard navigation while keeping mobile nav behavior unchanged.

- [ ] **Step 5: Verify responsive behavior through build and browser-safe manual review when localhost is available**

At minimum confirm compile/build health and keep component boundaries small.

### Task 7: Add one-time password seed script

**Files:**
- Create: `scripts/set-user-passwords.mjs`
- Modify: `package.json`

- [ ] **Step 1: Add failing script-level smoke expectation if practical**

If there is a lightweight pattern, add a helper-level test; otherwise keep this script small and validate via code review plus syntax-safe execution pattern.

- [ ] **Step 2: Implement the script**

Requirements:
- reads `MONGODB_URI`
- hashes plaintext `123`
- updates active `partner` and `salesman` users only
- touches only `passwordHash`
- prints updated counts

- [ ] **Step 3: Add a package script alias**

Add a clearly named npm script so the one-time command is easy to run deliberately.

- [ ] **Step 4: Do not execute the script without explicit user confirmation**

The script changes production user records, so leave execution for a separate approval step.

### Task 8: Verify, commit, and push

**Files:**
- Modify any touched files if verification finds issues

- [ ] **Step 1: Run focused auth/settings unit and route tests**

Run the exact Vitest commands for the new helper and route coverage.

- [ ] **Step 2: Run broader relevant tests**

Run any additional integration tests touched by auth/session behavior.

- [ ] **Step 3: Run lint**

Run: `npm run lint`

Expected: pass with no new warnings beyond known seed script warnings if they remain unchanged.

- [ ] **Step 4: Run production build**

Run: `npm run build`

Expected: PASS

- [ ] **Step 5: Commit in clean logical chunks**

Suggested chunks:
- auth helpers + tests
- settings page + APIs
- password seed script

- [ ] **Step 6: Push to GitHub**

Push only after verification is green.
