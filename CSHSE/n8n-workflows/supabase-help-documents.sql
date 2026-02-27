-- Supabase SQL for Help Documents Vector Store
-- Run this in the Supabase SQL Editor before uploading help documents
--
-- This creates the help_documents table (same schema as cshse_specifications)
-- and the match_help_documents function used by the Chat Agent workflow.

-- Enable the vector extension if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- Create the help_documents table
CREATE TABLE IF NOT EXISTS help_documents (
  id bigserial PRIMARY KEY,
  content text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  embedding vector(1536),
  created_at timestamptz DEFAULT now()
);

-- Create an HNSW index for fast similarity search
CREATE INDEX IF NOT EXISTS help_documents_embedding_idx
  ON help_documents
  USING hnsw (embedding vector_cosine_ops);

-- Create index on metadata for filtering
CREATE INDEX IF NOT EXISTS help_documents_metadata_idx
  ON help_documents
  USING gin (metadata);

-- Create the match function used by the Chat Agent workflow
-- The Chat Agent's Vector Store Tool calls this function with:
--   query_embedding: the embedded user question (text-embedding-ada-002)
--   match_count: number of results to return (default 5)
--   filter: optional jsonb filter on metadata
CREATE OR REPLACE FUNCTION match_help_documents(
  query_embedding vector(1536),
  match_count int DEFAULT 5,
  filter jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE (
  id bigint,
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    hd.id,
    hd.content,
    hd.metadata,
    1 - (hd.embedding <=> query_embedding) as similarity
  FROM help_documents hd
  WHERE hd.metadata @> filter
  ORDER BY hd.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
