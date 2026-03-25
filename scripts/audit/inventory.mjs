import { buildInventory } from './lib/inventory.mjs';
import { INVENTORY_FILE } from './lib/config.mjs';
import { writeJson } from './lib/util.mjs';

const inventory = await buildInventory();
await writeJson(INVENTORY_FILE, inventory);
console.log(JSON.stringify(inventory.summary, null, 2));
