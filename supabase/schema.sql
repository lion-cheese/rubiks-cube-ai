create extension if not exists pgcrypto;

create table if not exists public.solve_attempts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default timezone('utc', now()),
  scramble jsonb not null default '[]'::jsonb,
  move_history jsonb not null default '[]'::jsonb,
  move_count integer not null default 0,
  solved boolean not null default false,
  solve_duration_ms integer,
  solver_solution jsonb,
  optimal_move_count integer,
  move_count_delta integer,
  redundant_move_count integer not null default 0,
  inverse_move_pairs integer not null default 0,
  repeated_move_patterns jsonb not null default '[]'::jsonb,
  ai_feedback text,
  start_facelets text,
  end_facelets text not null
);

create index if not exists solve_attempts_created_at_idx
  on public.solve_attempts (created_at desc);
