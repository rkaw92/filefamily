import * as http2 from 'node:http2';
import { env } from '../common/env';

const GOOD_PSK = Buffer.from(env('PSK'), 'hex');

(async function() {
    const connection = http2.connect('https://localhost:31330', {
        pskCallback: function() {
            return {
                psk: GOOD_PSK,
                identity: 'good-client@localhost'
            };
        }
    }, function() {
        console.log('connected to the server!');
    });
    const req = connection.request({
        ':path': '/',
        ':method': 'GET'
    });
    req.on('response', function(headers) {
        console.log('response headers:', headers);
    });
    const responseBuffers: Buffer[] = [];
    req.on('data', function(data) {
        responseBuffers.push(data);
    });
    req.on('end', function() {
        console.log('response body: %s', Buffer.concat(responseBuffers).toString('utf-8'));
    });
    req.end();
})();
