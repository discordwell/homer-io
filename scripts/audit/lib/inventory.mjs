import path from 'node:path';
import ts from 'typescript';
import { FILES, PASS_QUOTAS, REQUIRED_ACTIONS, REQUIRED_STATES, ROOT_DIR } from './config.mjs';
import { lineFromIndex, listFiles, normalizePath, readText, relativeToRoot, stripQueryAndHash } from './util.mjs';

function getTagName(tagName) {
  if (ts.isIdentifier(tagName)) return tagName.text;
  if (ts.isPropertyAccessExpression(tagName)) return tagName.name.text;
  return '';
}

function getAttribute(node, name) {
  return node.properties.find(
    (prop) => ts.isJsxAttribute(prop) && prop.name.text === name,
  ) || null;
}

function getStringAttribute(node, name) {
  const attr = getAttribute(node, name);
  if (!attr) return null;
  if (!attr.initializer) return '';
  if (ts.isStringLiteral(attr.initializer)) return attr.initializer.text;
  if (ts.isJsxExpression(attr.initializer) && attr.initializer.expression && ts.isStringLiteralLike(attr.initializer.expression)) {
    return attr.initializer.expression.text;
  }
  return null;
}

function hasBooleanAttribute(node, name) {
  const attr = getAttribute(node, name);
  return Boolean(attr && !attr.initializer);
}

function joinRoutePath(basePath, childPath) {
  if (childPath === '*') return '*';
  if (!childPath) return normalizePath(basePath || '/');
  if (childPath.startsWith('/')) return normalizePath(childPath);
  const base = normalizePath(basePath || '/');
  return normalizePath(path.posix.join(base, childPath));
}

function isCatchAllRoute(routePath) {
  return routePath === '*' || routePath === '/*';
}

function routePatternToRegExp(routePath) {
  const pattern = normalizePath(routePath)
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/:([A-Za-z0-9_]+)/g, '[^/]+')
    .replace(/\\\*/g, '.*');
  return new RegExp(`^${pattern}$`);
}

export function pathMatchesRoute(targetPath, routePath) {
  return routePatternToRegExp(routePath).test(normalizePath(targetPath));
}

function collectChildRouteNodes(node) {
  if (!ts.isJsxElement(node)) return [];
  const routeChildren = [];
  for (const child of node.children) {
    if (ts.isJsxElement(child) && getTagName(child.openingElement.tagName) === 'Route') {
      routeChildren.push(child);
    } else if (ts.isJsxSelfClosingElement(child) && getTagName(child.tagName) === 'Route') {
      routeChildren.push(child);
    }
  }
  return routeChildren;
}

export function extractDefinedRoutes(sourceText, filePath) {
  const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const routes = [];

  function visit(node, basePath = '') {
    if (ts.isJsxElement(node) && getTagName(node.openingElement.tagName) === 'Route') {
      processRoute(node, basePath);
      return;
    }

    if (ts.isJsxSelfClosingElement(node) && getTagName(node.tagName) === 'Route') {
      processRoute(node, basePath);
      return;
    }

    ts.forEachChild(node, (child) => visit(child, basePath));
  }

  function processRoute(node, basePath) {
    const attrs = ts.isJsxElement(node) ? node.openingElement.attributes : node.attributes;
    const pathAttr = getStringAttribute(attrs, 'path');
    const isIndex = hasBooleanAttribute(attrs, 'index');
    const fullPath = isIndex ? normalizePath(basePath || '/') : joinRoutePath(basePath, pathAttr || '');
    const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;

    if (pathAttr || isIndex) {
      routes.push({
        path: fullPath,
        line,
        source: relativeToRoot(ROOT_DIR, filePath),
        type: isIndex ? 'index' : 'path',
      });
    }

    const nextBasePath = pathAttr || isIndex ? fullPath : basePath;
    for (const childRoute of collectChildRouteNodes(node)) {
      processRoute(childRoute, nextBasePath);
    }
  }

  visit(sourceFile, '');

  const deduped = new Map();
  for (const route of routes) {
    if (!deduped.has(route.path)) {
      deduped.set(route.path, route);
    }
  }
  return [...deduped.values()];
}

