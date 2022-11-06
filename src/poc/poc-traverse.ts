import { traverse } from '../components/file-backend/traverse';

(async function() {
  let count = 0;
  for await (const entry of traverse('/home/thewanderer')) {
    // console.log(entry);
    count++;
    if (count % 10000 === 0) {
      console.log('Iterated over %d files so far', count);
    }
  }
  console.log('Iterated over %d files in total', count);
})();
