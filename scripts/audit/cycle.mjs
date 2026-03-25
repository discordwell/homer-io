import { runCycle } from './lib/cycle-core.mjs';

const result = await runCycle();
console.log(JSON.stringify({
  runId: result.runId,
  issues: result.issues.length,
  report: `${result.runDir}/report.md`,
}, null, 2));
