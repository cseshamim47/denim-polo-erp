# Denim Polo ERP

Denim Polo ERP is a lightweight business management system for a three-partner clothing shop in Kushtia, Bangladesh. It replaces paper-based tracking for sales, stock, expenses, returns, investments, and partner visibility.

## What the app covers

- Sales entry with profit snapshot at time of sale
- Variant stock tracking with weighted average cost updates on purchase
- Expense approval workflow for partners
- Customer return and damaged return handling
- Purchase bill image uploads with UploadThing
- Partner investment tracking and profit-share reporting
- Google OAuth for partners and credentials login for the salesman

## Stack

- Next.js 16 App Router
- MongoDB with Mongoose
- NextAuth.js
- UploadThing
- Vitest
- Vercel deployment target

## Prerequisites

- Node.js 20+
- npm 10+
- MongoDB database
- Google Cloud OAuth client
- UploadThing app token

## Environment variables

Create `.env` from `.env.example` and fill every value before running the app.

```env
MONGODB_URI=
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=
PARTNER_EMAILS=partner1@gmail.com,partner2@gmail.com,partner3@gmail.com
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
SALESMAN_EMAIL=salesman@denimpolo.local
SALESMAN_PASSWORD=
SALESMAN_NAME=Default Salesman
UPLOADTHING_TOKEN=
```

### Variable notes

- `MONGODB_URI`: MongoDB connection string for local or hosted database.
- `NEXTAUTH_URL`: Base URL of the app. Use `http://localhost:3000` locally and the production domain on Vercel.
- `NEXTAUTH_SECRET`: Random secret used by NextAuth JWT/session signing.
- `PARTNER_EMAILS`: Comma-separated Google email allowlist for partner access.
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`: Google OAuth credentials for partner login.
- `SALESMAN_EMAIL`, `SALESMAN_PASSWORD`, `SALESMAN_NAME`: Credentials login for the salesman account.
- `UPLOADTHING_TOKEN`: UploadThing server token used by the purchase bill image upload route.

## Local setup

1. Install dependencies.

```bash
npm install
```

2. Create `.env` from `.env.example` and fill the required values.

3. Seed the salesman account.

```bash
npm run seed:salesman
```

If you want a ready-to-click demo workspace with purchases, sales, returns,
expenses, investments, dashboard trends, and low-stock examples, run:

```bash
npm run seed:demo
```

4. Start the app.

```bash
npm run dev
```

5. Open `http://localhost:3000`.

### Login flows

- Partners click `Continue with Google` and must use an email listed in `PARTNER_EMAILS`.
- The salesman signs in with `SALESMAN_EMAIL` and `SALESMAN_PASSWORD`.

## Google OAuth setup

Create a Google OAuth app in Google Cloud Console.

### Authorized redirect URIs

- Local: `http://localhost:3000/api/auth/callback/google`
- Production: `https://YOUR_DOMAIN/api/auth/callback/google`

### Authorized JavaScript origins

- Local: `http://localhost:3000`
- Production: `https://YOUR_DOMAIN`

The Google account used by each partner must also be included in `PARTNER_EMAILS`.

## UploadThing setup

1. Create an UploadThing app.
2. Copy the token into `UPLOADTHING_TOKEN`.
3. The app uses the `purchaseBill` route and accepts one image up to 4 MB.
4. Purchase bill uploads are available from the purchase entry page.

## Useful commands

```bash
npm run dev
npm run seed:demo
npm test
npx vitest run tests/unit/pricingHelper.test.ts
npm run build
```

## What gets seeded

`npm run seed:salesman` creates or updates a single active salesman user with:

- role: `salesman`
- auth provider: `credentials`
- password hash generated from `SALESMAN_PASSWORD`

Partners are created automatically on first successful Google sign-in.

## Deployment on Vercel

1. Push the repository to GitHub.
2. Create a new Vercel project pointing to this repository.
3. Add all environment variables from `.env.example` in the Vercel project settings.
4. Set `NEXTAUTH_URL` to the production domain.
5. Update the Google OAuth app with the production origin and callback URL.
6. Run the first deployment.
7. After deployment, sign in once as each partner to create partner records.
8. Run `npm run seed:salesman` against the production database only if you want the salesman account available there.

## Validation checklist before production

Run these locally before shipping:

```bash
npm test
npm run build
```

Verify these manually:

- Partner Google sign-in works only for allowlisted emails.
- Salesman credentials login works.
- UploadThing bill upload works from the purchase page.
- A purchase updates stock and average cost.
- A sale reduces stock and snapshots profit.
- Reports show partner investments and current profit-share amounts.

## Current module map

- Dashboard: `/`
- Sales entry: `/sales/new`
- Products and pricing helper: `/products`
- Purchases: `/purchases/new`
- Expenses: `/expenses`
- Returns: `/returns`
- Reports and investments: `/reports`
