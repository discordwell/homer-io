import path from 'node:path';
import { FILES, INVENTORY_FILE, LATEST_RUN_FILE, LIVE_SURFACES, OUTPUT_DIR, PREP_FILE, ROOT_DIR, RUNS_DIR } from './config.mjs';
import { buildInventory, pathMatchesRoute } from './inventory.mjs';
import { renderMarkdownReport } from './reporting.mjs';
import { fileExists, mkdirp, readText, relativeToRoot, runCommand, safeFetch, slugify, timestampSlug, writeJson, writeText } from './util.mjs';

function createIssue({ severity, class: issueClass, title, summary, recommendation, evidence = [] }) {
  return {
    id: slugify(`${severity}-${issueClass}-${title}`),
    severity,
    class: issueClass,
    title,
    summary,
    recommendation,
    evidence,
  };
}

function groupByTarget(entries) {
  const grouped = new Map();
  for (const entry of entries) {
    const bucket = grouped.get(entry.target) || [];
    bucket.push(entry);
    grouped.set(entry.target, bucket);
  }
  return grouped;
}

function findAbsoluteUrl(entries, domainStartsWith) {
  return entries.filter((entry) => entry.domain && entry.domain.startsWith(domainStartsWith));
}

function isCatchAllRoute(routePath) {
  return routePath === '*' || routePath === '/*';
}

async function probeLiveSurfaces() {
  const targets = [
    { name: 'publicSite', url: LIVE_SURFACES.publicSite },
    { name: 'apex', url: LIVE_SURFACES.apex },
    { name: 'app', url: LIVE_SURFACES.app },
    { name: 'apiHealth', url: LIVE_SURFACES.apiHealth },
  ];

  const probes = [];
  for (const target of targets) {
    const response = await safeFetch(target.url);
    probes.push({
      name: target.name,
      url: target.url,
      status: response.status,
      ok: response.ok,
      error: response.error,
      bodyPreview: response.body.slice(0, 240),
    });
  }

  return probes;
}

function deriveStructuralIssues(inventory) {
  const issues = [];

  const missingByTarget = groupByTarget(inventory.missingRouteReferences);
  for (const [target, refs] of missingByTarget.entries()) {
    const severity = refs.some((ref) => ref.source.includes('Sidebar.tsx')) ? 'P1' : 'P2';
    issues.push(createIssue({
      severity,
      class: 'routing',
      title: `Referenced path has no route: ${target}`,
      summary: `The codebase links or navigates to ${target}, but the router inventory extracted from App.tsx does not define a matching frontend route.`,
      recommendation: 'Either add a matching route or remove/retarget the navigation source.',
      evidence: refs.slice(0, 5).map((ref) => ({
        source: ref.source,
        line: ref.line,
        detail: ref.kind,
      })),
    }));
  }

  const hashLinkRefs = inventory.references.filter(
    (ref) => ref.kind === 'link-to' && ref.target.startsWith('/#'),
  );
  if (hashLinkRefs.length > 0) {
    issues.push(createIssue({
      severity: 'P2',
      class: 'navigation',
      title: 'React Router hash links are defined without explicit hash-scroll handling',
      summary: 'Pricing and footer flows use Link targets like /#features, but the app bootstrap does not implement any hash-based scroll restoration or hashchange handling. That commonly leaves users at the top of the page instead of the intended section.',
      recommendation: 'Use real anchor links for same-page jumps or add explicit location.hash scroll handling in the app shell.',
      evidence: hashLinkRefs.slice(0, 5).map((ref) => ({
        source: ref.source,
        line: ref.line,
        detail: ref.target,
      })),
    }));
  }

  return issues;
}

