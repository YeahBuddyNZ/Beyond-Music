#!/usr/bin/env node
// PreToolUse hook for every tool. The Driver does the clicking a person would do
// on autopilot, and holds the brake.
//
// 1. Pause switch. If .claude/PAUSE exists in the project, or ~/.claude/PAUSE
//    exists for the user, every tool call is refused and the session is stopped.
//    The home file stops every project on the machine at once. Delete the file to
//    carry on. The AI cannot unpause itself: removing the file is a tool call.
// 2. Read-only shell. A Bash command made only of commands that look and never
//    change anything (ls, cat, grep, wc, head, ...) is approved without a prompt.
//    Anything else gets no decision from here and goes through the normal
//    allow / ask / deny rules, so this can only remove prompts that were safe.
// 3. Not-live repos. If .claude/driver.json says {"live": false, "repo": "owner/name"},
//    pushing a feature branch and merging a PR on that repo run without a prompt.
//    Anything else (no file, "live": true, another repo, a push to main or master,
//    a push to another remote) gets "ask". Missing or unreadable means live.
//    Changing driver.json itself always asks: whether a repo is live is the
//    owner's call, never the AI's.
//
// Apart from 3, it never says "allow" for anything that writes, and the guards still run
// beside it: a block from bash-guard beats an allow from here, and settings
// deny and ask rules still apply over a hook allow.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { tokenise, SECRET_PATH, splitHeredocs } = require(path.join(__dirname, 'bash-guard.js'));

// Commands that only read. Each was checked for a flag that writes or runs
// another program; those flags are refused in NEVER_FLAGS below.
// Left out on purpose: sed and awk (can write files), sort and uniq (can write an
// output file), tree (-o), xargs, env, find with actions, less (interactive).
const READ_ONLY = new Set([
  'ls', 'cat', 'head', 'tail', 'wc', 'grep', 'egrep', 'fgrep', 'rg', 'find',
  'pwd', 'echo', 'printf', 'which', 'type', 'file', 'stat', 'du', 'df',
  'basename', 'dirname', 'realpath', 'readlink', 'cut', 'tr', 'diff', 'cmp',
  'jq', 'date', 'cd', 'true', 'nl', 'column',
]);

const NEVER_FLAGS = {
  find: ['-exec', '-execdir', '-ok', '-okdir', '-delete', '-fprint', '-fprint0', '-fprintf', '-fls'],
  rg: ['--pre', '--pre-glob', '-u', '-uu', '-uuu', '--hidden', '--no-ignore', '-.'],
  diff: ['--recursive'],
  date: ['-s', '--set'],
  grep: ['-r', '-R', '--recursive', '-d', '--directories'],
  egrep: ['-r', '-R', '--recursive'],
  fgrep: ['-r', '-R', '--recursive'],
};

// Commands that print file contents. An unquoted glob could expand to .env, so
// for these a glob means no decision.
const READS_CONTENT = new Set(['cat', 'head', 'tail', 'grep', 'egrep', 'fgrep', 'rg', 'nl', 'cut', 'diff', 'cmp', 'jq', 'column', 'tr']);

const unquoted = seg => seg.replace(/'[^']*'|"[^"]*"/g, '');

function pauseFile(root) {
  const candidates = [path.join(root, '.claude', 'PAUSE'), path.join(os.homedir(), '.claude', 'PAUSE')];
  return candidates.find(f => fs.existsSync(f)) || null;
}

