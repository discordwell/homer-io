import { LIVE_SURFACES, TODAY } from './config.mjs';

function groupBySeverity(issues) {
  return issues.reduce((acc, issue) => {
    acc[issue.severity] ||= [];
    acc[issue.severity].push(issue);
    return acc;
  }, {});
}

function renderProbe(probe) {
  if (probe.status) {
    return `- ${probe.name}: ${probe.status}${probe.error ? ` (${probe.error})` : ''}`;
  }
  return `- ${probe.name}: error${probe.error ? ` (${probe.error})` : ''}`;
}

export function renderMarkdownReport({ runId, inventory, issues, probes, buildChecks }) {
  const grouped = groupBySeverity(issues);
  const lines = [];

  lines.push('# Production Audit');
  lines.push('');
  lines.push(`- Run: \`${runId}\``);
  lines.push(`- Generated: ${new Date().toISOString()}`);
  lines.push(`- Audit baseline date: ${TODAY}`);
  lines.push(`- Live public target: ${LIVE_SURFACES.publicSite}`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- Routes inventoried: ${inventory.summary.routeCount}`);
  lines.push(`- Route references checked: ${inventory.summary.referenceCount}`);
  lines.push(`- Missing route references: ${inventory.summary.missingReferenceCount}`);
  lines.push(`- Issues found: ${issues.length}`);
  lines.push('');
  lines.push('## Severity Breakdown');
  lines.push('');
  for (const severity of ['P0', 'P1', 'P2', 'P3']) {
    lines.push(`- ${severity}: ${(grouped[severity] || []).length}`);
  }
  lines.push('');
  lines.push('## Surface Probes');
  lines.push('');
  for (const probe of probes) {
    lines.push(renderProbe(probe));
  }
  lines.push('');
  lines.push('## Build Signals');
  lines.push('');
  lines.push(`- Web tests: ${buildChecks.webTests.code === 0 ? 'pass' : 'fail'}`);
  lines.push(`- Web build: ${buildChecks.webBuild.code === 0 ? 'pass' : 'fail'}`);
  lines.push('');

  for (const severity of ['P0', 'P1', 'P2', 'P3']) {
    const severityIssues = grouped[severity] || [];
    if (severityIssues.length === 0) continue;
    lines.push(`## ${severity}`);
    lines.push('');
    for (const issue of severityIssues) {
      lines.push(`### ${issue.title}`);
      lines.push('');
      lines.push(`- Class: ${issue.class}`);
      lines.push(`- Summary: ${issue.summary}`);
      lines.push(`- Recommendation: ${issue.recommendation}`);
      if (issue.evidence.length > 0) {
        lines.push('- Evidence:');
        for (const evidence of issue.evidence) {
          const location = evidence.line ? `${evidence.source}:${evidence.line}` : evidence.source;
          lines.push(`  - ${location}${evidence.detail ? ` — ${evidence.detail}` : ''}`);
        }
      }
      lines.push('');
    }
  }

  lines.push('## Wet Review Queue');
  lines.push('');
  for (const cell of inventory.routeMatrix) {
    lines.push(`- ${cell.route} — ${cell.pageClass}, ${cell.passQuota} passes, persona: ${cell.persona}`);
  }
  lines.push('');

  return `${lines.join('\n')}\n`;
}
