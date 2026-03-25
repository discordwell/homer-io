import { runPreparation } from './lib/cycle-core.mjs';

const prep = await runPreparation();
console.log(JSON.stringify(prep, null, 2));
