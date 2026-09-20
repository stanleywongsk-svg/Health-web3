import fs from 'node:fs';
import path from 'node:path';
const dir = 'apps/mobile/dist/_expo/static/js/ios';
const bundles = fs.readdirSync(dir).filter(name => name.endsWith('.hbc') || name.endsWith('.js'));
if (bundles.length !== 1) throw new Error('Expected one freshly exported iOS bundle; run mobile:bundle.');
const bundle = fs.readFileSync(path.join(dir, bundles[0]));
if (!bundle.includes(Buffer.from('HealthLoopHealth'))) throw new Error('Real native adapter missing from iOS bundle.');
for (const forbidden of ['SyntheticHealthProvider', 'synthetic-demo-v1', 'synthetic_demo', 'createSyntheticProvider']) {
  if (bundle.includes(Buffer.from(forbidden))) throw new Error(`Synthetic fixture found in real iOS bundle: ${forbidden}`);
}
console.log('iOS bundle isolation passed: real HealthLoopHealth module present; synthetic provider/policy excluded.');
