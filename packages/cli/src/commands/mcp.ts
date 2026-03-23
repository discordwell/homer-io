import type { Command } from 'commander';
import { loadConfig } from '../config.js';
import { success, error, info } from '../output.js';

export function registerMcpCommands(program: Command): void {
  const mcp = program
    .command('mcp')
    .description('MCP (Model Context Protocol) server for Claude Code integration');

  mcp
    .command('install')
    .description('Print instructions for adding HOMER to Claude Code')
    .action(() => {
      info('To use HOMER as an MCP server in Claude Code:\n');
      console.log('1. Ensure you are logged in:');
      console.log('   homer login --api-key <your-key>\n');
      console.log('2. Add this to your project .mcp.json (or ~/.claude/.mcp.json for global):');
      console.log(JSON.stringify({
        mcpServers: {
          homer: {
            command: 'node',
            args: ['packages/cli/dist/mcp/server.js'],
          },
        },
      }, null, 2));
      console.log('\n   Or if homer-mcp is installed globally:');
      console.log(JSON.stringify({
        mcpServers: {
          homer: {
            command: 'homer-mcp',
          },
        },
      }, null, 2));
      console.log('\n3. Restart Claude Code. HOMER tools will appear automatically.\n');
      console.log('Available tools:');
      console.log('  homer_orders_list       - List delivery orders');
      console.log('  homer_orders_create     - Create an order');
      console.log('  homer_orders_count      - Count orders by status');
      console.log('  homer_orders_import_csv - Import orders from CSV');
      console.log('  homer_routes_list       - List routes');
      console.log('  homer_routes_create     - Create a route');
      console.log('  homer_routes_optimize   - Optimize route stop order');
      console.log('  homer_dispatch_auto     - Run auto-dispatch');
      console.log('  homer_dispatch_status   - Get dispatch status');
      console.log('  homer_drivers_list      - List drivers');
      console.log('  homer_drivers_available - List available drivers');
      console.log('  homer_analytics_dashboard - Dashboard KPIs');
      console.log('  homer_analytics_overview  - Analytics for a period');
      console.log('  homer_settings_get      - Organization settings');
      console.log('  homer_settings_industry  - Industry and features');
    });

  mcp
    .command('test')
    .description('Run a quick health check via the HOMER API')
    .action(async () => {
      const config = loadConfig();
      if (!config) {
        error('Not logged in. Run: homer login --api-key <key>');
        process.exit(1);
      }

      info(`Server: ${config.serverUrl}`);
      info('Testing API connection...');

      try {
        const { HomerAPI } = await import('../api.js');
        const api = new HomerAPI(config);
        const user = await api.get<Record<string, unknown>>('/api/auth/me');
        success('API connection OK');
        info(`Authenticated as: ${user.email || user.name || user.id || 'unknown'}`);

        // Also test dashboard stats endpoint
        info('Testing dashboard stats...');
        const stats = await api.get<Record<string, unknown>>('/api/dashboard/stats');
        success('Dashboard stats OK');
        const keys = Object.keys(stats || {});
        if (keys.length > 0) {
          info(`Stats keys: ${keys.join(', ')}`);
        }

        success('\nMCP server is ready. All health checks passed.');
      } catch (err) {
        error(`Health check failed: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });
}
