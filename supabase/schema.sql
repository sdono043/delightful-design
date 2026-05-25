-- ============================================================
-- Delightful Design — Database Schema
-- Run this in your Supabase project's SQL editor
-- ============================================================

-- Designers (one per auth user — you, the designer)
create table if not exists designers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  firm_name text not null default 'Ann Merideth Design',
  created_at timestamptz not null default now()
);

-- Clients
create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  designer_id uuid not null references designers(id) on delete cascade,
  name text not null,
  email text not null,
  created_at timestamptz not null default now()
);

-- Projects
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  designer_id uuid not null references designers(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  name text not null,
  status text not null default 'draft' check (status in ('draft', 'sent', 'submitted', 'complete')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Rooms within a project
create table if not exists rooms (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  display_order int not null default 0,
  created_at timestamptz not null default now()
);

-- Sourced items per room
create table if not exists items (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  category text not null default 'furniture' check (
    category in ('furniture', 'wall_finish', 'fixture', 'textile', 'accessory', 'other')
  ),
  name text not null,
  vendor text,
  price numeric(10, 2),
  image_url text,
  product_url text not null,
  designer_note text,
  created_at timestamptz not null default now()
);

-- Client selections (one row per item after client submits)
create table if not exists selections (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  item_id uuid not null references items(id) on delete cascade,
  selected boolean not null default false,
  client_note text,
  created_at timestamptz not null default now(),
  unique(project_id, item_id)
);

-- Magic link tokens for client portal access
create table if not exists magic_tokens (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  token text not null unique default encode(gen_random_bytes(32), 'hex'),
  expires_at timestamptz not null default (now() + interval '30 days'),
  opened_at timestamptz,
  submitted_at timestamptz,
  created_at timestamptz not null default now()
);

-- Auto-update updated_at on projects
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger projects_updated_at
  before update on projects
  for each row execute function update_updated_at();

-- Auto-create a designer record when a new auth user signs up
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into designers (user_id, firm_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'firm_name', 'My Design Firm'));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================================
-- Row Level Security
-- ============================================================

alter table designers enable row level security;
alter table clients enable row level security;
alter table projects enable row level security;
alter table rooms enable row level security;
alter table items enable row level security;
alter table selections enable row level security;
alter table magic_tokens enable row level security;

-- Designers: only own row
create policy "designers_own" on designers
  for all using (user_id = auth.uid());

-- Clients: designer owns
create policy "clients_own" on clients
  for all using (
    designer_id in (select id from designers where user_id = auth.uid())
  );

-- Projects: designer owns
create policy "projects_own" on projects
  for all using (
    designer_id in (select id from designers where user_id = auth.uid())
  );

-- Rooms: through project ownership
create policy "rooms_own" on rooms
  for all using (
    project_id in (
      select id from projects
      where designer_id in (select id from designers where user_id = auth.uid())
    )
  );

-- Items: through room/project ownership
create policy "items_own" on items
  for all using (
    room_id in (
      select r.id from rooms r
      join projects p on p.id = r.project_id
      where p.designer_id in (select id from designers where user_id = auth.uid())
    )
  );

-- Selections: designer can read/write; client can insert/update via token (handled in API)
create policy "selections_own" on selections
  for all using (
    project_id in (
      select id from projects
      where designer_id in (select id from designers where user_id = auth.uid())
    )
  );

-- Magic tokens: designer owns
create policy "magic_tokens_own" on magic_tokens
  for all using (
    project_id in (
      select id from projects
      where designer_id in (select id from designers where user_id = auth.uid())
    )
  );

-- Service role bypass (for API routes that use the service key)
-- These are handled by the service_role key in API routes, not RLS policies