// Split on shell operators outside quotes. Returns null if the command holds
// anything this hook will not reason about: redirects, substitutions, subshells,
// heredocs or unbalanced quotes. Null means "no decision", never "allow".
function segments(command) {
  const cleaned = command.replace(/\s[12]?>\s*\/dev\/null/g, ' ').replace(/\s2>&1/g, ' ');
  if (/\$\(|`|<\(|>\(/.test(cleaned)) return null;
  const out = [];
  let cur = '', q = null;
  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (q) { if (ch === q) q = null; else if (ch === '$' && q === '"') return null; cur += ch; continue; }
    if (ch === '"' || ch === "'") { q = ch; cur += ch; continue; }
    if (ch === '$') return null; // a variable could name a secret file
    if (ch === '>' || ch === '<' || ch === '(' || ch === ')' || ch === '{' || ch === '}') return null;
    if (ch === '|' || ch === '&' || ch === ';' || ch === '\n') { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  if (q) return null;
  out.push(cur);
  return out.map(s => s.trim()).filter(Boolean);
}

function isReadOnly(command) {
  if (typeof command !== 'string' || !command.trim()) return false;
  const segs = segments(command);
  if (!segs || !segs.length) return false;
  return segs.every(seg => {
    const tokens = tokenise(seg);
    if (!tokens.length) return false;
    const cmd = tokens[0];
    if (!READ_ONLY.has(cmd)) return false;
    const args = tokens.slice(1);
    const never = NEVER_FLAGS[cmd] || [];
    if (args.some(a => never.includes(a.split('=')[0]))) return false;
    if (['grep', 'egrep', 'fgrep', 'diff'].includes(cmd) && args.some(a => /^-[a-zA-Z]*[rR]/.test(a))) return false;
    if (READS_CONTENT.has(cmd) && /[*?[]/.test(unquoted(seg))) return false;
    // a secret file is never read silently; bash-guard blocks the cat, this keeps the rest at a prompt
    if (args.flatMap(a => a.split(/[=@:,]/)).some(p => p && SECRET_PATH.test(p))) return false;
    return true;
  });
}

function driverConfig(root) {
  try { return JSON.parse(fs.readFileSync(path.join(root, '.claude', 'driver.json'), 'utf8')); }
  catch { return null; }
}
const notLive = cfg => !!cfg && cfg.live === false && typeof cfg.repo === 'string' && /^[\w.-]+\/[\w.-]+$/.test(cfg.repo);

const MAIN_BRANCHES = ['main', 'master', 'production', 'prod', 'release'];
const MERGE_TOOL = /__(merge_pull_request|enable_pr_auto_merge)$/;

function currentBranch(root) {
  // symbolic-ref also works on a branch with no commits yet; detached HEAD fails, which means ask
  const r = spawnSync('git', ['-C', root, 'symbolic-ref', '--short', 'HEAD'], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : null;
}

// Does the shell command push? Heredoc bodies are data, so text about pushing is not a push.
const pushes = command => /\bgit\b[^|;&\n]*\bpush\b/.test(splitHeredocs(command).code);

// A plain "git push [flags] [origin] [branch...]" of a feature branch, nothing else in the command.
function isFeaturePush(command, root) {
  const segs = segments(command);
  if (!segs || segs.length !== 1) return false;
  const t = tokenise(segs[0]);
  if (t[0] !== 'git' || t[1] !== 'push') return false;
  const pos = t.slice(2).filter(a => !a.startsWith('-'));
  if (pos.length && pos[0] !== 'origin') return false;
  const refs = pos.slice(1).map(r => r.split(':').pop().replace(/^refs\/heads\//, ''));
  const targets = refs.length ? refs.map(r => r === 'HEAD' ? currentBranch(root) : r) : [currentBranch(root)];
  return targets.every(b => b && b !== 'HEAD' && !MAIN_BRANCHES.includes(b));
}

function touchesDriverConfig(tool, input) {
  if (['Write', 'Edit', 'MultiEdit', 'NotebookEdit'].includes(tool)) return /(^|\/)\.claude\/driver\.json$/.test(String(input.file_path || ''));
  if (tool === 'Bash') return /driver\.json/.test(String(input.command || '')) && !isReadOnly(input.command);
  return false;
}

// The decision for one tool call: [decision, reason], or null for no decision.
function decide(tool, input, root) {
  input = input || {};
  if (touchesDriverConfig(tool, input)) return ['ask', 'Driver: whether this repo is live is the owner\'s call'];
  const cfg = driverConfig(root);
  if (tool === 'Bash' && typeof input.command === 'string' && pushes(input.command)) {
    if (notLive(cfg) && isFeaturePush(input.command, root)) return ['allow', `Driver: ${cfg.repo} is not live, feature branch push`];
    return ['ask', 'Driver: pushes need the owner on a live repo, to a main branch, or to another remote'];
  }
  if (MERGE_TOOL.test(tool || '')) {
    const target = `${input.owner}/${input.repo}`.toLowerCase();
    if (notLive(cfg) && cfg.repo.toLowerCase() === target) return ['allow', `Driver: ${cfg.repo} is not live, merging`];
    return ['ask', 'Driver: merges need the owner unless .claude/driver.json marks this repo not live'];
  }
  if (tool === 'Bash' && isReadOnly(input.command)) return ['allow', 'Driver: read-only command'];
  return null;
}

module.exports = { isReadOnly, pauseFile, decide };

if (require.main === module) {
  let raw = '';
  process.stdin.on('data', d => raw += d);
  process.stdin.on('end', () => {
    let input = {};
    try { input = JSON.parse(raw); } catch { /* the pause still applies; nothing is allowed */ }
    const root = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();

    const paused = pauseFile(root);
    if (paused) {
      const why = `Paused by the Driver (${paused} exists). Stop, and say where you got to. Delete that file to carry on.`;
      process.stdout.write(JSON.stringify({
        continue: false,
        stopReason: why,
        hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: why },
      }) + '\n');
      return process.exit(0);
    }

    const d = decide(input.tool_name, input.tool_input, root);
    if (d) {
      process.stdout.write(JSON.stringify({
        hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: d[0], permissionDecisionReason: d[1] },
      }) + '\n');
    }
    process.exit(0);
  });
}
