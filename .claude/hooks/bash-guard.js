#!/usr/bin/env node
// PreToolUse guard for the Bash tool. Blocks the destructive shell commands the
// README's "Blocked" tier promises, however the flags are spelled.
// exit 0 = allow, exit 2 = block (Claude sees the reason and must ask you).
// Fails closed: anything it cannot parse is blocked.
//
// The permission deny list in settings.json is the first line and matches exact
// strings. This hook is the second line: it tokenises the command, normalises
// flags, and decides. It is the one with tests.

const path = require('path');
const { checkSql } = require(path.join(__dirname, 'sql-guard.js'));

const SECRET_PATH = /(^|\/)\.env(\.[^/]*)?$|\.(pem|key|p12)$|(^|\/)\.ssh(\/|$)|(^|\/)\.aws(\/|$)|(^|\/)\.config\/gcloud(\/|$)|(^|\/)secrets(\/|$)/;

function tokenise(seg) {
  // whitespace split that keeps quoted strings together (quotes removed)
  const out = [];
  let cur = '', q = null;
  for (const ch of seg) {
    if (q) { if (ch === q) q = null; else cur += ch; }
    else if (ch === '"' || ch === "'") q = ch;
    else if (/\s/.test(ch)) { if (cur) { out.push(cur); cur = ''; } }
    else cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}

// expand combined short flags: -rf -> -r -f; leaves long flags and values alone
function flags(tokens) {
  const f = new Set();
  for (const t of tokens) {
    if (/^--[a-z]/.test(t)) f.add(t.split('=')[0]);
    else if (/^-[a-zA-Z]+$/.test(t)) for (const c of t.slice(1)) f.add('-' + c);
  }
  return f;
}

// Peel off things that run another command so the real command gets checked:
// VAR=x cmd, xargs cmd, time cmd, nohup cmd, timeout 10 cmd, npx cmd, pnpm dlx cmd, bunx cmd.
function stripWrappers(tokens) {
  let t = tokens.slice();
  for (let guard = 0; guard < 6 && t.length; guard++) {
    while (t.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(t[0])) t.shift();
    if (!t.length) break;
    const c = path.basename(t[0]);
    if (['xargs', 'time', 'nice', 'nohup', 'command', 'exec', 'env', 'npx', 'bunx'].includes(c) && t.length > 1) {
      t.shift();
      while (t.length && t[0].startsWith('-')) t.shift();
      continue;
    }
    if (c === 'timeout' && t.length > 2) { t.splice(0, 2); continue; }
    if ((c === 'pnpm' || c === 'yarn') && t[1] === 'dlx') { t.splice(0, 2); continue; }
    break;
  }
  return t;
}

function checkSegment(seg) {
  const tokens = stripWrappers(tokenise(seg));
  if (!tokens.length) return null;
  const cmd = path.basename(tokens[0]);
  const args = tokens.slice(1);
  const f = flags(args);
  const has = (...xs) => xs.some(x => f.has(x));

  if (cmd === 'sudo' || cmd === 'doas' || cmd === 'su') return 'privilege escalation';
  if (cmd === 'dd' || /^mkfs/.test(cmd) || cmd === 'shred' || cmd === 'wipefs') return 'disk-level destructive command';

  if (cmd === 'rm') {
    const recursive = has('-r', '-R', '--recursive');
    const force = has('-f', '--force');
    if (recursive && force) return 'rm with recursive and force';
    const targets = args.filter(a => !a.startsWith('-'));
    if (targets.some(t => ['/', '~', '.', '..', '*', '$HOME', '/*'].includes(t))) return 'rm on a root, home or wildcard path';
  }

  if (cmd === 'chmod') {
    if (has('-R', '--recursive')) return 'chmod -R';
    if (args.some(a => /^[0-7]?777$/.test(a) || /^[ugoa]*\+[rwx]*o[rwx]*/.test(a) && a.includes('w'))) return 'chmod to world-writable';
  }
  if (cmd === 'chown' && has('-R', '--recursive')) return 'chown -R';

  if (cmd === 'git') {
    const sub = args.find(a => !a.startsWith('-'));
    const rest = args.slice(args.indexOf(sub) + 1);
    const rf = flags(rest);
    if (sub === 'push') {
      if (rf.has('-f') || rf.has('--force') || rf.has('--force-with-lease') || rf.has('--force-if-includes')) return 'git push with force';
      if (rest.some(a => /^\+/.test(a))) return 'git push with a + refspec (force)';
      if (rest.some(a => /^--?delete$|^-d$/.test(a)) || rest.some(a => /^:[^:]/.test(a))) return 'git push deleting a remote branch';
    }
    if (sub === 'reset' && rf.has('--hard')) return 'git reset --hard';
    if (sub === 'clean') return 'git clean';
    if (sub === 'branch' && (rf.has('-D') || (rf.has('-d') && rf.has('-f')) || (rf.has('--delete') && rf.has('--force')))) return 'git branch force delete';
    if (sub === 'checkout' && rest.includes('--') && rest.some(a => a === '.' )) return 'git checkout -- . discards all changes';
    if (sub === 'restore' && rest.some(a => a === '.') && !rf.has('--staged')) return 'git restore . discards all changes';
    if (sub === 'filter-branch' || sub === 'filter-repo') return 'history rewrite';
    if (sub === 'update-ref' && rest.some(a => a === '-d')) return 'git update-ref -d';
  }

  if (cmd === 'supabase' && args[0] === 'db' && args[1] === 'reset') return 'supabase db reset';
  if (cmd === 'prisma' && args.includes('migrate') && args.includes('reset')) return 'prisma migrate reset';
  if (cmd === 'wrangler' && args.includes('delete')) return 'wrangler delete';
  if (cmd === 'vercel' && (args.includes('remove') || args.includes('rm'))) return 'vercel remove';
  if (cmd === 'dropdb') return 'dropdb';

  // SQL on the command line goes through the same rules as the MCP query tools
  const sqlArg = (() => {
    if (cmd === 'psql' || cmd === 'mysql' || cmd === 'sqlite3') {
      const i = args.findIndex(a => a === '-c' || a === '-e' || a === '--command');
      if (i >= 0 && args[i + 1]) return args[i + 1];
      if (cmd === 'sqlite3' && args.length >= 2) return args[args.length - 1];
    }
    if (cmd === 'supabase' && args[0] === 'db' && args[1] === 'query') return args.slice(2).filter(a => !a.startsWith('-')).join(' ');
    return null;
  })();
  if (sqlArg) { const why = checkSql(sqlArg); if (why) return `SQL on the command line: ${why}`; }

  // reading secrets through the shell (the Read tool is already denied these paths)
  if (['cat', 'less', 'more', 'head', 'tail', 'bat', 'strings', 'base64', 'xxd', 'od', 'source', '.'].includes(cmd) ||
      (cmd === 'cp' || cmd === 'scp' || cmd === 'rsync') || cmd === 'curl' || cmd === 'wget') {
    // look inside every argument, including forms like file=@.env or --data-binary @.env
    const pieces = args.flatMap(a => a.split(/[=@:,]/)).filter(Boolean);
    if (pieces.some(p => SECRET_PATH.test(p))) return 'reads or ships a secret file';
  }
  if ((cmd === 'printenv' || cmd === 'env' || cmd === 'export') && args.length === 0) return 'dumps the whole environment';

  return null;
}

// Heredoc bodies are data (a file being written, a script for python) unless they are
// fed to a shell or a SQL client, in which case they are code and get checked as such.
function splitHeredocs(command) {
  const lines = command.split('\n');
  const code = [];
  const bodies = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    code.push(line);
    const m = line.match(/<<-?\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1/);
    if (!m) continue;
    const term = m[2];
    const body = [];
    i++;
    while (i < lines.length && lines[i].replace(/^\t+/, '') !== term) { body.push(lines[i]); i++; }
    const consumer = line.slice(0, line.indexOf('<<')).split(/\|\||&&|;|\|/).pop();
    bodies.push({ consumer: consumer.trim(), body: body.join('\n') });
  }
  return { code: code.join('\n'), bodies };
}

