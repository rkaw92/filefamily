import fastify from 'fastify';
import { env } from '../common/env';

// Generate the PSK with: openssl rand -hex 32
// The result should be 32 bytes, or 256 bits, for TLS_AES_128_GCM_SHA256.
// Example PSK: 738aef64508c574d718aa088023f751b299e3478d34152796846132b91ada48b
const GOOD_PSK = Buffer.from(env('PSK'), 'hex');

const app = fastify({
    logger: true,
    http2: true,
    https: {
        ciphers: 'TLS_AES_128_GCM_SHA256',
        pskCallback: function(socket, identity) {
            // We don't care about identity in this little test:
            console.log('TLS: client connecting with identity = %s', identity);
            return GOOD_PSK;
        }
    }
});
app.get('/', async function() {
    return { ok: true };
})
app.listen({
    port: 31330
});
