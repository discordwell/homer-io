import path from 'node:path';
import { chromium, devices } from 'playwright';
import { LIVE_SURFACES, OUTPUT_DIR } from './lib/config.mjs';
import { mkdirp, slugify, timestampSlug, writeJson, writeText } from './lib/util.mjs';

const runId = timestampSlug();
const runDir = path.join(OUTPUT_DIR, 'browser-public', runId);
const screenshotsDir = path.join(runDir, 'screenshots');
const baseUrl = (process.env.AUDIT_PUBLIC_SITE || LIVE_SURFACES.publicSite).replace(/\/+$/, '');
const stabilityWaitMs = Number(process.env.AUDIT_STABILITY_WAIT_MS || 3200);

const viewports = [
  {
    name: 'desktop',
    contextOptions: {
      viewport: { width: 1440, height: 960 },
      colorScheme: 'dark',
    },
  },
  {
    name: 'mobile',
    contextOptions: {
      ...devices['iPhone 13'],
      colorScheme: 'dark',
    },
  },
];

const pages = [
  { slug: 'home', path: '/', kind: 'marketing' },
  { slug: 'pricing', path: '/pricing', kind: 'marketing' },
  { slug: 'login', path: '/login', kind: 'auth' },
  { slug: 'register', path: '/register', kind: 'auth' },
  { slug: 'forgot-password', path: '/forgot-password', kind: 'auth' },
  { slug: 'reset-password', path: '/reset-password', kind: 'auth' },
  { slug: 'verify-email', path: '/verify-email', kind: 'auth' },
  { slug: 'cannabis', path: '/cannabis', kind: 'vertical' },
  { slug: 'florist', path: '/florist', kind: 'vertical' },
  { slug: 'pharmacy', path: '/pharmacy', kind: 'vertical' },
  { slug: 'restaurant', path: '/restaurant', kind: 'vertical' },
  { slug: 'grocery', path: '/grocery', kind: 'vertical' },
  { slug: 'furniture', path: '/furniture', kind: 'vertical' },
  { slug: 'demo', path: '/demo', kind: 'demo' },
];

const verticalSlugs = new Set(pages.filter((page) => page.kind === 'vertical').map((page) => page.slug));
const industries = Array.from(verticalSlugs);

function issue(severity, title, summary, evidence = []) {
  return {
    id: slugify(`${severity}-${title}`),
    severity,
    title,
    summary,
    evidence,
  };
}

function normalizeText(value) {
  return value.replace(/\s+/g, ' ').trim();
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function mergeIssues(issues) {
  const merged = new Map();

  for (const current of issues) {
    const key = `${current.severity}::${current.title}::${current.summary}`;
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, { ...current, evidence: unique(current.evidence) });
      continue;
    }

    existing.evidence = unique([...existing.evidence, ...current.evidence]);
  }

  return [...merged.values()];
}

function isLocalBaseUrl(url) {
  return /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/i.test(url);
}

function filterConsoleErrors(errors, pageConfig) {
  if (!isLocalBaseUrl(baseUrl) || pageConfig.kind !== 'auth') return errors;

  return errors.filter((message) => (
    !message.includes('[GSI_LOGGER]: The given origin is not allowed for the given client ID.')
    && !message.includes('Failed to load resource: the server responded with a status of 403 ()')
  ));
}

async function attachPageInstrumentation(page) {
  const consoleErrors = [];
  const pageErrors = [];
  const requestFailures = [];

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });
  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });
  page.on('requestfailed', (request) => {
    requestFailures.push(`${request.method()} ${request.url()} — ${request.failure()?.errorText || 'failed'}`);
  });

  return { consoleErrors, pageErrors, requestFailures };
}

