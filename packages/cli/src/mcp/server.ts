#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { log } from './util.js';
import { registerOrderTools } from './tools/orders.js';
import { registerRouteTools } from './tools/routes.js';
import { registerDispatchTools } from './tools/dispatch.js';
import { registerDriverTools } from './tools/drivers.js';
import { registerAnalyticsTools } from './tools/analytics.js';
import { registerSettingsTools } from './tools/settings.js';

const server = new McpServer({
  name: 'homer',
  version: '1.0.0',
});

// Register all tool modules
registerOrderTools(server);
registerRouteTools(server);
registerDispatchTools(server);
registerDriverTools(server);
registerAnalyticsTools(server);
registerSettingsTools(server);

// Connect via stdio
async function main() {
  const transport = new StdioServerTransport();
  log('Starting HOMER MCP server...');
  await server.connect(transport);
  log('HOMER MCP server connected');
}

main().catch((err) => {
  process.stderr.write(`[homer-mcp] Fatal: ${err}\n`);
  process.exitCode = 1;
});
