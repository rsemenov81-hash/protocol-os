// Resolves Playwright: the project's devDependency first, then the machine-wide install used by the
// development containers (/opt/node22/lib/node_modules/playwright). Nothing is downloaded here.
import { createRequire } from 'node:module';

export const GLOBAL_PLAYWRIGHT = '/opt/node22/lib/node_modules/playwright';

export async function loadPlaywright() {
  let local;
  try {
    return await import('playwright');
  } catch (err) {
    local = err;
  }
  try {
    return createRequire(import.meta.url)(GLOBAL_PLAYWRIGHT);
  } catch (globalErr) {
    const e = new Error(
      'Playwright not found. Run `npm install` (adds the pinned devDependency) and, on a fresh machine, ' +
      '`npx playwright install --with-deps chromium`.\n' +
      `  import('playwright'): ${local && local.message}\n` +
      `  require('${GLOBAL_PLAYWRIGHT}'): ${globalErr && globalErr.message}`);
    e.cause = globalErr;
    throw e;
  }
}