async function waitForAppContent(page) {
  try {
    await page.waitForFunction(() => {
      const root = document.querySelector('#root');
      const rootHasChildren = Boolean(root && root.childElementCount > 0);
      const text = document.body?.innerText?.trim() || '';
      return rootHasChildren || text.length > 0;
    }, { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

async function waitForAnyVisible(locators, timeout = 6500) {
  const deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    for (const locator of locators) {
      if ((await locator.count()) === 0) continue;
      if (await locator.first().isVisible().catch(() => false)) {
        await locator.first().waitFor({ state: 'visible', timeout: 250 }).catch(() => {});
        return true;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 120));
  }

  return false;
}

function getReadinessLocators(page, pageConfig) {
  switch (pageConfig.slug) {
    case 'home':
      return [
        page.getByRole('link', { name: /see how it works|try the demo/i }),
        page.getByRole('link', { name: /start free/i }),
      ];
    case 'pricing':
      return [
        page.getByRole('link', { name: /^features$/i }),
        page.getByRole('heading', { name: /simple, transparent pricing/i }),
      ];
    case 'login':
      return [
        page.getByLabel(/^email$/i),
        page.getByRole('button', { name: /sign in/i }),
      ];
    case 'register':
      return [
        page.getByLabel(/your name/i),
        page.getByRole('button', { name: /create account/i }),
      ];
    case 'forgot-password':
      return [
        page.getByLabel(/^email$/i),
        page.getByRole('button', { name: /send reset link/i }),
      ];
    case 'reset-password':
      return [
        page.getByLabel(/new password/i),
        page.locator('.error-box'),
      ];
    case 'verify-email':
      return [
        page.locator('.error-box'),
        page.getByRole('link', { name: /back to sign in/i }),
      ];
    case 'demo':
      return [
        page.getByPlaceholder(/you@company\.com/i),
        page.getByRole('button', { name: /start demo/i }),
      ];
    default:
      return [
        page.getByRole('heading').first(),
        page.locator('main').first(),
      ];
  }
}

async function waitForRouteReady(page, pageConfig, timeout = 6500) {
  const ready = await waitForAnyVisible(getReadinessLocators(page, pageConfig), timeout);

  if (ready) {
    await page.waitForTimeout(120);
  }

  return ready;
}

async function getMountSnapshot(page) {
  return page.evaluate(() => ({
    title: document.title,
    rootLength: document.querySelector('#root')?.innerHTML.length || 0,
    textLength: document.body?.innerText?.trim().length || 0,
    path: location.pathname,
  }));
}

async function collectVisibleTexts(page, selector, limit) {
  return page.locator(selector).evaluateAll((nodes, max) =>
    nodes
      .map((node) => {
        const text = node.textContent?.replace(/\s+/g, ' ').trim() || '';
        const rect = node.getBoundingClientRect();
        const style = window.getComputedStyle(node);
        const hidden = style.display === 'none'
          || style.visibility === 'hidden'
          || style.opacity === '0'
          || rect.width === 0
          || rect.height === 0;
        return { text, hidden };
      })
      .filter((item) => item.text && !item.hidden)
      .map((item) => item.text)
      .slice(0, max), limit);
}

async function gatherPageSnapshot(page) {
  const title = await page.title();
  const headings = await collectVisibleTexts(page, 'h1, h2, h3', 18);
  const ctas = await page.locator('a, button').evaluateAll((nodes) =>
    nodes
      .map((node) => {
        const text = node.textContent?.replace(/\s+/g, ' ').trim() || '';
        const href = node instanceof HTMLAnchorElement ? node.href : '';
        const rect = node.getBoundingClientRect();
        const style = window.getComputedStyle(node);
        const hidden = style.display === 'none'
          || style.visibility === 'hidden'
          || style.opacity === '0'
          || rect.width === 0
          || rect.height === 0;
        return { text, href, hidden };
      })
      .filter((item) => item.text && !item.hidden)
      .slice(0, 24));
  const bodyTextSample = await page.evaluate(() => {
    const text = document.body?.innerText?.replace(/\s+/g, ' ').trim() || '';
    return text.slice(0, 1200);
  });
  const hiddenRevealCount = await page.locator('.reveal:not(.visible)').count();

  return {
    title,
    headings,
    ctas,
    bodyTextSample,
    hiddenRevealCount,
  };
}

async function scrollThroughPage(page) {
  const metrics = await page.evaluate(() => ({
    viewportHeight: window.innerHeight,
    scrollHeight: document.body.scrollHeight,
  }));

  if (metrics.scrollHeight <= metrics.viewportHeight) return;

  const step = Math.max(280, Math.floor(metrics.viewportHeight * 0.75));
  for (let top = 0; top < metrics.scrollHeight; top += step) {
    await page.evaluate((nextTop) => window.scrollTo({ top: nextTop, behavior: 'auto' }), top);
    await page.waitForTimeout(120);
  }

  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'auto' }));
  await page.waitForTimeout(120);
}

