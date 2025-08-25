
-- Create a trigger function
create or replace function on_new_waitlist_user() 
returns trigger as $$
begin
  -- Trigger the edge function
  perform net.http_post(
    url := 'http://localhost:54321/functions/v1/send-welcome-email',
    headers := json_build_object('Content-Type', 'application/json')::jsonb,
    body := json_build_object('record', new)::jsonb
  );
  return new;
end;
$$ language plpgsql;

-- Create the trigger
create trigger on_new_waitlist_user_trigger
after insert on public.waitlist
for each row
execute function on_new_waitlist_user();
