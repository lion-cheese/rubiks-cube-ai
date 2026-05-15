# Rubik's Cube AI

An interactive full-stack Rubik's Cube solver built with Next.js, TypeScript, Supabase, and OpenAI.

This project combines a tactile 3D cube interface with backend solve analysis, persisted solve history, and short coaching feedback. Users can manipulate the cube directly, generate and step through solver output, save solve attempts, and review performance metrics from previous runs.

## Overview

Rubik's Cube AI is a showcase project that extends a polished frontend interaction into a small end-to-end product. The app provides:

- A responsive 3D Rubik's Cube interface with direct manipulation
- Manual move controls, scramble generation, and guided solution playback
- Persisted solve attempts stored in Supabase
- Backend-generated analysis for move efficiency and redundant patterns
- Short coaching feedback generated from solve metrics, with a deterministic fallback when no OpenAI API key is configured

The result is a project that demonstrates frontend interaction design, App Router API development, server-side data persistence, and practical AI integration grounded in structured metrics.

## Key Features

- Interactive 3D cube view with drag-to-rotate controls
- Manual face turns, scramble flow, reset, and solve actions
- Step-by-step solution playback with progress tracking
- Recorded move timeline for each in-session solve
- Saved solve history with timestamps, move counts, and results
- Backend solve analysis including:
  - solver baseline length
  - move-count delta
  - inverse move pairs
  - repeated move patterns
  - redundant move count
- Stored coaching feedback for each solve attempt
- Regenerable feedback for saved attempts through API routes

## Tech Stack

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- `cubejs` for cube state and solving utilities
- Supabase for persistence
- OpenAI for short feedback generation

## Architecture

The project is structured as a small full-stack Next.js application:

- [`app/`](/C:/Users/Lian%20Cheng/GitHub/rubiks-cube-ai/app) contains the App Router pages, global styles, and API route handlers
- [`components/`](/C:/Users/Lian%20Cheng/GitHub/rubiks-cube-ai/components) contains the main interactive Rubik's Cube UI
- [`lib/`](/C:/Users/Lian%20Cheng/GitHub/rubiks-cube-ai/lib) contains cube utilities, solve analysis, feedback generation, persistence services, and the Supabase server client
- [`supabase/schema.sql`](/C:/Users/Lian%20Cheng/GitHub/rubiks-cube-ai/supabase/schema.sql) defines the `solve_attempts` table used by the app

High-level flow:

1. The client records scramble state, move history, and solve outcome.
2. A Next.js route handler saves the attempt through the server-side service layer.
3. Backend analysis computes metrics such as move delta, inverse pairs, and repeated patterns.
4. Feedback is generated from those metrics and stored with the solve record.
5. The UI loads recent attempts and detailed metrics for review.

## Environment Variables

Create a `.env.local` file in the project root:

```bash
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
OPENAI_API_KEY=your_openai_api_key
OPENAI_FEEDBACK_MODEL=gpt-5-mini
```

### Required

- `SUPABASE_URL`
  Supabase project URL used by the server-side client.
- `SUPABASE_SERVICE_ROLE_KEY`
  Supabase service role key used by the Next.js route handlers to read and write solve attempts.

### Optional

- `OPENAI_API_KEY`
  Enables LLM-generated coaching feedback. If omitted, the application still saves solve attempts and generates deterministic rule-based feedback locally.
- `OPENAI_FEEDBACK_MODEL`
  Overrides the feedback model. If omitted, the app defaults to `gpt-5-mini`.

Important:

- Place `.env.local` in the repository root, next to `package.json`.
- Do not expose the service role key through any `NEXT_PUBLIC_*` variable.

## Local Development

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Create `.env.local` in the project root and add the required values shown above.

### 3. Create the Supabase table

Run the SQL in [`supabase/schema.sql`](/C:/Users/Lian%20Cheng/GitHub/rubiks-cube-ai/supabase/schema.sql) against your Supabase project.

### 4. Start the development server

```bash
npm run dev
```

Open `http://localhost:3000`.

## Available Scripts

- `npm run dev` starts the local development server
- `npm run build` creates a production build
- `npm run start` runs the production build
- `npm run lint` runs ESLint
- `npm run typecheck` runs TypeScript checks
- `npm run check` runs linting and type checking together

## API Surface

The app uses App Router route handlers for solve persistence and review:

- `GET /api/solve-attempts` returns recent solve history
- `POST /api/solve-attempts` saves a solve attempt, computes metrics, and stores feedback
- `GET /api/solve-attempts/[id]/analysis` returns a detailed solve record
- `POST /api/solve-attempts/[id]/feedback` regenerates and stores feedback for an existing solve

## Data Model

The primary Supabase table is `solve_attempts`. It stores:

- scramble and move history
- solved status and solve duration
- solver baseline data
- efficiency and redundancy metrics
- stored feedback
- cube state snapshots used for analysis

## Roadmap

Potential next steps for the project:

- Authentication and per-user solve history
- Richer analytics and solve trend views
- Playback controls with animation timing options
- More advanced coaching feedback and solve categorization
