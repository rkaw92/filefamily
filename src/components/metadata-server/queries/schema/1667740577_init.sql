CREATE TYPE entry_type AS ENUM ('file', 'directory', 'link', 'other');

-- Function copied from https://github.com/elfsternberg/postgres-basename-dirname/blob/master/basename.sql
-- Copyright ⓒ 2016 Elf M. Sternberg <elf.sternberg@gmail.com>
CREATE OR REPLACE FUNCTION dirname(fullpath text,
                                   separator char DEFAULT '/')
   RETURNS text AS
$$
DECLARE
   separare text;
   dirname text;
   compname text;
BEGIN
   IF position(separator in fullpath) = 0 THEN
      return '';
   END IF;
   separare := '^(.*' || separator || ').*$';
   dirname = regexp_replace(fullpath, separare, '\1');
   IF length(dirname) != 0 THEN
      compname := lpad('', length(dirname), separator);
      IF compname != dirname THEN
         dirname = rtrim(dirname, separator);
      END IF;
   END IF;
   return dirname;
END;
$$
LANGUAGE 'plpgsql' IMMUTABLE;

CREATE TABLE backends (
  backend_id INT PRIMARY KEY NOT NULL GENERATED ALWAYS AS IDENTITY,
  backend_name TEXT NOT NULL CONSTRAINT unique_backend_name UNIQUE,
  server_url TEXT NOT NULL
);

CREATE TABLE imports (
  backend_id INT NOT NULL REFERENCES backends(backend_id),
  import_id BIGINT PRIMARY KEY NOT NULL GENERATED ALWAYS AS IDENTITY,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMP WITH TIME ZONE,
  entry_count BIGINT,
  new_count BIGINT,
  changed_count BIGINT,
  deleted_count BIGINT
);

CREATE TABLE entries (
  backend_id INT NOT NULL REFERENCES backends(backend_id),
  path TEXT NOT NULL,
  type entry_type NOT NULL,
  bytes BIGINT NOT NULL,
  mtime TIMESTAMP WITH TIME ZONE NOT NULL,
  first_discovery_at BIGINT NOT NULL REFERENCES imports (import_id),
  last_change_at BIGINT NOT NULL REFERENCES imports(import_id)
) PARTITION BY LIST (backend_id);

CREATE UNIQUE INDEX path_index ON entries USING btree (path text_pattern_ops ASC, backend_id ASC);
CREATE INDEX entries_path_dirname ON entries (dirname(path));
