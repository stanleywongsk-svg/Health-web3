import { describe, expect, it, vi } from 'vitest';
import { createCoreClient } from './index';
import { notificationPreferencesSchema, setNotificationPreferencesSchema } from '@healthloop/domain';

const baseUrl = 'http://127.0.0.1:54321/functions/v1/core';
const values = { enabled: false, reminderTime: '19:00', quietStart: '22:00', quietEnd: '08:00', timezone: 'Asia/Hong_Kong' as const };
const defaults = { ...values, revision: 0, updatedAt: null };
const updatedAt = '2026-09-20T01:00:00Z';
const response = (data: unknown) => Response.json({ data, requestId: 'preferences-test' });

describe('notification preference boundaries', () => {
  it('uses actual 24-hour times and a half-open overnight quiet interval', () => {
    for (const [reminderTime, allowed] of [['21:59', true], ['22:00', false], ['23:59', false], ['00:00', false], ['07:59', false], ['08:00', true]] as const) {
      expect(setNotificationPreferencesSchema.safeParse({ ...values, enabled: true, reminderTime, expectedRevision: 0 }).success, reminderTime).toBe(allowed);
    }
    for (const [reminderTime, allowed] of [['08:59', true], ['09:00', false], ['12:29', false], ['12:30', true], ['00:00', true], ['23:59', true]] as const) {
      expect(setNotificationPreferencesSchema.safeParse({ ...values, enabled: true, quietStart: '09:00', quietEnd: '12:30', reminderTime, expectedRevision: 0 }).success, reminderTime).toBe(allowed);
    }
  });
  it('allows disabling an existing time inside quiet hours but rejects zero-length quiet windows', () => {
    expect(setNotificationPreferencesSchema.parse({ ...values, reminderTime: '23:00', expectedRevision: 3 }).enabled).toBe(false);
    for (const enabled of [false, true]) expect(setNotificationPreferencesSchema.safeParse({ ...values, enabled, quietEnd: '22:00', expectedRevision: 0 }).success).toBe(false);
  });
  it('rejects malformed times, foreign timezones, invalid revisions and injected identities/data', () => {
    const client = createCoreClient({ baseUrl, accessToken: async () => 'test', fetch: vi.fn() });
    for (const invalid of ['24:00', '12:60', '9:00', '09:0', '09:00:00', ' 09:00', '09:00 ', 'NaN', '１２:００']) {
      for (const field of ['reminderTime', 'quietStart', 'quietEnd']) {
        expect(() => client.setNotificationPreferences({ ...values, expectedRevision: 0, [field]: invalid })).toThrow();
      }
    }
    for (const change of [
      { expectedRevision: -1 }, { expectedRevision: 0.5 }, { expectedRevision: 2_147_483_648 },
      { revision: 1 }, { updatedAt }, { userId: 'victim' }, { user_id: 'victim' }, { points: 100 },
      { eligibleSteps: 7000 }, { healthData: [] }, { pushToken: 'forbidden' }, { notificationBody: 'untrusted' },
    ]) expect(() => client.setNotificationPreferences({ ...values, expectedRevision: 0, ...change })).toThrow();
    expect(setNotificationPreferencesSchema.safeParse({ ...values, timezone: 'UTC', expectedRevision: 0 }).success).toBe(false);
    expect(setNotificationPreferencesSchema.safeParse({ ...values, enabled: 'true', expectedRevision: 0 }).success).toBe(false);
  });
  it('does not accept unpersisted enabled preferences or silently synthesize missing timestamps', () => {
    expect(notificationPreferencesSchema.parse(defaults)).toEqual(defaults);
    for (const invalid of [
      { ...defaults, enabled: true }, { ...defaults, quietEnd: '09:00' }, { ...defaults, updatedAt },
      { ...defaults, revision: 1 }, { ...defaults, revision: 1, updatedAt: 'yesterday' },
      { ...defaults, revision: 1, updatedAt, rawHealth: [] },
    ]) expect(notificationPreferencesSchema.safeParse(invalid).success).toBe(false);
  });
});

