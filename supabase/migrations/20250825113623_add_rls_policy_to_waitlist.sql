
-- Enable Row Level Security
alter table public.waitlist enable row level security;

-- Create a policy to allow public insertion
create policy "Allow public insert" on public.waitlist for insert
with
  check (true);
