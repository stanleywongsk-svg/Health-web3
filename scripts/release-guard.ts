import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

type Manifest = {
  name?: string; main?: string; exports?: unknown; 'react-native'?: unknown;
  dependencies?: Record<string, string>; optionalDependencies?: Record<string, string>; peerDependencies?: Record<string, string>;
};
const ignoredDirectories = new Set(['node_modules', '.expo', 'ios', 'android', 'dist', '.git']);
const sourceExtension = /\.[cm]?[jt]sx?$/;
const testFile = /(?:\.(?:test|spec)\.[cm]?[jt]sx?$|[/\\]__tests__[/\\])/;

export function productionSourceFiles(directory: string): string[] {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(item => {
    if (ignoredDirectories.has(item.name)) return [];
    const file = path.join(directory, item.name);
    return item.isDirectory() ? productionSourceFiles(file) : sourceExtension.test(file) && !testFile.test(file) ? [file] : [];
  });
}

export function sourceImports(file: string): { imports: string[]; computedImports: number } {
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const imports: string[] = []; let computedImports = 0;
  function visit(node: ts.Node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteralLike(node.moduleSpecifier)) imports.push(node.moduleSpecifier.text);
    if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference) && node.moduleReference.expression && ts.isStringLiteralLike(node.moduleReference.expression)) imports.push(node.moduleReference.expression.text);
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === 'require'))) {
      const argument = node.arguments[0];
      if (argument && ts.isStringLiteralLike(argument)) imports.push(argument.text);
      else computedImports++;
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return { imports, computedImports };
}

function packageName(specifier: string) {
  return specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0]!;
}

/** Package identities only: explanatory copy and expo-crypto UUID/hash use are allowed. */
export function prohibitedIosPackage(name: string): boolean {
  return /^(?:@(?:walletconnect|reown|metamask|solana|thirdweb-dev|web3-react|ethersproject|wagmi|rainbow-me|braintree|paypal)\/|@coinbase\/wallet-sdk$|@stripe\/|(?:viem|wagmi|ethers|web3|siwe|thirdweb|moralis|bitcoinjs-lib|alchemy-sdk|react-native-web3-wallet|react-native-google-mobile-ads|expo-ads-admob|react-native-admob|react-native-applovin-max|react-native-levelplay|react-native-ironsource|react-native-unity-ads|react-native-iap|expo-iap|expo-in-app-purchases|react-native-purchases|react-native-purchases-ui|react-native-braintree-xplat|react-native-paypal|stripe)(?:$|-))/.test(name);
}

function isolatedModule(file: string): boolean {
  const normalized = file.replaceAll('\\', '/');
  return /(?:^|\/)(?:lab|web3-lab)(?:\/|$)/.test(normalized) || /(?:^|\/)(?:synthetic(?:[-.]|\/|$)|__fixtures__(?:\/|$)|fixtures(?:\/|$))/.test(normalized) || testFile.test(normalized);
}

function manifest(file: string): Manifest { return JSON.parse(fs.readFileSync(file, 'utf8')) as Manifest; }
function isFile(file: string) { return fs.existsSync(file) && fs.statSync(file).isFile(); }
function resolveSource(base: string): string | undefined {
  const bare = base.replace(/\.[cm]?js$/, '');
  // Check iOS/native variants as Metro does, before the platform-neutral source.
  return [bare, path.join(bare, 'index')].flatMap(stem => ['.ios', '.native', ''].flatMap(platform => ['.ts', '.tsx', '.js', '.jsx', '.mts', '.mjs', '.cts', '.cjs'].map(extension => `${stem}${platform}${extension}`))).concat(base).find(isFile);
}

function exportTargets(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(exportTargets);
  if (value && typeof value === 'object') return Object.entries(value).filter(([condition]) => ['react-native', 'browser', 'import', 'require', 'default'].includes(condition)).flatMap(([, target]) => exportTargets(target));
  return [];
}

