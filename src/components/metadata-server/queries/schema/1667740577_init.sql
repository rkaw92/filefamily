CREATE TYPE entry_type AS ENUM ('file', 'directory', 'link', 'other');

CREATE TABLE backends (
  backend_id INT PRIMARY KEY NOT NULL GENERATED ALWAYS AS IDENTITY,
  backend_name TEXT NOT NULL CONSTRAINT unique_backend_name UNIQUE,
  server_url TEXT NOT NULL
);

CREATE TABLE entries (
  backend_id INT NOT NULL REFERENCES backends(backend_id),
  path TEXT NOT NULL,
  type entry_type NOT NULL,
  bytes BIGINT NOT NULL,
  mtime TIMESTAMP WITH TIME ZONE NOT NULL
) PARTITION BY LIST (backend_id);

CREATE UNIQUE INDEX path_index ON entries USING btree (path ASC, backend_id ASC);
