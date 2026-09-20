import type { ConsentInput, ConsentState, CoreClient } from '@healthloop/api-client';

export const CONSENT_VERSION = '2026-09-18' as const;
export const DEFAULT_CONSENT: ConsentInput = { adultConfirmed: true, localRead: false, cloudSync: false, marketing: false, version: CONSENT_VERSION };
type Profile = NonNullable<ConsentState['profile']>;
type Field = 'localRead' | 'cloudSync' | 'marketing';
type Withdrawals = Record<Field, boolean>;
const none = (): Withdrawals => ({ localRead: false, cloudSync: false, marketing: false });
export type ConnectionState = 'signed_out' | 'verifying' | 'online' | 'offline' | 'blocked';
export interface ConsentSnapshot {
  accountId: string | null; connection: ConnectionState; draft: ConsentInput;
  onboarded: boolean; localAllowed: boolean; cloudAllowed: boolean; errorCode: string | null;
}
interface Storage { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void>; removeItem(key: string): Promise<void> }
interface Dependencies { api: Pick<CoreClient, 'getConsents' | 'setConsents'>; storage: Storage; now?: () => Date }
export const confirmedConsentKey = (id: string) => `confirmed-consent.v1.${id}`;
export const withdrawalKey = (id: string) => `consent-withdrawals.v1.${id}`;
export const consentErrorCode = (error: unknown): string => error && typeof error === 'object' && 'code' in error ? String(error.code) : 'LOCAL_STATE_ERROR';
const transportFailure = (code: string) => code === 'NETWORK_ERROR' || code === 'TIMEOUT';
const validProfile = (profile: unknown, id: string): profile is Profile => {
  if (!profile || typeof profile !== 'object') return false;
  const p = profile as Partial<Profile>;
  return p.id === id && p.status === 'active' && p.adultConfirmed === true && p.consentVersion === CONSENT_VERSION
    && typeof p.localRead === 'boolean' && typeof p.cloudSync === 'boolean' && typeof p.marketing === 'boolean';
};
const choices = (profile: Profile, withdrawn: Withdrawals): ConsentInput => ({ ...DEFAULT_CONSENT,
  localRead: profile.localRead && !withdrawn.localRead, cloudSync: profile.cloudSync && !withdrawn.cloudSync, marketing: profile.marketing && !withdrawn.marketing,
});