describe('authenticated notification preference transport', () => {
  it('reads only the canonical default and sends minimal explicit settings with revision control', async () => {
    const input = { ...values, enabled: true, expectedRevision: 0 };
    const saved = { ...values, enabled: true, revision: 1, updatedAt };
    const send = vi.fn().mockResolvedValueOnce(response(defaults)).mockResolvedValueOnce(response(saved));
    const client = createCoreClient({ baseUrl, accessToken: async () => 'test', fetch: send });
    expect(await client.getNotificationPreferences()).toEqual(defaults);
    expect(await client.setNotificationPreferences(input)).toEqual(saved);
    expect(send.mock.calls[0]?.[0]).toBe(`${baseUrl}/account/notification-preferences`);
    expect(send.mock.calls[0]?.[1]?.method).toBe('GET');
    expect(send.mock.calls[1]?.[1]).toMatchObject({ method: 'POST', body: JSON.stringify(input), credentials: 'omit', headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' } });
  });
  it('propagates revision conflicts once without overwriting newer account preferences', async () => {
    const send = vi.fn(async () => Response.json({ error: { code: 'PREFERENCES_CONFLICT', detail: 'another session data' } }, { status: 409, headers: { 'x-request-id': 'conflict' } }));
    const client = createCoreClient({ baseUrl, accessToken: async () => 'test', fetch: send });
    await expect(client.setNotificationPreferences({ ...values, expectedRevision: 0 })).rejects.toMatchObject({ code: 'PREFERENCES_CONFLICT', status: 409, requestId: 'conflict', message: 'PREFERENCES_CONFLICT' });
    expect(send).toHaveBeenCalledTimes(1);
  });
  it('replays only the original desired state/revision after a lost response and accepts equivalent current state', async () => {
    const input = { ...values, enabled: true, expectedRevision: 1 };
    const saved = { ...values, enabled: true, revision: 3, updatedAt };
    const send = vi.fn().mockRejectedValueOnce(new Error('response lost')).mockResolvedValueOnce(response(saved));
    const client = createCoreClient({ baseUrl, accessToken: async () => 'test', fetch: send });
    await expect(client.setNotificationPreferences(input)).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
    expect(send).toHaveBeenCalledTimes(1);
    expect(await client.setNotificationPreferences(input)).toEqual(saved);
    expect(send.mock.calls[0]?.[1]?.body).toBe(send.mock.calls[1]?.[1]?.body);
  });
  it('rejects a mismatched successful write receipt and malformed reads instead of enabling reminders', async () => {
    const client = createCoreClient({ baseUrl, accessToken: async () => 'test', fetch: async () => response({ ...values, enabled: true, revision: 1, updatedAt }) });
    await expect(client.setNotificationPreferences({ ...values, expectedRevision: 0 })).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    for (const invalid of [{ ...defaults, timezone: 'UTC' }, { ...defaults, userId: 'victim' }, { ...defaults, enabled: true }, {}]) {
      const invalidClient = createCoreClient({ baseUrl, accessToken: async () => 'test', fetch: async () => response(invalid) });
      await expect(invalidClient.getNotificationPreferences()).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    }
  });
  it('cancels queued reads and saves when the account is changed during token lookup', async () => {
    for (const operation of [
      (client: ReturnType<typeof createCoreClient>, signal: AbortSignal) => client.getNotificationPreferences(signal),
      (client: ReturnType<typeof createCoreClient>, signal: AbortSignal) => client.setNotificationPreferences({ ...values, enabled: true, expectedRevision: 0 }, signal),
    ]) {
      const abort = new AbortController(); let complete!: (token: string) => void;
      const token = new Promise<string>(resolve => { complete = resolve; }); const send = vi.fn();
      const client = createCoreClient({ baseUrl, accessToken: () => token, fetch: send });
      const rejected = expect(operation(client, abort.signal)).rejects.toMatchObject({ code: 'CANCELLED' });
      abort.abort(); await rejected; complete('old-account-token'); await Promise.resolve(); await Promise.resolve();
      expect(send).not.toHaveBeenCalled();
    }
  });
  it('keeps preferences in the personal export and rejects an export that loses their state', async () => {
    const data = { exportedAt: updatedAt, profile: {}, consentEvents: [], activitySummaries: [], activityRevisions: [], missions: [], ledger: [], appeals: [], appealAdjustments: [], redemptions: [], notificationPreferences: defaults };
    const client = createCoreClient({ baseUrl, accessToken: async () => 'test', fetch: async () => response(data) });
    expect((await client.exportAccount()).notificationPreferences).toEqual(defaults);
    const { notificationPreferences: _missing, ...incomplete } = data;
    const incompleteClient = createCoreClient({ baseUrl, accessToken: async () => 'test', fetch: async () => response(incomplete) });
    await expect(incompleteClient.exportAccount()).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });
});
