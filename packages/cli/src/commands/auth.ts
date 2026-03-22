import type { Command } from 'commander';
import { saveConfig, clearConfig, loadConfig, DEFAULT_SERVER_URL } from '../config.js';
import { getApi } from '../api.js';
import { success, error, info, output } from '../output.js';

export function registerAuthCommands(program: Command): void {
  program
    .command('login')
    .description('Authenticate with your HOMER API key')
    .requiredOption('--api-key <key>', 'Your API key')
    .option('--server <url>', 'Server URL', DEFAULT_SERVER_URL)
    .action((opts: { apiKey: string; server: string }) => {
      saveConfig({ apiKey: opts.apiKey, serverUrl: opts.server });
      success(`Logged in. Config saved to ~/.homer/config.json`);
      info(`Server: ${opts.server}`);
    });

  program
    .command('logout')
    .description('Remove stored credentials')
    .action(() => {
      clearConfig();
      success('Logged out. Credentials removed.');
    });

  program
    .command('whoami')
    .description('Show current authenticated user')
    .option('--json', 'Output as JSON')
    .action(async (opts: { json?: boolean }) => {
      try {
        const api = getApi();
        const user = await api.get<Record<string, unknown>>('/api/auth/me');
        output(user, !!opts.json);
      } catch (err) {
        error(`Failed: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });

  program
    .command('status')
    .description('Show dashboard KPIs')
    .option('--json', 'Output as JSON')
    .action(async (opts: { json?: boolean }) => {
      try {
        const api = getApi();
        info('Fetching dashboard stats...');
        const stats = await api.get<Record<string, unknown>>('/api/dashboard/stats');
        output(stats, !!opts.json);
      } catch (err) {
        error(`Failed: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });
}
