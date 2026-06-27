-- ============================================================
-- 012: Fix "Database error saving new user" on signup
-- ============================================================
-- handle_new_user runs as SECURITY DEFINER. On Postgres 15+ a definer function
-- with no explicit search_path can fail to resolve the `profiles` table / the
-- `user_role` enum, raising "Database error saving new user" during auth signup.
-- Pin the search_path so it always finds public objects.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    'parent'::public.user_role  -- always parent at signup; elevated roles require an invite
  );
  RETURN NEW;
END;
$$;

-- Recreate the trigger so it binds to the updated function (not a stale plan).
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