async function runHomeChecks(context) {
  const page = await context.newPage();
  try {
    await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
    await waitForAppContent(page);
    await waitForRouteReady(page, { slug: 'home', kind: 'marketing' });

    const issues = [];
    const demoLink = page.getByRole('link', { name: /see how it works|try the demo/i }).first();
    if ((await demoLink.count()) === 0) {
      issues.push(issue('P1', 'Homepage demo CTA is missing', 'The homepage should expose a clear interactive demo CTA.'));
      return issues;
    }

    await demoLink.click();
    await page.waitForURL('**/demo**', { timeout: 5000 });
    if (!page.url().startsWith(`${baseUrl}/demo`)) {
      issues.push(issue('P1', 'Homepage demo CTA does not land on /demo', `Expected ${baseUrl}/demo..., got ${page.url()}`));
    }
    return issues;
  } catch (error) {
    return [issue('P1', 'Homepage demo CTA could not be exercised', error instanceof Error ? error.message : String(error))];
  } finally {
    await page.close();
  }
}

async function runPricingChecks(context) {
  const page = await context.newPage();
  try {
    await page.goto(`${baseUrl}/pricing`, { waitUntil: 'domcontentloaded' });
    await waitForAppContent(page);
    await waitForRouteReady(page, { slug: 'pricing', kind: 'marketing' });

    const issues = [];
    const featuresLink = page.getByRole('link', { name: /^features$/i }).first();
    if ((await featuresLink.count()) === 0) {
      issues.push(issue('P1', 'Pricing page features link is missing', 'Pricing should expose a working jump back to the homepage features section.'));
      return issues;
    }

    await featuresLink.click();
    await page.waitForURL('**/#features', { timeout: 5000 });
    const url = new URL(page.url());
    if (url.origin !== baseUrl || url.pathname !== '/' || url.hash !== '#features') {
      issues.push(issue('P2', 'Pricing features link does not land on the expected homepage hash', `Expected ${baseUrl}/#features, got ${page.url()}`));
    }
    return issues;
  } catch (error) {
    return [issue('P1', 'Pricing features link could not be exercised', error instanceof Error ? error.message : String(error))];
  } finally {
    await page.close();
  }
}

async function runDemoChecks(context) {
  const page = await context.newPage();
  try {
    await page.goto(`${baseUrl}/demo`, { waitUntil: 'domcontentloaded' });
    await waitForAppContent(page);
    await waitForRouteReady(page, { slug: 'demo', kind: 'demo' });

    const issues = [];
    const email = page.getByPlaceholder(/you@company.com/i);
    const button = page.getByRole('button', { name: /start demo/i });
    if ((await email.count()) === 0 || (await button.count()) === 0) {
      issues.push(issue('P1', 'Demo gate did not render expected controls', 'The demo route should render the email gate with an email field and CTA.'));
      return issues;
    }

    await email.fill('not-an-email');
    if (!(await button.isDisabled())) {
      issues.push(issue('P2', 'Demo CTA enables on invalid email input', 'The demo gate should keep the CTA disabled until the email is valid.'));
    }

    await email.fill('audit@example.com');
    if (await button.isDisabled()) {
      issues.push(issue('P2', 'Demo CTA stays disabled on a valid email', 'A valid email should enable the demo CTA before submission.'));
    }

    return issues;
  } catch (error) {
    return [issue('P1', 'Demo gate checks could not run', error instanceof Error ? error.message : String(error))];
  } finally {
    await page.close();
  }
}

