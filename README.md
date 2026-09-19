# Student Activity Checker

**Current Version: v0.8.1**

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Riri0726/ActivityChecker)

A web portal that lets students check their activity scores, appeal wrong scores, and request missing activity make-ups. Teachers (admins) manage everything through Excel uploads and an in-app gradebook.

## Tech Stack

- **Frontend**: React + Vite
- **Database/Backend**: Supabase (PostgreSQL + Auth + RLS)
- **Hosting**: Vercel

## Getting Started

### 1. Clone & Install

```bash
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and fill in your Supabase credentials:

```bash
cp .env.example .env
```

### 3. Set Up Supabase

Run the SQL in `supabase/schema.sql` in your Supabase SQL editor to create all tables and RLS policies.

### 4. Run Locally

```bash
npm run dev
```

### 5. Deploy to Vercel

Connect your repo to Vercel and add the environment variables from `.env`.

## Project Structure

```
src/
  components/       # Reusable UI components
  context/          # React context (auth, etc.)
  pages/            # Page-level components
  services/         # Supabase + business logic
  App.jsx           # Routes + layout
  main.jsx          # Entry point
  index.css         # Global styles + design system
supabase/
  schema.sql        # Full DB schema + RLS policies
CHANGELOG.md        # Version history
```

## Documentation

See [CHANGELOG.md](./CHANGELOG.md) for full version history.
