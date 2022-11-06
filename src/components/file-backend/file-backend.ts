import fastify from 'fastify';
import { env } from '../../common/env';
import { access, constants } from 'node:fs/promises';
import { ConfigError } from '../../common/errors';
import { traverse } from './traverse';
import { JSONLines } from '../../common/jsonlines';
import { pipeline } from 'node:stream/promises';

const app = fastify({
  http2: true,
  logger: true
});

app.register(async function(instance) {
  const SHARE_PATH = env('SHARE_PATH');
  // At startup, make sure we'll be able to traverse the directory:
  try {
    await access(SHARE_PATH, constants.R_OK | constants.X_OK);
  } catch (error) {
    throw new ConfigError(`Directory access check failed: must have read/execute access to "${SHARE_PATH}". Underlying failure: ${error}`);
  }

  instance.get('/index', async function(request, reply) {
    reply.header('Content-Type', 'text/plain; charset=utf8');
    const traversal = traverse(SHARE_PATH, (err) => instance.log.warn(err));
    const jsonlines = new JSONLines();
    reply.send(jsonlines);
    // We'd normally do a pipeline like traversal→jsonlines→reply, but the reply is not Writable in Fastify.
    await pipeline(traversal, jsonlines);
  });
});

app.listen({
  port: Number(env('HTTP_PORT')),
  host: env('HTTP_HOST', '127.0.0.1')
});