/** Static local-source graph + installed production dependency manifests, never third-party source evaluation. */
export function checkIosReleaseGraph(rootDirectory: string) {
  const root = fs.realpathSync(path.resolve(rootDirectory)); const mobile = path.join(root, 'apps/mobile');
  const errors = new Set<string>(); const visited = new Set<string>(); const packages = new Set<string>();
  const workspaces = new Map<string, string>();
  for (const parent of ['apps', 'packages', 'lab']) {
    const directory = path.join(root, parent);
    if (!fs.existsSync(directory)) continue;
    for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, item.name, 'package.json');
      if (item.isDirectory() && isFile(file)) { const name = manifest(file).name; if (name) workspaces.set(name, file); }
    }
  }
  const relative = (file: string) => path.relative(root, file);
  const configFile = path.join(mobile, 'tsconfig.json');
  const config = isFile(configFile) ? ts.readConfigFile(configFile, ts.sys.readFile).config : {};
  const compilerOptions = ts.parseJsonConfigFileContent(config, ts.sys, mobile).options;
  compilerOptions.moduleResolution = ts.ModuleResolutionKind.Bundler;
  compilerOptions.moduleSuffixes = ['.ios', '.native', ''];

  function dependencyManifest(name: string, importer: string): string | undefined {
    if (workspaces.has(name)) return workspaces.get(name);
    let directory = path.dirname(importer);
    while (true) {
      const candidate = path.join(directory, 'node_modules', name, 'package.json');
      if (isFile(candidate)) return fs.realpathSync(candidate);
      const parent = path.dirname(directory); if (directory === parent) return; directory = parent;
    }
  }

  function visitPackage(file: string) {
    file = fs.realpathSync(file); if (packages.has(file)) return; packages.add(file);
    const value = manifest(file);
    if (isolatedModule(relative(file))) errors.add(`${relative(file)}: isolated Lab/fixture dependency in iOS release`);
    if (value.name && prohibitedIosPackage(value.name)) errors.add(`${relative(file)}: SDK excluded by iOS release policy: ${value.name}`);
    const dependencies = { ...value.dependencies, ...value.optionalDependencies, ...value.peerDependencies };
    for (const [name, version] of Object.entries(dependencies)) {
      const alias = version.startsWith('npm:') ? version.slice(4).match(/^(@[^/]+\/[^@/]+|[^@/]+)/)?.[0] : undefined;
      if (prohibitedIosPackage(name) || (alias && prohibitedIosPackage(alias))) errors.add(`${relative(file)}: SDK dependency excluded by iOS release policy: ${name}${alias ? ` (${alias})` : ''}`);
      const dependency = dependencyManifest(name, file);
      if (dependency) visitPackage(dependency);
      else if (version.startsWith('workspace:')) errors.add(`${relative(file)}: unresolved workspace dependency: ${name}`);
    }
  }

  function visitSource(file: string) {
    file = fs.realpathSync(file); if (visited.has(file)) return; visited.add(file);
    if (isolatedModule(relative(file))) { errors.add(`${relative(file)}: isolated Lab/fixture source reached by iOS release`); return; }
    const parsed = sourceImports(file);
    if (parsed.computedImports) errors.add(`${relative(file)}: computed import/require cannot be verified for iOS release`);
    for (const specifier of parsed.imports) {
      if (isolatedModule(specifier)) errors.add(`${relative(file)}: isolated Lab/fixture import: ${specifier}`);
      const name = packageName(specifier);
      if (prohibitedIosPackage(name)) errors.add(`${relative(file)}: SDK import excluded by iOS release policy: ${specifier}`);
      if (specifier.startsWith('.') || specifier.startsWith('/')) {
        const target = resolveSource(path.resolve(path.dirname(file), specifier));
        if (target) { if (sourceExtension.test(target)) visitSource(target); }
        else errors.add(`${relative(file)}: unresolved local import: ${specifier}`);
        continue;
      }
      const workspace = workspaces.get(name);
      if (workspace) {
        visitPackage(workspace);
        const value = manifest(workspace); const subpath = specifier === name ? '.' : `.${specifier.slice(name.length)}`;
        const exports = value.exports;
        const selected = exports && typeof exports === 'object' && !Array.isArray(exports) && Object.keys(exports).some(key => key.startsWith('.')) ? (exports as Record<string, unknown>)[subpath] : subpath === '.' ? exports : undefined;
        const targets = exportTargets(selected ?? (subpath === '.' && !exports ? value['react-native'] ?? value.main ?? './index.js' : undefined));
        if (!targets.length) errors.add(`${relative(file)}: unresolved workspace export: ${specifier}`);
        for (const entry of targets) {
          const target = resolveSource(path.resolve(path.dirname(workspace), entry));
          if (target) visitSource(target); else errors.add(`${relative(file)}: missing workspace target: ${specifier}`);
        }
        continue;
      }
      const resolved = ts.resolveModuleName(specifier, file, compilerOptions, ts.sys).resolvedModule?.resolvedFileName;
      if (resolved && !resolved.includes(`${path.sep}node_modules${path.sep}`)) visitSource(resolved);
      else {
        const dependency = dependencyManifest(name, file);
        if (dependency) visitPackage(dependency);
        else if (name.startsWith('@healthloop/')) errors.add(`${relative(file)}: unresolved core package: ${specifier}`);
      }
    }
  }

  const mobileManifest = path.join(mobile, 'package.json');
  if (!isFile(mobileManifest)) errors.add('apps/mobile/package.json: required for iOS release dependency verification');
  else {
    visitPackage(mobileManifest);
    const main = resolveSource(path.join(mobile, manifest(mobileManifest).main ?? 'index.js'));
    if (!main) errors.add('apps/mobile: iOS entry point is missing'); else visitSource(main);
  }
  for (const file of productionSourceFiles(mobile)) visitSource(file);
  return { errors: [...errors], sourceCount: visited.size, packageCount: packages.size };
}

export function checkIosBundle(bundle: Buffer): string[] {
  const errors: string[] = [];
  if (!bundle.includes(Buffer.from('HealthLoopHealth'))) errors.push('Real native adapter missing from iOS bundle.');
  for (const forbidden of ['SyntheticHealthProvider', 'synthetic-demo-v1', 'synthetic_demo', 'createSyntheticProvider', 'WalletConnect', 'ReownAppKit', 'RNGoogleMobileAds', 'RNPurchases', 'RNIap']) {
    if (bundle.includes(Buffer.from(forbidden))) errors.push(`Excluded native provider/fixture found in iOS bundle: ${forbidden}`);
  }
  return errors;
}
