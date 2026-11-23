#!/usr/bin/env node
// T0.5b / §0.7 : rejette toute signature Claude dans un message de commit ou une description de PR.
// Usage : node check-no-claude-signature.mjs <fichier>   (hook commit-msg)
//         node check-no-claude-signature.mjs              (lit stdin, ex. corps de PR en CI)
import { readFileSync } from 'node:fs';

const FORBIDDEN = [
  /co-authored-by:\s*claude/i,
  /claude-session:/i,
  /generated with \[?claude code/i,
  /noreply@anthropic\.com/i,
];

const file = process.argv[2];
const text = readFileSync(file ?? 0, 'utf8');
const hit = FORBIDDEN.find((re) => re.test(text));

if (hit) {
  console.error(`✗ Signature Claude interdite (PLAN §0.7) : motif ${String(hit)}`);
  process.exit(1);
}
