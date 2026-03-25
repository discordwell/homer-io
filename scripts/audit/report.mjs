import path from 'node:path';
import { LATEST_RUN_FILE, ROOT_DIR } from './lib/config.mjs';
import { readJson, readText } from './lib/util.mjs';

const latest = await readJson(LATEST_RUN_FILE);
const reportPath = path.join(ROOT_DIR, latest.runDir, 'report.md');
const report = await readText(reportPath);
process.stdout.write(report);
