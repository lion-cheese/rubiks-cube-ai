# Rubik's Cube AI

Phase 2 turns the original frontend-only Rubik's Cube demo into a small full-stack project. The app still provides the interactive cube, move controls, scramble/reset/solve flow, and guided playback, but now it also persists solve attempts, computes backend analysis, and stores AI-generated coaching feedback.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- `cubejs`
- Supabase for persistence
- OpenAI for short coaching feedback

## Features

- Interactive 3D Rubik's Cube UI
- Move console, scramble flow, and guided solution playback
- Move history and solve-state tracking
- Backend solve analysis for:
  - move count
  - solved status
  - solver baseline length
  - move-count delta
  - inverse move pairs
  - repeated patterns
  - redundant move count
- Solve history persistence in Supabase
- Stored AI coaching feedback per solve

## Environment variables

Create a `.env.local` file in the project root:

```bash
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
OPENAI_API_KEY=your_openai_api_key
OPENAI_FEEDBACK_MODEL=gpt-5-mini
```

Notes:

- `SUPABASE_SERVICE_ROLE_KEY` is used only on the server through Next.js route handlers.
- If `OPENAI_API_KEY` is missing, the app still saves solves and falls back to deterministic non-LLM feedback.

## Supabase setup

Run the schema in [supabase/schema.sql](supabase/schema.sql) against your Supabase project.

The main table is `solve_attempts`, which stores:

- `scramble`
- `move_history`
- `move_count`
- `solved`
- `solve_duration_ms`
- `solver_solution`
- `optimal_move_count`
- `move_count_delta`
- `redundant_move_count`
- `inverse_move_pairs`
- `repeated_move_patterns`
- `ai_feedback`
- `start_facelets`
- `end_facelets`

## API routes

The app uses App Router route handlers:

- `GET /api/solve-attempts`
  Returns recent solve history.
- `POST /api/solve-attempts`
  Saves a solve attempt, computes analysis, and stores feedback.
- `GET /api/solve-attempts/[id]/analysis`
  Returns a full solve record with metrics.
- `POST /api/solve-attempts/[id]/feedback`
  Regenerates and stores feedback for an existing solve.

## Local development

Install dependencies and start the app:

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Scripts

- `npm run dev`
- `npm run build`
- `npm run lint`
- `npm run typecheck`
- `npm run check`

## Interview-ready talking points

- Full-stack extension of an interactive frontend prototype
- Backend solve analysis separated from AI summarization
- Supabase-backed persistence with App Router route handlers
- Practical AI feature that is grounded in deterministic metrics rather than raw LLM guesswork