async function runLoginChecks(context) {
  const page = await context.newPage();
  try {
    await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' });
    await waitForAppContent(page);
    await waitForRouteReady(page, { slug: 'login', kind: 'auth' });

    const issues = [];
    const email = page.getByLabel(/^email$/i);
    const password = page.getByLabel(/^password$/i);
    const forgotPassword = page.getByRole('link', { name: /forgot password/i });
    const submit = page.getByRole('button', { name: /sign in/i });

    if ((await email.count()) === 0 || (await password.count()) === 0 || (await submit.count()) === 0) {
      issues.push(issue('P1', 'Login page is missing core form controls', 'The login route should expose email, password, and sign-in controls.'));
    }

    if ((await forgotPassword.count()) === 0) {
      issues.push(issue('P2', 'Login page is missing the forgot-password escape hatch', 'A human login screen should expose a visible recovery path.'));
    }

    return issues;
  } catch (error) {
    return [issue('P1', 'Login page checks could not run', error instanceof Error ? error.message : String(error))];
  } finally {
    await page.close();
  }
}

async function runRegisterChecks(context) {
  const page = await context.newPage();
  try {
    await page.goto(`${baseUrl}/register`, { waitUntil: 'domcontentloaded' });
    await waitForAppContent(page);
    await waitForRouteReady(page, { slug: 'register', kind: 'auth' });

    const issues = [];
    const requiredLabels = [/your name/i, /organization name/i, /^email$/i, /^password$/i];
    for (const label of requiredLabels) {
      if ((await page.getByLabel(label).count()) === 0) {
        issues.push(issue('P1', 'Register page is missing required fields', `The registration flow is missing the field labeled ${label}.`));
      }
    }

    const submit = page.getByRole('button', { name: /create account/i });
    if ((await submit.count()) === 0) {
      issues.push(issue('P1', 'Register page is missing its submit CTA', 'The registration route should expose a Create Account action.'));
    }

    return issues;
  } catch (error) {
    return [issue('P1', 'Register page checks could not run', error instanceof Error ? error.message : String(error))];
  } finally {
    await page.close();
  }
}

async function runForgotPasswordChecks(context) {
  const page = await context.newPage();
  try {
    await page.goto(`${baseUrl}/forgot-password`, { waitUntil: 'domcontentloaded' });
    await waitForAppContent(page);
    await waitForRouteReady(page, { slug: 'forgot-password', kind: 'auth' });

    const issues = [];
    if ((await page.getByLabel(/^email$/i).count()) === 0) {
      issues.push(issue('P1', 'Forgot-password page is missing its email field', 'Password recovery needs a visible email input.'));
    }

    if ((await page.getByRole('button', { name: /send reset link/i }).count()) === 0) {
      issues.push(issue('P1', 'Forgot-password page is missing the reset CTA', 'Password recovery needs a clear send action.'));
    }

    return issues;
  } catch (error) {
    return [issue('P1', 'Forgot-password checks could not run', error instanceof Error ? error.message : String(error))];
  } finally {
    await page.close();
  }
}

async function runResetPasswordChecks(context) {
  const page = await context.newPage();
  try {
    await page.goto(`${baseUrl}/reset-password`, { waitUntil: 'domcontentloaded' });
    await waitForAppContent(page);
    await waitForRouteReady(page, { slug: 'reset-password', kind: 'auth' });

    const issues = [];
    if ((await page.getByLabel(/new password/i).count()) === 0 || (await page.getByLabel(/confirm password/i).count()) === 0) {
      issues.push(issue('P1', 'Reset-password page is missing password fields', 'The reset-password route should render both new-password fields even when the token is missing.'));
    }

    await page.getByRole('button', { name: /reset password/i }).click();
    const errorBox = page.locator('.error-box');
    if ((await errorBox.count()) === 0) {
      issues.push(issue('P2', 'Reset-password page does not explain the missing-token state', 'Visiting reset-password without a token should produce a human-readable error instead of failing silently.'));
    }

    return issues;
  } catch (error) {
    return [issue('P1', 'Reset-password checks could not run', error instanceof Error ? error.message : String(error))];
  } finally {
    await page.close();
  }
}

