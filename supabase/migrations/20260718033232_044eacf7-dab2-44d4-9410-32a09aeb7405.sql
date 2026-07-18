
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE public.movie_embeddings (
  tmdb_id TEXT PRIMARY KEY,
  embedding vector(1536) NOT NULL,
  text_hash TEXT NOT NULL,
  title TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.movie_embeddings TO service_role;

ALTER TABLE public.movie_embeddings ENABLE ROW LEVEL SECURITY;

-- No policies for anon/authenticated: this table is only read/written by server functions using the service role.

CREATE INDEX movie_embeddings_embedding_idx
  ON public.movie_embeddings
  USING hnsw (embedding vector_cosine_ops);

CREATE OR REPLACE FUNCTION public.match_movie_embeddings(
  query_embedding vector(1536),
  match_count int DEFAULT 20,
  exclude_id text DEFAULT NULL
)
RETURNS TABLE (tmdb_id text, title text, similarity float)
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT
    e.tmdb_id,
    e.title,
    1 - (e.embedding <=> query_embedding) AS similarity
  FROM public.movie_embeddings e
  WHERE exclude_id IS NULL OR e.tmdb_id <> exclude_id
  ORDER BY e.embedding <=> query_embedding
  LIMIT match_count;
$$;
