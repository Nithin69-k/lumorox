-- 1. Lock down SECURITY DEFINER / internal functions
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

REVOKE ALL ON FUNCTION public.match_movie_embeddings(vector, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.match_movie_embeddings(vector, integer, text) TO service_role;

REVOKE ALL ON FUNCTION public.collaborative_recommendations(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.collaborative_recommendations(uuid, integer) TO authenticated, service_role;

-- 2. movie_embeddings: explicitly backend-only
REVOKE ALL ON TABLE public.movie_embeddings FROM anon, authenticated;
GRANT ALL ON TABLE public.movie_embeddings TO service_role;

ALTER TABLE public.movie_embeddings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No direct client access to movie embeddings" ON public.movie_embeddings;
CREATE POLICY "No direct client access to movie embeddings"
  ON public.movie_embeddings
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);