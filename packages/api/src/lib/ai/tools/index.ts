import type { NLOpsTool } from './types.js';
import { queryTools } from './query.js';
import { mutationTools } from './mutations.js';

export type { NLOpsTool, ToolContext } from './types.js';
export { summarizeResult } from './types.js';

// Role hierarchy: owner > admin > dispatcher > driver
const ROLE_RANK: Record<string, number> = {
  owner: 4,
  admin: 3,
  dispatcher: 2,
  driver: 1,
};

const allTools: NLOpsTool[] = [...queryTools, ...mutationTools];

/** Get all tools available for a given user role */
export function getToolsForRole(role: string): NLOpsTool[] {
  const rank = ROLE_RANK[role] ?? 0;
  return allTools.filter((t) => {
    const required = ROLE_RANK[t.requiredRole] ?? 0;
    return rank >= required;
  });
}

/** Look up a tool by name */
export function getTool(name: string): NLOpsTool | undefined {
  return allTools.find((t) => t.name === name);
}

/** Total tool count */
export const TOTAL_TOOL_COUNT = allTools.length;
