#!/usr/bin/env node
import { Command } from 'commander';
import { registerAuthCommands } from './commands/auth.js';
import { registerOrderCommands } from './commands/orders.js';
import { registerRouteCommands } from './commands/routes.js';
import { registerDispatchCommands } from './commands/dispatch.js';
import { registerDriverCommands } from './commands/drivers.js';
import { registerAnalyticsCommands } from './commands/analytics.js';
import { registerSettingsCommands } from './commands/settings.js';

const program = new Command();
program
  .name('homer')
  .description('HOMER.io — AI-Powered Delivery Management CLI')
  .version('1.0.0');

registerAuthCommands(program);
registerOrderCommands(program);
registerRouteCommands(program);
registerDispatchCommands(program);
registerDriverCommands(program);
registerAnalyticsCommands(program);
registerSettingsCommands(program);

program.parse();
