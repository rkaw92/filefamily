import { traverse } from '../components/file-backend/traverse';
import { importFiles } from '../components/metadata-server/import-files';
import { Pool } from 'pg';
import { env } from '../common/env';
import pino from 'pino';

const pool = new Pool({
    connectionString: env('POSTGRES_URL')
});
const logger = pino({ level: env('LOG_LEVEL', 'debug') });
(async function() {
    const sourceDirectory = env('IMPORT_PATH');
    await importFiles(pool, 1, traverse(sourceDirectory), logger);
    pool.end();
})();
