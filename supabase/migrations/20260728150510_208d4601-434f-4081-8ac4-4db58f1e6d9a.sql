CREATE OR REPLACE FUNCTION public.collaborative_recommendations(_user_id uuid, _limit integer DEFAULT 20)
 RETURNS TABLE(tmdb_id text, score double precision, co_raters bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF current_setting('role', true) IS DISTINCT FROM 'service_role'
     AND (auth.uid() IS NULL OR auth.uid() <> _user_id) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  RETURN QUERY
  WITH me AS (
    SELECT ur.tmdb_id, ur.rating FROM public.user_ratings ur WHERE ur.user_id = _user_id
  ),
  neighbors AS (
    SELECT r.user_id,
           sum( (r.rating::float / 10.0) * (me.rating::float / 10.0) ) AS sim
    FROM public.user_ratings r
    JOIN me ON me.tmdb_id = r.tmdb_id
    WHERE r.user_id <> _user_id
    GROUP BY r.user_id
    HAVING count(*) >= 1
  )
  SELECT r.tmdb_id,
         sum(n.sim * (r.rating::float / 10.0))::double precision AS score,
         count(*)::bigint AS co_raters
  FROM public.user_ratings r
  JOIN neighbors n ON n.user_id = r.user_id
  WHERE r.tmdb_id NOT IN (SELECT tmdb_id FROM me)
    AND r.rating >= 6
  GROUP BY r.tmdb_id
  ORDER BY score DESC
  LIMIT _limit;
END; $function$;
REVOKE EXECUTE ON FUNCTION public.collaborative_recommendations(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.collaborative_recommendations(uuid, integer) TO service_role;