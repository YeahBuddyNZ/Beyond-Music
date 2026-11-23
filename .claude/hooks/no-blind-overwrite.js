#!/usr/bin/env node
// PreToolUse guard against a create becoming an overwrite.
//
// Two halves, one rule: nothing that already has content gets destroyed unless
// the destruction is a deliberate act that leaves a diff.
//
//   Write  refuses when the target exists, is inside the project, and is not empty.
//   Bash   refuses a single '>' onto a path git is already tracking.
//
// exit 0 = allow, exit 2 = block.
//
// Where this came from. TRBR portal, 12 and 14 August 2026: a working weather
// module and then a set of geometry tests were silently replaced. Both times the
// rule was written into CLAUDE.md, and both times it was skipped, so it became a
// hook instead. Within an hour of the Write half going in, a 'cat >' from Bash
// destroyed a 49 line .env.example carrying live Xero and Teletrac settings. A
// documented hole is still a hole.
//
// Why it belongs in this payload rather than in one repo. The version that lived
// in one developer's ~/.claude was absent from every cloud container for nine
// days, because a clone carries .claude/ and never ~/.claude/, while two files
// claimed it was running. A control registered outside the repository is not
// registered.
//
// Deliberately narrow, so it does not become noise and teach people to route
// around it: a single '>' and never '>>', never /dev/*, never a descriptor
// redirect like 2>&1, and only when git already tracks the target. Untracked
// files are build output, scratch and local notes.

const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');
const { splitHeredocs } = require(path.join(__dirname, 'bash-guard.js'));

// An optional fd number or &, then exactly one > , then the target.
// '>>' is excluded by the lookarounds. 2>&1 and >&2 are excluded because the
// character after > is &, which the target class refuses, so no match forms.
const REDIRECT = /(?<!>)(?:\d+|&)?>(?!>)\s*([^\s;|&<>()]+)/g;

/**
 * Paths a command would truncate. Pure, so the tests do not need a repository.
 * Heredoc bodies are data rather than shell: a script being written that happens
 * to contain a redirect must not trip the guard, or the guard blocks every
 * attempt to edit itself.
 */
function truncationTargets(command) {
  if (typeof command !== 'string' || !command.trim()) return [];
  const { code } = splitHeredocs(command);
  const out = [];
  for (const m of code.matchAll(REDIRECT)) {
    const target = m[1];
    if (target && !target.startsWith('/dev/')) out.push(target);
  }
  return out;
}

function projectDir() {
  return process.env.CLAUDE_PROJECT_DIR || process.cwd();
}

function tracked(target, root) {
  const r = spawnSync('git', ['-C', root, 'ls-files', '--error-unmatch', '--', target], {
    encoding: 'utf8',
  });
  return r.status === 0;
}

/** A Write is refused only for a file inside the project that already has content. */
function writeWouldDestroy(filePath, root) {
  if (typeof filePath !== 'string' || !filePath) return false;
  const abs = path.resolve(root, filePath);
  if (path.relative(root, abs).startsWith('..')) return false; // scratch and temp are exempt
  try {
    return fs.statSync(abs).size > 0;
  } catch {
    return false;
  }
}

module.exports = { truncationTargets, writeWouldDestroy };

if (require.main === module) {
  let raw = '';
  process.stdin.on('data', (d) => (raw += d));
  process.stdin.on('end', () => {
    let input;
    try {
      input = JSON.parse(raw);
    } catch {
      return block('could not parse hook input');
    }
    const tool = input.tool_name || '';
    const args = input.tool_input || {};
    const root = projectDir();

    if (tool === 'Write') {
      if (writeWouldDestroy(args.file_path, root)) {
        return block(
          `${args.file_path} already exists and is not empty.\n` +
            '  To change part of it:   read it, then use Edit.\n' +
            '  To replace it entirely: read it, confirm that is right, then remove it\n' +
            '                          first, so the replacement is a deliberate act.'
        );
      }
      process.exit(0);
    }

    if (tool === 'Bash') {
      for (const target of truncationTargets(args.command)) {
        if (tracked(target, root)) {
          return block(
            `a '>' would truncate ${target}, which git is tracking.\n` +
              "  '>' truncates before the command on its left produces anything, so a\n" +
              '  failed command still destroys the file.\n' +
              '  To append instead: use \'>>\', which this guard allows.'
          );
        }
      }
      process.exit(0);
    }

    process.exit(0);
  });
}

function block(why) {
  process.stderr.write(`no-blind-overwrite BLOCKED: ${why}\n`);
  process.exit(2);
}
