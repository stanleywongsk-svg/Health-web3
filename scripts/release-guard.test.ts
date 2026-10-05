import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { checkIosBundle, checkIosReleaseGraph, prohibitedIosPackage } from './release-guard.ts';

const directories: string[] = [];
afterEach(() => { for (const directory of directories.splice(0)) fs.rmSync(directory, { recursive: true, force: true }); });
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'healthloop-release-guard-')); directories.push(root);
  const write = (file: string, content: string | object) => {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), typeof content === 'string' ? content : JSON.stringify(content));
  };
  write('apps/mobile/package.json', { name: '@healthloop/mobile', main: 'index.js', dependencies: { '@healthloop/domain': 'workspace:*' } });
  write('apps/mobile/index.js', 'export * from "@healthloop/domain";');
  write('packages/domain/package.json', { name: '@healthloop/domain', exports: { '.': './src/index.ts', './synthetic': './src/synthetic.ts' } });
  write('packages/domain/src/index.ts', 'export const points = 10;');
  write('packages/domain/src/synthetic.ts', 'export const fixture = true;');
  return { root, write, check: () => checkIosReleaseGraph(root) };
}

describe('iOS release dependency boundaries', () => {
  it('allows expo-crypto, ordinary demo/history types and explanatory wallet/NFT copy', () => {
    const { write, check } = fixture();
    write('packages/domain/src/index.ts', 'import { randomUUID } from "expo-crypto"; export const message = "不支持钱包、NFT 和代币奖励"; export type History = { demoRefund: boolean }; export const id = randomUUID();');
    write('packages/domain/src/index.test.ts', 'import "viem";');
    const result = check(); expect(result.errors).toEqual([]); expect(result.sourceCount).toBe(2);
  });
  it.each(['viem', 'ethers', '@walletconnect/sign-client', '@reown/appkit', '@solana/web3.js', 'react-native-google-mobile-ads', 'react-native-iap', 'react-native-purchases', '@stripe/stripe-react-native'])('rejects SDK %s from a transitive workspace default export', sdk => {
    const { write, check } = fixture();
    write('packages/domain/src/index.ts', 'export * from "./neutral.js";');
    write('packages/domain/src/neutral.ts', `export * from ${JSON.stringify(sdk)};`);
    expect(check().errors).toContain(`packages/domain/src/neutral.ts: SDK import excluded by iOS release policy: ${sdk}`);
  });
  it.each(['import("viem")', 'require("viem")', 'import(`viem`)', 'import wallet = require("viem")'])('detects literal loader form %s', statement => {
    const { write, check } = fixture(); write('packages/domain/src/index.ts', statement);
    expect(check().errors.some(error => error.includes('SDK import excluded'))).toBe(true);
  });
  it.each(['import(selectedProvider)', 'require(selectedProvider)', 'import(`./${provider}`)'])('rejects unverifiable computed loader %s', statement => {
    const { write, check } = fixture(); write('packages/domain/src/index.ts', statement);
    expect(check().errors.some(error => error.includes('computed import/require'))).toBe(true);
  });
  it('traverses API workspace dependency declarations even when no SDK is imported', () => {
    const { write, check } = fixture();
    write('packages/domain/package.json', { name: '@healthloop/domain', exports: './src/index.ts', dependencies: { '@healthloop/api-client': 'workspace:*' } });
    write('packages/api-client/package.json', { name: '@healthloop/api-client', exports: './src/index.ts', dependencies: { 'neutral-name': 'npm:viem@1.0.0' } });
    expect(check().errors.some(error => error.includes('neutral-name (viem)'))).toBe(true);
  });
  it('traverses installed transitive production dependency manifests', () => {
    const { write, check } = fixture();
    write('packages/domain/package.json', { name: '@healthloop/domain', exports: './src/index.ts', dependencies: { 'neutral-sdk': '1.0.0' } });
    write('node_modules/neutral-sdk/package.json', { name: 'neutral-sdk', dependencies: { 'react-native-google-mobile-ads': '1.0.0' } });
    expect(check().errors.some(error => error.includes('SDK dependency excluded by iOS release policy: react-native-google-mobile-ads'))).toBe(true);
  });
  it('excludes isolated workspace dependencies and source paths under neutral aliases', () => {
    const { write, check } = fixture();
    write('packages/domain/package.json', { name: '@healthloop/domain', exports: './src/index.ts', dependencies: { '@healthloop/neutral': 'workspace:*' } });
    write('lab/backend/package.json', { name: '@healthloop/neutral', exports: './index.ts' });
    write('lab/backend/index.ts', 'export const secret = true;');
    write('packages/domain/src/index.ts', 'export * from "../../../lab/backend/index.ts";');
    expect(check().errors.some(error => error.includes('isolated Lab/fixture dependency'))).toBe(true);
    expect(check().errors.some(error => error.includes('isolated Lab/fixture source'))).toBe(true);
  });
  it('rejects transitive synthetic exports and test imports, but does not visit unused synthetic exports', () => {
    const { write, check } = fixture(); expect(check().errors).toEqual([]);
    write('packages/domain/src/index.ts', 'export * from "./synthetic.ts"; export * from "./rules.test.ts";');
    write('packages/domain/src/rules.test.ts', 'export const secret = true;');
    expect(check().errors.filter(error => error.includes('isolated Lab/fixture source'))).toHaveLength(2);
  });
  it('resolves iOS-specific modules and tsconfig path aliases', () => {
    const { write, check } = fixture();
    write('apps/mobile/tsconfig.json', { compilerOptions: { baseUrl: '.', paths: { '@shared/*': ['../../packages/domain/src/*'] } } });
    write('apps/mobile/index.js', 'import "@shared/provider";');
    write('packages/domain/src/provider.ts', 'export const allowed = true;');
    write('packages/domain/src/provider.ios.ts', 'import "viem";');
    expect(check().errors).toContain('packages/domain/src/provider.ios.ts: SDK import excluded by iOS release policy: viem');
  });
  it('checks native conditional workspace exports', () => {
    const { write, check } = fixture();
    write('packages/domain/package.json', { name: '@healthloop/domain', exports: { '.': { 'react-native': './src/native.ts', default: './src/index.ts' } } });
    write('packages/domain/src/native.ts', 'import "ethers";');
    expect(check().errors.some(error => error.includes('SDK import excluded by iOS release policy: ethers'))).toBe(true);
  });
  it('handles source and workspace dependency cycles without hiding a prohibited import', () => {
    const { write, check } = fixture();
    write('packages/domain/package.json', { name: '@healthloop/domain', exports: './src/index.ts', dependencies: { '@healthloop/domain': 'workspace:*' } });
    write('packages/domain/src/index.ts', 'export * from "./cycle.ts";');
    write('packages/domain/src/cycle.ts', 'export * from "./index.ts"; import "siwe";');
    const result = check(); expect(result.sourceCount).toBe(3); expect(result.errors.some(error => error.includes('siwe'))).toBe(true);
  });
  it('fails closed on missing workspace exports, local imports and declared workspace dependencies', () => {
    const { write, check } = fixture();
    write('apps/mobile/index.js', 'import "@healthloop/domain/missing"; import "./missing";');
    write('packages/domain/package.json', { name: '@healthloop/domain', exports: './src/index.ts', dependencies: { '@healthloop/missing': 'workspace:*' } });
    const errors = check().errors.join('\n');
    expect(errors).toContain('unresolved workspace export'); expect(errors).toContain('unresolved local import'); expect(errors).toContain('unresolved workspace dependency');
  });
  it('ignores devDependencies and unrelated independent Lab packages', () => {
    const { write, check } = fixture();
    write('lab/backend/package.json', { name: '@healthloop/lab', dependencies: { viem: '1.0.0' } });
    write('apps/mobile/package.json', { name: '@healthloop/mobile', main: 'index.js', devDependencies: { viem: '1.0.0' } });
    expect(check().errors).toEqual([]);
  });
  it('does not confuse general cryptography with blockchain SDKs', () => {
    for (const name of ['expo-crypto', 'node:crypto', '@noble/hashes', '@supabase/supabase-js', 'react-native', 'zod']) expect(prohibitedIosPackage(name)).toBe(false);
  });
});

describe('exported iOS bundle checks', () => {
  it('requires the real native module and allows explanatory copy', () => {
    expect(checkIosBundle(Buffer.from('HealthLoopHealth NFT wallet crypto demo history expo-crypto'))).toEqual([]);
    expect(checkIosBundle(Buffer.from('app without native adapter'))).toContain('Real native adapter missing from iOS bundle.');
  });
  it.each(['SyntheticHealthProvider', 'synthetic-demo-v1', 'synthetic_demo', 'createSyntheticProvider', 'WalletConnect', 'ReownAppKit', 'RNGoogleMobileAds', 'RNPurchases', 'RNIap'])('rejects %s', marker => {
    expect(checkIosBundle(Buffer.from(`HealthLoopHealth ${marker}`))).toContain(`Excluded native provider/fixture found in iOS bundle: ${marker}`);
  });
});