async function deriveRoleAndDeepLinkIssues(inventory) {
  const issues = [];
  const appText = await readText(FILES.appTsx);
  const driverRoutesText = await readText(path.join(FILES.apiRoot, 'modules/driver/routes.ts'));

  if (
    appText.includes('path="/driver"')
    && appText.includes('<ProtectedRoute><DriverLayout /></ProtectedRoute>')
    && driverRoutesText.includes("requireRole('driver')")
  ) {
    issues.push(createIssue({
      severity: 'P1',
      class: 'authorization',
      title: 'Driver shell is reachable by any authenticated user',
      summary: 'The frontend only checks authentication before rendering /driver, while the backend driver APIs require the driver role. Non-driver users can enter the shell and then fail deeper in the flow.',
      recommendation: 'Add frontend role gating for driver routes or redirect non-driver users before the shell renders.',
      evidence: [
        {
          source: relativeToRoot(ROOT_DIR, FILES.appTsx),
          detail: 'ProtectedRoute wraps /driver without a role check',
        },
        {
          source: 'packages/api/src/modules/driver/routes.ts',
          detail: 'Driver endpoints requireRole(\'driver\')',
        },
      ],
    }));
  }

  const appDeepLinks = findAbsoluteUrl(inventory.absoluteUrls, 'https://app.homer.io');
  const matchableRoutes = inventory.definedRoutes.filter((route) => !isCatchAllRoute(route.path));
  const brokenAppLinks = appDeepLinks.filter((entry) => !matchableRoutes.some((route) => pathMatchesRoute(entry.path, route.path)));
  for (const entry of brokenAppLinks) {
    issues.push(createIssue({
      severity: 'P1',
      class: 'deep-link',
      title: `Backend emits app deep link with no frontend route: ${entry.path}`,
      summary: `A backend-generated app URL points to ${entry.path}, but the frontend route inventory has no matching route. This makes the link unusable outside the happy path.`,
      recommendation: 'Add the frontend route and page, or stop emitting the deep link until it is handled.',
      evidence: [{
        source: entry.source,
        line: entry.line,
        detail: entry.raw,
      }],
    }));
  }

  const trackDeepLinks = findAbsoluteUrl(inventory.absoluteUrls, 'https://track.homer.io');
  const brokenTrackLinks = trackDeepLinks.filter((entry) => !entry.path.startsWith('/api/public/track/') && !entry.path.startsWith('/track/'));
  for (const entry of brokenTrackLinks) {
    issues.push(createIssue({
      severity: 'P1',
      class: 'deep-link',
      title: `Tracking URL shape does not match routed tracking paths: ${entry.path}`,
      summary: 'Tracking links are emitted on the track.homer.io domain without the /track or /api/public/track prefix used by the repo route surface. That makes the link shape internally inconsistent and likely broken in production.',
      recommendation: 'Make emitted tracking URLs align with the actual routed tracking path and deployment topology.',
      evidence: [{
        source: entry.source,
        line: entry.line,
        detail: entry.raw,
      }],
    }));
  }

  return issues;
}

function deriveLiveSurfaceIssues(probes) {
  const issues = [];
  const publicProbe = probes.find((probe) => probe.name === 'publicSite');
  const apexProbe = probes.find((probe) => probe.name === 'apex');
  const appProbe = probes.find((probe) => probe.name === 'app');
  const apiProbe = probes.find((probe) => probe.name === 'apiHealth');

  if (publicProbe?.ok && (!apexProbe?.ok || apexProbe.status !== 200)) {
    issues.push(createIssue({
      severity: 'P2',
      class: 'deployment',
      title: 'Public surface is live on homer.discordwell.com while homer.io is not serving the app',
      summary: 'The public site responds on homer.discordwell.com, but the apex homer.io probe is not serving the same application surface. That creates domain confusion for users and for the audit target itself.',
      recommendation: 'Choose one canonical public domain and align DNS, Caddy, metadata, and generated links around it.',
      evidence: probes.map((probe) => ({
        source: probe.url,
        detail: probe.status ? `status ${probe.status}` : probe.error,
      })),
    }));
  }

  if (!appProbe?.ok) {
    issues.push(createIssue({
      severity: 'P1',
      class: 'deployment',
      title: 'Configured app.homer.io surface is not reachable from the audit environment',
      summary: 'The repo emits app.homer.io links and Caddy config references the domain, but the probe could not establish a healthy response from that surface.',
      recommendation: 'Fix the app domain deployment or stop emitting app.homer.io links until the surface is verifiably healthy.',
      evidence: [{
        source: appProbe?.url || LIVE_SURFACES.app,
        detail: appProbe?.error || `status ${appProbe?.status}`,
      }],
    }));
  }

  if (!apiProbe?.ok) {
    issues.push(createIssue({
      severity: 'P1',
      class: 'deployment',
      title: 'Configured api.homer.io health surface is not reachable from the audit environment',
      summary: 'The repo references api.homer.io as the production API hostname, but the health probe failed from the audit environment.',
      recommendation: 'Fix the API domain deployment or make the emitted production API base URL configurable and verifiable.',
      evidence: [{
        source: apiProbe?.url || LIVE_SURFACES.apiHealth,
        detail: apiProbe?.error || `status ${apiProbe?.status}`,
      }],
    }));
  }

  return issues;
}