async function runVerifyEmailChecks(context) {
  const page = await context.newPage();
  try {
    await page.goto(`${baseUrl}/verify-email`, { waitUntil: 'domcontentloaded' });
    await waitForAppContent(page);
    await waitForRouteReady(page, { slug: 'verify-email', kind: 'auth' });

    const issues = [];
    const errorBox = page.locator('.error-box');
    if ((await errorBox.count()) === 0) {
      issues.push(issue('P2', 'Verify-email page hides the missing-token state', 'Visiting verify-email without a token should immediately explain what is wrong.'));
    }

    if ((await page.getByRole('link', { name: /back to sign in/i }).count()) === 0) {
      issues.push(issue('P2', 'Verify-email error state lacks a clear recovery path', 'The missing-token state should give the user a direct way back to sign in.'));
    }

    return issues;
  } catch (error) {
    return [issue('P1', 'Verify-email checks could not run', error instanceof Error ? error.message : String(error))];
  } finally {
    await page.close();
  }
}

async function runPageChecks(pageConfig, context) {
  if (pageConfig.slug === 'home') return runHomeChecks(context);
  if (pageConfig.slug === 'pricing') return runPricingChecks(context);
  if (pageConfig.slug === 'login') return runLoginChecks(context);
  if (pageConfig.slug === 'register') return runRegisterChecks(context);
  if (pageConfig.slug === 'forgot-password') return runForgotPasswordChecks(context);
  if (pageConfig.slug === 'reset-password') return runResetPasswordChecks(context);
  if (pageConfig.slug === 'verify-email') return runVerifyEmailChecks(context);
  if (pageConfig.slug === 'demo') return runDemoChecks(context);
  return [];
}

function normalizeHeadingForTemplate(heading) {
  let normalized = heading.toLowerCase();
  for (const industry of industries) {
    const pattern = new RegExp(industry, 'g');
    normalized = normalized.replace(pattern, '{industry}');
  }
  return normalized;
}

function analyzeRepeatedHeadings(results, issues) {
  const headingMap = new Map();

  for (const result of results.filter((entry) => entry.viewport === 'desktop' && entry.kind !== 'demo')) {
    for (const heading of result.headings) {
      const normalized = normalizeText(heading);
      if (normalized.length < 12) continue;

      const routes = headingMap.get(normalized) || new Set();
      routes.add(result.slug);
      headingMap.set(normalized, routes);
    }
  }

  const repeated = [...headingMap.entries()]
    .map(([heading, routes]) => ({ heading, routes: [...routes].sort() }))
    .filter((entry) => entry.routes.length >= 4)
    .sort((a, b) => b.routes.length - a.routes.length || a.heading.localeCompare(b.heading));

  if (repeated.length === 0) return;

  issues.push(issue(
    'P2',
    'Marketing routes reuse the same section framing across too many pages',
    'The public marketing surface repeats the same section headlines across multiple routes, which flattens hierarchy and makes the site read like templated AI output instead of route-specific messaging.',
    repeated.slice(0, 6).map((entry) => `"${entry.heading}" on ${entry.routes.join(', ')}`),
  ));
}

function analyzeVerticalTemplateReuse(results, issues) {
  const verticalResults = results
    .filter((entry) => entry.viewport === 'desktop' && verticalSlugs.has(entry.slug))
    .map((entry) => ({
      slug: entry.slug,
      signature: entry.headings.map(normalizeHeadingForTemplate),
    }));

  if (verticalResults.length < 4) return;

  const signatureMap = new Map();
  for (const result of verticalResults) {
    const signature = result.signature.join(' | ');
    const routes = signatureMap.get(signature) || [];
    routes.push(result.slug);
    signatureMap.set(signature, routes);
  }

  const templated = [...signatureMap.entries()]
    .map(([signature, routes]) => ({ signature, routes }))
    .find((entry) => entry.routes.length >= 4 && entry.signature.length > 0);

  if (!templated) return;

  issues.push(issue(
    'P2',
    'Vertical landing pages are structurally templated to the point of sameness',
    'Most industry pages share an almost identical heading sequence after normalizing the industry name. That is a strong signal of generic page generation rather than deliberate route-by-route messaging.',
    [
      `Routes: ${templated.routes.join(', ')}`,
      `Normalized signature: ${templated.signature}`,
    ],
  ));
}

