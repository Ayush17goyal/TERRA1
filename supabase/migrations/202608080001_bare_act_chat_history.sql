-- Create tables for Bare Act AI Conversation History

create table if not exists public.bare_act_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id text not null, -- Stores Clerk User ID string directly
  title text,
  mode text not null default 'explain',
  last_message text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.bare_act_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.bare_act_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamp with time zone not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

-- Indexes for performance and sorting
create index if not exists idx_bare_act_conv_user_updated on public.bare_act_conversations(user_id, updated_at desc);
create index if not exists idx_bare_act_msg_conv_created on public.bare_act_messages(conversation_id, created_at asc);

-- Enable Row Level Security (RLS)
alter table public.bare_act_conversations enable row level security;
alter table public.bare_act_messages enable row level security;

-- RLS policies for conversations
drop policy if exists "users own bare_act_conversations" on public.bare_act_conversations;
create policy "users own bare_act_conversations" on public.bare_act_conversations
  for all using (user_id = auth.uid()::text) with check (user_id = auth.uid()::text);

-- RLS policies for messages
drop policy if exists "users own bare_act_messages" on public.bare_act_messages;
create policy "users own bare_act_messages" on public.bare_act_messages
  for all using (
    exists (
      select 1 from public.bare_act_conversations c
      where c.id = bare_act_messages.conversation_id
      and c.user_id = auth.uid()::text
    )
  ) with check (
    exists (
      select 1 from public.bare_act_conversations c
      where c.id = bare_act_messages.conversation_id
      and c.user_id = auth.uid()::text
    )
  );

notify pgrst, 'reload schema';
