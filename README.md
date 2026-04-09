# sPany

A minimal, client-side encrypted password manager built as a personal project. All encryption happens in the browser the server never sees your passwords in plain text.

Live at [claus.angeljoan.com](https://claus.angeljoan.com)

## How it works

Each user has a vault key (AES-256) that is encrypted with a PIN-derived key (PBKDF2, 310k iterations, SHA-256) before being stored in the database. Passwords are encrypted client-side with the vault key using AES-256-GCM before any data leaves the browser.

## Features

- PIN-based authentication (6 digits) with haptic feedback
- Client-side AES-256-GCM encryption via Web Crypto API
- Add, edit, and delete credentials
- Password generator
- Encrypted backup export and import

## Tech stack

- [Next.js 16](https://nextjs.org) — React framework
- [Supabase](https://supabase.com) — database and backend
- [Tailwind CSS v4](https://tailwindcss.com) — styling
- [shadcn/ui](https://ui.shadcn.com) — UI components
- [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API) — all cryptography, no third-party crypto libraries

## Running locally

1. Clone the repo
2. Install dependencies: `npm install`
3. Create a `.env.local` file with your Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. Run the development server: `npm run dev`