const REFERENCE_PATTERNS = [
  { kind: 'link-to', regex: /\bto=(["'`])(\/[^"'`]+)\1/g },
  { kind: 'href', regex: /\bhref=(["'`])(\/[^"'`]+)\1/g },
  { kind: 'navigate', regex: /\bnavigate\((["'`])(\/[^"'`]+)\1/g },
  { kind: 'path-prop', regex: /\bpath:\s*(["'`])(\/[^"'`]+)\1/g },
];

const ABSOLUTE_URL_PATTERN = /https:\/\/[^\s"'`]+/g;

export async function collectRouteReferences(rootDir) {
  const files = await listFiles(rootDir, (filePath) =>
    filePath.endsWith('.tsx') || filePath.endsWith('.ts'));

  const references = [];
  const absoluteUrls = [];

  for (const filePath of files) {
    const relativePath = relativeToRoot(ROOT_DIR, filePath);
    const text = await readText(filePath);

    for (const pattern of REFERENCE_PATTERNS) {
      let match;
      while ((match = pattern.regex.exec(text)) !== null) {
        references.push({
          kind: pattern.kind,
          target: match[2],
          line: lineFromIndex(text, match.index),
          source: relativePath,
        });
      }
    }

    let urlMatch;
    while ((urlMatch = ABSOLUTE_URL_PATTERN.exec(text)) !== null) {
      absoluteUrls.push({
        raw: urlMatch[0],
        line: lineFromIndex(text, urlMatch.index),
        source: relativePath,
      });
    }
  }

  return { references, absoluteUrls };
}

function extractUrlPath(rawUrl) {
  const templateNormalized = rawUrl.replace(/\$\{[^}]+\}/g, ':dynamic');

  try {
    const parsed = new URL(templateNormalized);
    return {
      domain: parsed.origin,
      path: normalizePath(parsed.pathname || '/'),
    };
  } catch {
    const match = templateNormalized.match(/^(https:\/\/[^/]+)(\/[^?#\s]*)?/);
    return {
      domain: match?.[1] || null,
      path: normalizePath(match?.[2] || '/'),
    };
  }
}

export function classifyRoute(routePath) {
  const normalized = normalizePath(routePath);
  if (isCatchAllRoute(normalized)) return 'unknown';
  if (normalized === '/' || normalized === '/pricing' || ['/cannabis', '/florist', '/pharmacy', '/restaurant', '/grocery', '/furniture'].includes(normalized)) {
    return 'marketing';
  }
  if (['/login', '/register', '/forgot-password', '/reset-password', '/verify-email', '/org-choice'].includes(normalized) || normalized.startsWith('/join/')) {
    return 'auth';
  }
  if (normalized.startsWith('/demo')) return 'demo';
  if (normalized.startsWith('/dashboard')) return 'dashboard';
  if (normalized.startsWith('/driver')) return 'driver';
  if (normalized.startsWith('/track/')) return 'tracking';
  return 'unknown';
}

function personaForClass(pageClass) {
  if (pageClass === 'dashboard') return 'owner';
  if (pageClass === 'driver') return 'driver';
  if (pageClass === 'demo') return 'demo';
  return 'public';
}

export function buildRouteMatrix(routes) {
  return routes
    .filter((route) => !isCatchAllRoute(route.path))
    .map((route) => {
      const pageClass = classifyRoute(route.path);
      return {
        route: route.path,
      pageClass,
      persona: personaForClass(pageClass),
      passQuota: PASS_QUOTAS[pageClass] ?? PASS_QUOTAS.unknown,
      requiredStates: REQUIRED_STATES[pageClass] ?? REQUIRED_STATES.unknown,
      requiredActions: REQUIRED_ACTIONS[pageClass] ?? REQUIRED_ACTIONS.unknown,
      manualWetReview: true,
      source: route.source,
      line: route.line,
      };
    });
}

export async function buildInventory() {
  const appText = await readText(FILES.appTsx);
  const definedRoutes = extractDefinedRoutes(appText, FILES.appTsx)
    .sort((a, b) => a.path.localeCompare(b.path));

  const { references, absoluteUrls } = await collectRouteReferences(FILES.webRoot);
  const backendAbsoluteUrls = await collectRouteReferences(FILES.apiRoot);

  const referencedRoutes = references.filter((ref) => ref.target.startsWith('/'));
  const matchableRoutes = definedRoutes.filter((route) => !isCatchAllRoute(route.path));
  const missingRouteReferences = referencedRoutes.filter((ref) => {
    const targetPath = normalizePath(stripQueryAndHash(ref.target));
    return !matchableRoutes.some((route) => pathMatchesRoute(targetPath, route.path));
  });

  const normalizedAbsoluteUrls = [...absoluteUrls, ...backendAbsoluteUrls.absoluteUrls].map((entry) => ({
    ...entry,
    ...extractUrlPath(entry.raw),
  }));

  const routeMatrix = buildRouteMatrix(definedRoutes);

  return {
    generatedAt: new Date().toISOString(),
    definedRoutes,
    routeMatrix,
    references: referencedRoutes,
    missingRouteReferences,
    absoluteUrls: normalizedAbsoluteUrls,
    summary: {
      routeCount: definedRoutes.length,
      referenceCount: referencedRoutes.length,
      missingReferenceCount: missingRouteReferences.length,
    },
  };
}
