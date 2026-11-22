#!/usr/bin/env node
// SessionStart hook. Reports which Beyond Autopilot payload this repo runs and
// warns about the things that most often mean "it is installed but not working".
// Output goes into the session's context, so keep it to a few lines.
const fs = require('fs');
const path = require('path');

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const lines = [];
const warn = m => lines.push(`WARNING: ${m}`);

let version = 'unknown';
try {
  const stamp = JSON.parse(fs.readFileSync(path.join(root, '.claude', 'autopilot.json'), 'utf8'));
  version = `${stamp.version} (installed ${String(stamp.installed_at).slice(0, 10)} from ${stamp.source})`;
} catch { warn('no .claude/autopilot.json stamp; re-run the installer so future sessions know which version this is'); }
lines.unshift(`Beyond Autopilot ${version}`);

for (const f of ['sql-guard.js', 'bash-guard.js', 'driver.js']) {
  if (!fs.existsSync(path.join(root, '.claude', 'hooks', f))) warn(`.claude/hooks/${f} is missing; the guard for it is not active`);
}

try {
  const md = fs.readFileSync(path.join(root, 'CLAUDE.md'), 'utf8');
  if (!/^## Project/m.test(md)) warn('CLAUDE.md has no "## Project" section');
  else if (/## Project[\s\S]*<!-- Fill in per repo/.test(md)) warn('the "## Project" section of CLAUDE.md is still the template; fill it in (name, stack, run and test commands, migration tool)');
} catch { warn('CLAUDE.md is missing at the repo root'); }

for (const f of [path.join(root, '.claude', 'PAUSE'), path.join(require('os').homedir(), '.claude', 'PAUSE')]) {
  if (fs.existsSync(f)) warn(`paused by the Driver: ${f} exists, so every tool call will stop the session. Delete it to carry on.`);
}

if (!fs.existsSync(path.join(root, 'docs', 'plans'))) lines.push('Note: docs/plans/ does not exist yet; /plan will create it.');

// Drift check: the gate weakens when someone clicks "always allow, this project".
// Each click promotes an escalation op into allow; enough of them empty the ask
// list, and the confirm-before-deploy layer is gone. Two real installs hit this.
// See docs/decisions.md ("Safe by default: allow reads, ask for writes").
try {
  const perms = JSON.parse(fs.readFileSync(path.join(root, '.claude', 'settings.json'), 'utf8')).permissions || {};
  const allow = Array.isArray(perms.allow) ? perms.allow.filter(a => typeof a === 'string') : [];
  const ask = Array.isArray(perms.ask) ? perms.ask : [];
  const ESCALATION = ['git push ', 'git merge ', 'git rebase ', 'apply_migration', 'deploy_edge_function',
    'deploy_to_vercel', 'trigger_deploy', 'update_environment_variables', 'merge_pull_request', 'push_files',
    'supabase db push', 'functions deploy'];
  const leaked = allow.filter(a => ESCALATION.some(e => a.includes(e)));
  const wildcard = allow.filter(a => a.endsWith('__*'));
  if (leaked.length) warn(`deploy/push/merge operations are in the "allow" list (${leaked.slice(0, 3).join(', ')}${leaked.length > 3 ? ', +' + (leaked.length - 3) : ''}); they will run without asking. This is what "always allow, this project" does. Move them back to "ask".`);
  else if (allow.length > 25 && ask.length === 0) warn('the "ask" list is empty while "allow" is long; the confirm-before-deploy layer looks stripped. Restore it from the payload.');
  if (wildcard.length) warn(`the "allow" list has broad connector wildcards (${wildcard.slice(0, 2).join(', ')}); those auto-allow every tool on the connector, writes included. Use read-only patterns and let writes ask.`);
} catch { /* settings.json unreadable here means it did not parse; Claude Code surfaces that itself */ }

process.stdout.write(lines.join('\n') + '\n');