function deriveBuildIssues(buildChecks) {
  const issues = [];

  if (buildChecks.webTests.code !== 0) {
    issues.push(createIssue({
      severity: 'P0',
      class: 'build',
      title: 'Web test suite is failing',
      summary: 'The audit baseline cannot trust the web package if its own test suite is red.',
      recommendation: 'Fix the failing tests before treating any audit result as stable.',
      evidence: [{
        source: 'npm run -w @homer-io/web test',
        detail: buildChecks.webTests.stderr || buildChecks.webTests.stdout,
      }],
    }));
  }

  if (buildChecks.webBuild.code !== 0) {
    issues.push(createIssue({
      severity: 'P0',
      class: 'build',
      title: 'Web production build is failing',
      summary: 'The production audit cannot proceed if the web bundle does not build successfully.',
      recommendation: 'Fix the build failure first and rerun the audit cycle.',
      evidence: [{
        source: 'npm run -w @homer-io/web build',
        detail: buildChecks.webBuild.stderr || buildChecks.webBuild.stdout,
      }],
    }));
    return issues;
  }

  const buildOutput = buildChecks.webBuild.combined;
  if (buildOutput.includes('externalized for browser compatibility')) {
    issues.push(createIssue({
      severity: 'P2',
      class: 'bundling',
      title: 'Browser build externalizes a node:crypto import path',
      summary: 'The production build warns that node:crypto was externalized for browser compatibility, which is a real risk signal for runtime breakage or polyfill drift on the client.',
      recommendation: 'Move browser-safe hashing behind a browser-only module boundary and keep server-only helpers out of the web bundle graph.',
      evidence: [{
        source: 'npm run -w @homer-io/web build',
        detail: 'Module "node:crypto" has been externalized for browser compatibility',
      }],
    }));
  }

  if (buildOutput.includes('Some chunks are larger than 500 kB')) {
    issues.push(createIssue({
      severity: 'P2',
      class: 'performance',
      title: 'Web build emits oversized production chunks',
      summary: 'The audit baseline build still ships multiple chunks above the warning threshold, which is a real productionization risk for interactive routes and mobile users.',
      recommendation: 'Split heavy map and dashboard surfaces into smaller route-level chunks and remeasure.',
      evidence: [{
        source: 'npm run -w @homer-io/web build',
        detail: 'Some chunks are larger than 500 kB after minification',
      }],
    }));
  }

  return issues;
}

export async function runPreparation() {
  await mkdirp(OUTPUT_DIR);
  await mkdirp(RUNS_DIR);

  const prep = {
    generatedAt: new Date().toISOString(),
    files: {
      appTsx: await fileExists(FILES.appTsx),
      mainTsx: await fileExists(FILES.mainTsx),
      envExample: await fileExists(FILES.envExample),
      caddyfile: await fileExists(FILES.caddyfile),
      rootEnv: await fileExists(path.join(ROOT_DIR, '.env')),
    },
    surfaces: LIVE_SURFACES,
  };

  await writeJson(PREP_FILE, prep);
  return prep;
}

export async function runCycle(options = {}) {
  await mkdirp(OUTPUT_DIR);
  await mkdirp(RUNS_DIR);

  const runId = options.runId || timestampSlug();
  const runDir = path.join(RUNS_DIR, runId);
  await mkdirp(runDir);

  const inventory = await buildInventory();
  const probes = await probeLiveSurfaces();
  const buildChecks = {
    webTests: await runCommand('npm', ['run', '-w', '@homer-io/web', 'test'], { cwd: ROOT_DIR }),
    webBuild: await runCommand('npm', ['run', '-w', '@homer-io/web', 'build'], { cwd: ROOT_DIR }),
  };

  const issues = [
    ...deriveStructuralIssues(inventory),
    ...(await deriveRoleAndDeepLinkIssues(inventory)),
    ...deriveLiveSurfaceIssues(probes),
    ...deriveBuildIssues(buildChecks),
  ];

  const reportMarkdown = renderMarkdownReport({
    runId,
    inventory,
    issues,
    probes,
    buildChecks,
  });

  await writeJson(path.join(runDir, 'inventory.json'), inventory);
  await writeJson(path.join(runDir, 'issues.json'), issues);
  await writeJson(path.join(runDir, 'probes.json'), probes);
  await writeJson(path.join(runDir, 'build-checks.json'), buildChecks);
  await writeText(path.join(runDir, 'report.md'), reportMarkdown);
  await writeJson(INVENTORY_FILE, inventory);
  await writeJson(LATEST_RUN_FILE, {
    runId,
    runDir: relativeToRoot(ROOT_DIR, runDir),
    generatedAt: new Date().toISOString(),
  });

  return {
    runId,
    runDir,
    inventory,
    probes,
    issues,
    buildChecks,
    reportMarkdown,
  };
}
