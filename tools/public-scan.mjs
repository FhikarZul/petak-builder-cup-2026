import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

const root = new URL('../', import.meta.url).pathname;
const skip = new Set(['node_modules', '.git', '.expo', 'android', 'ios', 'build', 'dist', '.pnpm-store']);
const forbiddenPaths = /^(apps\/server|packages\/db|evals|canon|infra\/env|\.secrets)(\/|$)/;
const secretFiles = /(^|\/)(\.env(?!\.example$)|[^/]+\.(?:jks|keystore|p12|p8|pem|key|mobileprovision)|google-services\.json|GoogleService-Info\.plist)$/i;
const rules = [
  ['private key block', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['credential-shaped token', /\b(?:AIza[0-9A-Za-z_-]{30,}|sk-[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|xox[baprs]-[A-Za-z0-9-]{20,}|AKIA[0-9A-Z]{16})\b/],
  ['private Cloud Run URL', /https?:\/\/[^\s'"`]+\.run\.app\b/],
  ['service account credential', /"(?:private_key_id|private_key|client_email)"\s*:\s*"[^\"]{8,}"/],
  ['private key file reference', /(?:service-account|service_account)[^\n]{0,80}\.(?:json|pem|p12)/i],
  ['internal issue identifier', /\b86ey[a-z0-9]{5,}\b/i],
];

const findings = [];
async function visit(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (skip.has(entry.name)) continue;
    const path = join(dir, entry.name);
    const name = relative(root, path).replaceAll('\\', '/');
    if (forbiddenPaths.test(name)) findings.push(`${name}: forbidden source path`);
    if (secretFiles.test(name)) findings.push(`${name}: credential file path`);
    if (entry.isDirectory()) { await visit(path); continue; }
    if (!entry.isFile() || /\.(?:png|jpg|jpeg|webp|ttf|woff2?|ico|pdf|zip)$/.test(name)) continue;
    const content = await readFile(path, 'utf8');
    for (const [label, pattern] of rules) if (pattern.test(content)) findings.push(`${name}: ${label}`);
  }
}

await visit(root);
if (findings.length) {
  for (const finding of findings) console.error(finding);
  process.exitCode = 1;
} else {
  console.log('Public source scan: no credential patterns or forbidden source paths found.');
}
