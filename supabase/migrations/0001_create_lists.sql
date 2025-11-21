create extension if not exists pgcrypto;

create table if not exists public.lists (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  visibility text not null default 'public',
  movies int[] not null default '{}',
  created_at timestamptz not null default timezone('utc', now())
);