const SHELLS = ['bash', 'sh', 'zsh', 'dash', 'ksh'];
const SQL_CLIENTS = ['psql', 'mysql', 'sqlite3'];

function checkCommand(command, depth = 0) {
  if (typeof command !== 'string' || !command.trim()) return 'empty or non-string command';
  if (depth > 3) return 'nesting too deep to check';
  const { code, bodies } = splitHeredocs(command);
  // split on the shell operators that sequence commands; each part is checked
  const segments = code.split(/\|\||&&|;|\||\n/).map(s => s.trim()).filter(Boolean);
  for (const seg of segments) {
    // command substitution and subshells: check what is inside them too
    const inner = [...seg.matchAll(/\$\(([^)]*)\)|`([^`]*)`/g)].map(m => m[1] ?? m[2]).filter(Boolean);
    for (const part of [seg, ...inner]) {
      const why = checkSegment(part);
      if (why) return why;
    }
  }
  for (const { consumer, body } of bodies) {
    const tokens = stripWrappers(tokenise(consumer));
    const cmd = tokens.length ? path.basename(tokens[0]) : '';
    if (SHELLS.includes(cmd)) {
      const why = checkCommand(body, depth + 1);
      if (why && why !== 'empty or non-string command') return why;
    } else if (SQL_CLIENTS.includes(cmd) || (cmd === 'supabase' && tokens[1] === 'db')) {
      const why = checkSql(body);
      if (why && why !== 'empty or non-string query') return 'SQL on the command line: ' + why;
    }
  }
  return null;
}

// splitHeredocs is shared with no-blind-overwrite.js, which needs the same
// distinction between shell and heredoc data to avoid refusing a script that
// merely contains a redirect.
module.exports = { checkCommand, splitHeredocs, tokenise, SECRET_PATH };

if (require.main === module) {
  let raw = '';
  process.stdin.on('data', d => raw += d);
  process.stdin.on('end', () => {
    let c;
    try { c = (JSON.parse(raw).tool_input || {}).command; }
    catch { return block('could not parse hook input'); }
    const why = checkCommand(c);
    if (why) return block(why);
    process.exit(0);
  });
}

function block(why) {
  process.stderr.write(`bash-guard BLOCKED: ${why}. Ask before running this.\n`);
  process.exit(2);
}
