REVOKE EXECUTE ON FUNCTION public.collaborative_recommendations(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.collaborative_recommendations(uuid, integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;