import { Transform } from 'stream';

/**
 * This utility class is a Transform Stream that turns objects into a text stream of JSON Lines.
 * Basically, you put JS objects in, and you get newline-delimited JSONs on the output.
 */
export class JSONLines extends Transform {
  constructor() {
    super({
      writableObjectMode: true,
      readableObjectMode: false,
      transform: (chunk: object, _encoding: never, callback) => {
        callback(null, JSON.stringify(chunk) + '\n');
      }
    });
  }
}
