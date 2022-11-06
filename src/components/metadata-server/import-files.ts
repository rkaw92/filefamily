import { PoolClient, Pool } from "pg";
import { from as copyFrom } from "pg-copy-streams";
import cuid from "cuid";
import { FilesystemEntry } from "../../common/filesystem-entry";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

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

export async function importFiles(pool: Pool, tableName: string, backendID: number, source: AsyncIterable<FilesystemEntry>) {
    await borrow(pool, (client) => {
        return transaction(client, async (trx) => {
            const importTableName = `import_${cuid()}`;
            // TODO: CREATE TEMPORARY TABLE ... (LIKE entries) ON COMMIT DROP
            await trx.query(`CREATE TABLE ${importTableName} (LIKE entries INCLUDING ALL)`);
            const writable = trx.query(copyFrom(`COPY ${importTableName} (backend_id, path, type, bytes, mtime) FROM STDIN`));
            const toTSV = new Transform({
                writableObjectMode: true,
                readableObjectMode: false,
                transform(entry: FilesystemEntry, _encoding, callback) {
                    callback(null, `${backendID}\t${entry.path}\t${entry.type}\t${entry.bytes}\t${new Date(entry.mtime).toISOString()}\n`);
                }
            })
            await pipeline(source, toTSV, writable);
        });
    })
}