function analyzeRevealReliance(results, issues) {
  const offenders = results
    .filter((entry) => entry.hiddenRevealCount >= 3)
    .map((entry) => `${entry.slug}/${entry.viewport}: ${entry.hiddenRevealCount} hidden reveal sections remained off-screen before scroll`);

  if (offenders.length === 0) return;

  issues.push(issue(
    'P3',
    'Marketing pages rely heavily on scroll-triggered reveal states',
    'Core content stays hidden until intersection-driven reveal classes fire. That makes screenshots, accessibility review, and non-ideal runtime conditions harder to reason about, and it increases the risk of pages feeling empty or broken before interaction.',
    offenders.slice(0, 8),
  ));
}

function renderReport(results, issues) {
  const lines = [];
  lines.push('# Public Browser Audit');
  lines.push('');
  lines.push(`- Run: \`${runId}\``);
  lines.push(`- Base URL: ${baseUrl}`);
  lines.push(`- Pages checked: ${results.length}`);
  lines.push(`- Issues found: ${issues.length}`);
  lines.push('');
  lines.push('## Results');
  lines.push('');

  for (const result of results) {
    lines.push(`### ${result.slug} / ${result.viewport}`);
    lines.push('');
    lines.push(`- URL: ${result.url}`);
    lines.push(`- Title: ${result.title}`);
    lines.push(`- Initial root length: ${result.mount.initial.rootLength}`);
    lines.push(`- Settled root length: ${result.mount.settled.rootLength}`);
    lines.push(`- Console errors: ${result.consoleErrors.length}`);
    lines.push(`- Page errors: ${result.pageErrors.length}`);
    lines.push(`- Failed requests: ${result.requestFailures.length}`);
    lines.push(`- Top screenshot: ${result.screenshotPaths.initial}`);
    lines.push(`- Full screenshot: ${result.screenshotPaths.full}`);
    if (result.headings.length > 0) {
      lines.push(`- Headings: ${result.headings.join(' | ')}`);
    }
    if (result.ctas.length > 0) {
      lines.push(`- CTAs: ${result.ctas.map((item) => item.text).join(' | ')}`);
    }
    if (result.bodyTextSample) {
      lines.push(`- Text sample: ${result.bodyTextSample.slice(0, 220)}${result.bodyTextSample.length > 220 ? '…' : ''}`);
    }
    lines.push('');
  }

  if (issues.length > 0) {
    lines.push('## Issues');
    lines.push('');
    for (const current of issues) {
      lines.push(`### ${current.severity} — ${current.title}`);
      lines.push('');
      lines.push(`- ${current.summary}`);
      for (const evidence of current.evidence) {
        lines.push(`- Evidence: ${evidence}`);
      }
      lines.push('');
    }
  }

  return `${lines.join('\n')}\n`;
}

await mkdirp(runDir);
await mkdirp(screenshotsDir);

const browser = await chromium.launch({ headless: true });
const results = [];
let issues = [];

