import { PoolClient, Pool, Query } from "pg";
import { from as copyFrom } from "pg-copy-streams";
import { FilesystemEntry } from "../../common/filesystem-entry";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { Logger } from 'pino';

async function transaction<TReturn>(client: PoolClient, transactionFunction: (client: PoolClient) => Promise<TReturn>) {
    await client.query('BEGIN');
    let transactionValue: TReturn;
    try {
        transactionValue = await transactionFunction(client);
    } catch (error) {
        client.query('ROLLBACK');
        throw error;
    }
    await client.query('COMMIT');
    return transactionValue;
}

async function borrow<TReturn>(pool: Pool, clientFunction: (client: PoolClient) => Promise<TReturn>) {
    const client = await pool.connect();
    let error: any;
    try {
        await clientFunction(client);
    } finally {
        client.release();
    }
}

export async function importFiles(
    pool: Pool,
    backendID: number,
    source: AsyncIterable<FilesystemEntry>,
    parentLogger: Logger
) {
    await borrow(pool, async (client) => {
        // Before the transaction, mark our import as started.
        const importStart = await client.query('INSERT INTO imports (backend_id) VALUES ($1) RETURNING import_id', [ backendID ]);
        const importID: string = importStart.rows[0].import_id;
        const logger = parentLogger.child({ importID, backendID });
        logger.info('Import process started');
        await transaction(client, async (trx) => {
            // Copy all received files into a temporary table:
            const importTableName = `import_${importID}`;
            await trx.query(`CREATE TEMPORARY TABLE ${importTableName} (LIKE entries INCLUDING ALL) ON COMMIT DROP`);
            logger.debug({ importTableName }, 'Created transaction-local temp table');
            const writable = trx.query(copyFrom(`COPY ${importTableName} (backend_id, path, type, bytes, mtime, first_discovery_at, last_change_at) FROM STDIN`));
            const toTSV = new Transform({
                writableObjectMode: true,
                readableObjectMode: false,
                transform(entry: FilesystemEntry, _encoding, callback) {
                    callback(null, `${backendID}\t${entry.path}\t${entry.type}\t${entry.bytes}\t${new Date(entry.mtime).toISOString()}\t${importID}\t${importID}\n`);
                }
            });
            await pipeline(source, toTSV, writable);
            logger.debug('Finished COPY FROM STDIN');
            // Run change detection based on last-modified time (mtime):
            await trx.query(`MERGE INTO entries AS target
                USING ${importTableName} AS input
                ON (input.backend_id = target.backend_id AND input.path = target.path)
                WHEN NOT MATCHED THEN INSERT (backend_id, path, type, bytes, mtime, first_discovery_at, last_change_at)
                    VALUES (input.backend_id, input.path, input.type, input.bytes, input.mtime, input.first_discovery_at, input.last_change_at)
                WHEN MATCHED AND (input.mtime <> target.mtime) THEN UPDATE
                    SET mtime = input.mtime, bytes = input.bytes, last_change_at = input.last_change_at
                WHEN MATCHED THEN DO NOTHING
            `);
            logger.debug('Finished MERGE');
            // Remove old files which are not in the newest import:
            const removal = await trx.query(`DELETE FROM entries
                WHERE
                    entries.backend_id = $1 AND
                    NOT EXISTS (SELECT FROM ${importTableName} import WHERE import.backend_id = entries.backend_id AND import.path = entries.path)`, [
                        backendID
                    ]);
            logger.debug('Finished DELETE');
            const deletedCount = removal.rowCount;
            // Update import stats:
            // TODO: Make this faster - all these COUNT(*)s are probably slow.
            await trx.query(`UPDATE imports
                SET
                    finished_at = $1,
                    entry_count = (SELECT COUNT(*) FROM ${importTableName}),
                    new_count = (SELECT COUNT(*) FROM entries WHERE backend_id = $2 AND first_discovery_at = $3),
                    changed_count = (SELECT COUNT(*) FROM entries WHERE backend_id = $4 AND first_discovery_at <> $5 AND last_change_at = $6),
                    deleted_count = $7
                WHERE import_id = $8`, [
                        new Date(),
                        backendID,
                        importID,
                        backendID,
                        importID,
                        importID,
                        deletedCount,
                        importID
                    ]);
        });
        logger.info('Import finished');
    });
}
