import { traverse } from '../components/file-backend/traverse';
import { importFiles } from '../components/metadata-server/import-files';
import { Pool } from 'pg';
import { env } from '../common/env';

const pool = new Pool({
    connectionString: env('POSTGRES_URL')
});
(async function() {
    const sourceDirectory = env('IMPORT_PATH');
    await importFiles(pool, 1, traverse(sourceDirectory));
    pool.end();
})();