for (const viewport of viewports) {
  for (const pageConfig of pages) {
    const context = await browser.newContext(viewport.contextOptions);
    const page = await context.newPage();
    const instrumentation = await attachPageInstrumentation(page);
    const url = `${baseUrl}${pageConfig.path}`;

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      const mounted = await waitForAppContent(page);
      await waitForRouteReady(page, pageConfig);
      const initialMount = await getMountSnapshot(page);

      const initialScreenshotPath = path.join(screenshotsDir, `${pageConfig.slug}-${viewport.name}-top.png`);
      await page.screenshot({ path: initialScreenshotPath });

      await page.waitForTimeout(stabilityWaitMs);
      const settledMount = await getMountSnapshot(page);

      if (!mounted || initialMount.rootLength === 0) {
        issues.push(issue('P1', `${pageConfig.slug} failed to mount readable content`, 'The page did not render usable content after the initial navigation.', [`${pageConfig.slug}/${viewport.name}`]));
      }

      if (initialMount.rootLength > 0 && settledMount.rootLength === 0) {
        issues.push(issue(
          'P1',
          `${pageConfig.slug} collapses after the initial render`,
          'The page renders content and then unmounts back to an empty app shell. This is the kind of delayed failure a happy-path click test will miss but a human will immediately feel as broken.',
          [
            `${pageConfig.slug}/${viewport.name}`,
            `Initial title: ${initialMount.title}`,
            `Settled title: ${settledMount.title}`,
          ],
        ));
      }

      await scrollThroughPage(page);
      const snapshot = await gatherPageSnapshot(page);

      if (snapshot.headings.length === 0) {
        issues.push(issue('P2', `${pageConfig.slug} rendered without visible headings`, 'A top-level page loaded without a visible heading, which weakens orientation and information scent.', [`${pageConfig.slug}/${viewport.name}`]));
      }

      const fullScreenshotPath = path.join(screenshotsDir, `${pageConfig.slug}-${viewport.name}-full.png`);
      await page.screenshot({ path: fullScreenshotPath, fullPage: true });

      const pageIssues = await runPageChecks(pageConfig, context);
      issues.push(...pageIssues.map((current) => ({
        ...current,
        evidence: unique([...current.evidence, `${pageConfig.slug}/${viewport.name}`]),
      })));

      const consoleErrors = filterConsoleErrors(instrumentation.consoleErrors, pageConfig);

      if (consoleErrors.length > 0) {
        issues.push(issue('P2', `${pageConfig.slug} emitted console errors on ${viewport.name}`, 'The page logged console errors during a clean navigation.', [
          `${pageConfig.slug}/${viewport.name}`,
          ...consoleErrors.slice(0, 3),
        ]));
      }

      if (instrumentation.pageErrors.length > 0) {
        issues.push(issue('P1', `${pageConfig.slug} threw uncaught page errors on ${viewport.name}`, 'The page raised uncaught runtime exceptions during navigation.', [
          `${pageConfig.slug}/${viewport.name}`,
          ...instrumentation.pageErrors.slice(0, 3),
        ]));
      }

      if (instrumentation.requestFailures.length > 0) {
        issues.push(issue('P2', `${pageConfig.slug} had failed network requests on ${viewport.name}`, 'The page triggered failed requests during a clean navigation.', [
          `${pageConfig.slug}/${viewport.name}`,
          ...instrumentation.requestFailures.slice(0, 3),
        ]));
      }

      results.push({
        slug: pageConfig.slug,
        kind: pageConfig.kind,
        viewport: viewport.name,
        url,
        screenshotPaths: {
          initial: initialScreenshotPath,
          full: fullScreenshotPath,
        },
        title: snapshot.title,
        headings: snapshot.headings,
        ctas: snapshot.ctas,
        bodyTextSample: snapshot.bodyTextSample,
        hiddenRevealCount: snapshot.hiddenRevealCount,
        mount: {
          initial: initialMount,
          settled: settledMount,
        },
        consoleErrors,
        pageErrors: instrumentation.pageErrors,
        requestFailures: instrumentation.requestFailures,
      });
    } finally {
      await context.close();
    }
  }
}

await browser.close();

analyzeRepeatedHeadings(results, issues);
analyzeVerticalTemplateReuse(results, issues);
analyzeRevealReliance(results, issues);
issues = mergeIssues(issues);

const report = renderReport(results, issues);
await writeJson(path.join(runDir, 'results.json'), { runId, baseUrl, results, issues });
await writeText(path.join(runDir, 'report.md'), report);

console.log(JSON.stringify({
  runId,
  baseUrl,
  pages: results.length,
  issues: issues.length,
  report: path.join(runDir, 'report.md'),
}, null, 2));