/** Live app consent authority. Drafts restrict access immediately but never grant it. */
export class ConsentController {
  private state: ConsentSnapshot = { accountId: null, connection: 'signed_out', draft: { ...DEFAULT_CONSENT }, onboarded: false, localAllowed: false, cloudAllowed: false, errorCode: null };
  private confirmed: Profile | null = null;
  private withdrawn = none();
  private generation = 0;
  private draftRevision = 0;
  private pending = new Set<AbortController>();
  private listeners = new Set<() => void>();
  constructor(private readonly deps: Dependencies) {}
  readonly getSnapshot = () => this.state;
  readonly subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(change: Partial<ConsentSnapshot> = {}) {
    const state = { ...this.state, ...change };
    const usable = state.connection !== 'blocked' && state.connection !== 'signed_out' && this.confirmed !== null;
    state.onboarded = usable;
    state.localAllowed = usable && this.confirmed!.localRead && !this.withdrawn.localRead;
    state.cloudAllowed = state.localAllowed && state.connection === 'online' && this.confirmed!.cloudSync && !this.withdrawn.cloudSync;
    this.state = state;
    for (const listener of this.listeners) listener();
  }
  private cancel() { this.generation += 1; for (const request of this.pending) request.abort(); this.pending.clear(); }
  setAccount(id: string | null) {
    this.cancel(); this.confirmed = null; this.withdrawn = none(); this.draftRevision += 1;
    this.publish({ accountId: id, connection: id ? 'verifying' : 'signed_out', draft: { ...DEFAULT_CONSENT }, errorCode: null });
  }
  private current(id: string, generation: number) { return this.state.accountId === id && this.generation === generation; }
  async start(id: string) {
    this.setAccount(id); const generation = this.generation;
    try {
      const [recordText, withdrawnText, legacyText] = await Promise.all([
        this.deps.storage.getItem(confirmedConsentKey(id)), this.deps.storage.getItem(withdrawalKey(id)), this.deps.storage.getItem(`consent.${id}`),
      ]);
      if (!this.current(id, generation)) return;
      if (recordText) {
        const record = JSON.parse(recordText) as { schema?: unknown; accountId?: unknown; confirmedAt?: unknown; profile?: unknown };
        if (record.schema === 1 && record.accountId === id && typeof record.confirmedAt === 'string' && Number.isFinite(Date.parse(record.confirmedAt)) && validProfile(record.profile, id)) this.confirmed = record.profile;
      }
      if (withdrawnText) {
        const record = JSON.parse(withdrawnText) as { localRead?: unknown; cloudSync?: unknown; marketing?: unknown };
        if (typeof record.localRead !== 'boolean' || typeof record.cloudSync !== 'boolean' || typeof record.marketing !== 'boolean') throw new Error('INVALID_WITHDRAWAL_RECORD');
        this.withdrawn = { localRead: record.localRead, cloudSync: record.cloudSync, marketing: record.marketing };
      } else if (legacyText) {
        // Earlier builds stored drafts. Only their withdrawals count, never their grants.
        const record = JSON.parse(legacyText) as Partial<ConsentInput>;
        if (typeof record.localRead !== 'boolean' || typeof record.cloudSync !== 'boolean' || typeof record.marketing !== 'boolean') throw new Error('INVALID_LEGACY_RECORD');
        this.withdrawn = { localRead: record.localRead === false, cloudSync: record.cloudSync === false, marketing: record.marketing === false };
      }
      this.publish({ draft: this.confirmed ? choices(this.confirmed, this.withdrawn) : { ...DEFAULT_CONSENT } });
    } catch {
      if (!this.current(id, generation)) return;
      this.confirmed = null; this.publish({ connection: 'blocked', errorCode: 'LOCAL_STATE_ERROR' }); return;
    }
    await this.reconnect();
  }
  /** A new connection never reuses a previous connection's cloud authorization. */
  async reconnect() {
    const id = this.state.accountId; if (!id) return;
    this.cancel(); const generation = this.generation;
    this.publish({ connection: 'verifying', errorCode: null });
    const request = new AbortController(); this.pending.add(request);
    try {
      const result = await this.deps.api.getConsents(request.signal);
      if (!this.current(id, generation)) return;
      if (result.profile === null) {
        this.confirmed = null; await this.deps.storage.removeItem(confirmedConsentKey(id));
        if (this.current(id, generation)) this.publish({ connection: 'online', draft: { ...DEFAULT_CONSENT } }); return;
      }
      if (!validProfile(result.profile, id)) throw Object.assign(new Error('INVALID_RESPONSE'), { code: 'INVALID_RESPONSE' });
      await this.persistConfirmation(id, result.profile);
      if (!this.current(id, generation)) return;
      this.confirmed = result.profile;
      this.publish({ connection: 'online', draft: choices(result.profile, this.withdrawn), errorCode: null });
    } catch (error) {
      if (this.current(id, generation)) {
        const code = consentErrorCode(error);
        // Classify before awaiting: a late cleanup must never inspect or block a new account.
        if (transportFailure(code)) await this.handleFailure(error);
        else await this.block(code);
      }
    } finally { this.pending.delete(request); }
  }
  async change(field: Field, value: boolean) {
    const id = this.state.accountId; if (!id) return;
    this.draftRevision += 1;
    if (!value) this.withdrawn = { ...this.withdrawn, [field]: true };
    this.publish({ draft: { ...this.state.draft, [field]: value } });
    if (!value) await this.deps.storage.setItem(withdrawalKey(id), JSON.stringify(this.withdrawn));
  }
  async save(adultConfirmed: boolean) {
    const id = this.state.accountId;
    if (!id || !adultConfirmed) throw Object.assign(new Error('ADULT_REQUIRED'), { code: 'ADULT_REQUIRED' });
    const generation = this.generation; const revision = this.draftRevision; const input = { ...this.state.draft };
    const request = new AbortController(); this.pending.add(request);
    try {
      const result = await this.deps.api.setConsents(input, request.signal);
      if (!this.current(id, generation) || revision !== this.draftRevision) return false;
      if (!validProfile(result.profile, id) || result.profile.localRead !== input.localRead || result.profile.cloudSync !== input.cloudSync || result.profile.marketing !== input.marketing) throw Object.assign(new Error('INVALID_RESPONSE'), { code: 'INVALID_RESPONSE' });
      await this.persistConfirmation(id, result.profile);
      if (!this.current(id, generation) || revision !== this.draftRevision) return false;
      // Storage serializes this key. A later withdrawal is ordered after this write.
      await this.deps.storage.setItem(withdrawalKey(id), JSON.stringify(none()));
      if (!this.current(id, generation) || revision !== this.draftRevision) return false;
      this.confirmed = result.profile; this.withdrawn = none();
      this.publish({ connection: 'online', draft: choices(result.profile, this.withdrawn), errorCode: null }); return true;
    } catch (error) { if (this.current(id, generation)) await this.handleFailure(error); throw error; }
    finally { this.pending.delete(request); }
  }
  private persistConfirmation(id: string, profile: Profile) {
    return this.deps.storage.setItem(confirmedConsentKey(id), JSON.stringify({ schema: 1, accountId: id, confirmedAt: (this.deps.now?.() ?? new Date()).toISOString(), profile }));
  }
  private async block(code: string) {
    const id = this.state.accountId; this.cancel(); this.confirmed = null;
    this.publish({ connection: 'blocked', errorCode: code });
    if (id) await this.deps.storage.removeItem(confirmedConsentKey(id));
  }
  async handleFailure(error: unknown) {
    if (!this.state.accountId) return;
    const code = consentErrorCode(error);
    if (transportFailure(code)) { this.cancel(); this.publish({ connection: 'offline', errorCode: code }); return; }
    const status = error && typeof error === 'object' && 'status' in error ? Number(error.status) : 0;
    if (['UNAUTHENTICATED', 'SESSION_UNAVAILABLE', 'FORBIDDEN', 'ACCOUNT_INACTIVE', 'ACCOUNT_DELETED', 'INVALID_RESPONSE', 'LOCAL_STATE_ERROR'].includes(code) || status === 401 || status === 403) await this.block(code);
  }
}
