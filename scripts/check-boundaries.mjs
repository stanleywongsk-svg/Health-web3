import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const errors = [];
function files(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(item => {
    if (['node_modules', '.expo', 'ios', 'android', 'dist'].includes(item.name)) return [];
    const full = path.join(dir, item.name);
    return item.isDirectory() ? files(full) : /\.[cm]?[jt]sx?$/.test(item.name) ? [full] : [];
  });
}
function imports(file) {
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const found = [];
  function visit(node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) found.push(node.moduleSpecifier.text);
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === 'require')) && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) found.push(node.arguments[0].text);
    ts.forEachChild(node, visit);
  }
  visit(source);
  return found;
}
const clientFiles = [...files('apps/mobile'), ...files('apps/admin'), ...files('packages/api-client')].filter(f => !/\.test\./.test(f));
for (const file of clientFiles) {
  const text = fs.readFileSync(file, 'utf8');
  if (/process\.env\.[A-Z_]*(?:SERVICE_ROLE|SECRET_KEY|PRIVATE_KEY)/.test(text)) errors.push(`${file}: privileged environment variable in client code`);
  for (const spec of imports(file)) {
    if (/synthetic|fixtures|\/lab\//i.test(spec)) errors.push(`${file}: synthetic/Lab import in core client: ${spec}`);
  }
}
for (const file of [...files('apps/web3-lab'), ...files('lab')]) {
  for (const spec of imports(file)) {
    if (/healthloop\/(domain|health-provider|api-client)|supabase|apps\/mobile/.test(spec)) errors.push(`${file}: core identity/data dependency in Lab: ${spec}`);
  }
}
// Walk the real health provider's default entry to prevent transitive fixture imports.
const visited = new Set();
function walk(file) {
  if (!fs.existsSync(file) || visited.has(file)) return;
  visited.add(file);
  for (const spec of imports(file)) {
    if (/synthetic|fixtures/i.test(spec)) errors.push(`${file}: default provider reaches fixture module: ${spec}`);
    if (spec.startsWith('.')) {
      const base = path.resolve(path.dirname(file), spec).replace(/\.js$/, '');
      const target = [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts')].find(f => fs.existsSync(f) && fs.statSync(f).isFile());
      if (target) walk(target);
    }
  }
}
walk('packages/health-provider/src/index.ts');
const requirements = JSON.parse(fs.readFileSync('docs/requirements.json', 'utf8'));
if (requirements.length !== 58 || new Set(requirements.map(r => r.id)).size !== 58) errors.push('Requirement register must retain all 58 unique IDs');
for (const r of requirements) if (!['B', 'C'].includes(r.owner) || r.reviewer !== (r.owner === 'B' ? 'C' : 'B')) errors.push(`${r.id}: owner/reviewer assignments invalid`);
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
else console.log(`Boundary checks passed: ${clientFiles.length} client files; 58 requirement assignments; no core fixture/Lab imports.`);
