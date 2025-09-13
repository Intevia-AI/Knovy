--supabase/migrations/20250913120000_create_rbac_tables.sql

-- 1. Roles Table
CREATE TABLE public.roles (
    name TEXT PRIMARY KEY,
    description TEXT
);
COMMENT ON TABLE public.roles IS 'Defines user roles like free, pro, admin.';

-- 2. Permissions Table
CREATE TABLE public.permissions (
    name TEXT PRIMARY KEY,
    description TEXT
);
COMMENT ON TABLE public.permissions IS 'Defines granular permissions for actions.';

-- 3. Role-Permissions Join Table
CREATE TABLE public.role_permissions (
    role_name TEXT NOT NULL REFERENCES public.roles(name) ON DELETE CASCADE,
    permission_name TEXT NOT NULL REFERENCES public.permissions(name) ON DELETE CASCADE,
    PRIMARY KEY (role_name, permission_name)
);
COMMENT ON TABLE public.role_permissions IS 'Maps permissions to roles.';

-- 4. Profiles Table
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'free' REFERENCES public.roles(name),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE public.profiles IS 'Stores user-specific data and their role.';

-- 5. Action Logs Table
CREATE TABLE public.action_logs (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB
);
COMMENT ON TABLE public.action_logs IS 'Logs user actions for auditing and quota enforcement.';
CREATE INDEX idx_action_logs_user_id_timestamp ON public.action_logs(user_id, timestamp);


-- 6. Seed Data (Consolidated)
-- Insert initial roles, permissions, and their relationships.

-- Roles
INSERT INTO public.roles (name, description) VALUES
('free', 'Standard user with basic access.'),
('pro', 'User with paid subscription and extended access.'),
('beta', 'User with early access to new features.'),
('admin', 'System administrator with full access.');

-- Permissions (All in one place)
INSERT INTO public.permissions (name, description) VALUES
('ai_action:summarize', 'Can use the summarize AI action.'),
('ai_action:keyword-search', 'Can use the keyword search AI action.'),
('ai_action:chat', 'Can use the chat AI action.'),
('ai_action:recommend-response', 'Can use the recommend response AI action.'),
('ai_action:screenshot-analysis', 'Can use the screenshot analysis AI action.'),
('admin:read_users', 'Can read user data.'),
('admin:update_user_role', 'Can change a user''s role.');

-- Role-Permissions Mapping (All in one place)
-- Note: 'free' role has no AI permissions by design.

-- Pro users
INSERT INTO public.role_permissions (role_name, permission_name) VALUES
('pro', 'ai_action:summarize'),
('pro', 'ai_action:keyword-search'),
('pro', 'ai_action:chat'),
('pro', 'ai_action:recommend-response'),
('pro', 'ai_action:screenshot-analysis');

-- Beta users
INSERT INTO public.role_permissions (role_name, permission_name) VALUES
('beta', 'ai_action:summarize'),
('beta', 'ai_action:keyword-search'),
('beta', 'ai_action:chat'),
('beta', 'ai_action:recommend-response'),
('beta', 'ai_action:screenshot-analysis');

-- Admin users
INSERT INTO public.role_permissions (role_name, permission_name) VALUES
('admin', 'ai_action:summarize'),
('admin', 'ai_action:keyword-search'),
('admin', 'ai_action:chat'),
('admin', 'ai_action:recommend-response'),
('admin', 'ai_action:screenshot-analysis'),
('admin', 'admin:read_users'),
('admin', 'admin:update_user_role');


-- 7. Auto-create profile on new user sign-up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, role)
  VALUES (new.id, 'free');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- 8. Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Users can view their own action logs"
ON public.action_logs FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all action logs"
ON public.action_logs FOR SELECT
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Users can insert their own action logs"
ON public.action_logs FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- 9. RPC to check user permissions
CREATE OR REPLACE FUNCTION public.check_permission(p_user_id UUID, p_permission_name TEXT)
RETURNS BOOLEAN AS $BODY$
DECLARE
  has_perm BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.role_permissions rp ON p.role = rp.role_name
    WHERE p.id = p_user_id AND rp.permission_name = p_permission_name
  ) INTO has_perm;
  
  RETURN has_perm;
END;
$BODY$ LANGUAGE plpgsql SECURITY DEFINER;
