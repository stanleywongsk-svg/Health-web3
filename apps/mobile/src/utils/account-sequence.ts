/** Account checks bracket every asynchronous stage; stale work cannot start its next stage. */
export async function runAccountSequence(steps: readonly (() => Promise<unknown>)[], isCurrent: () => boolean): Promise<void> {
  const assertCurrent = () => { if (!isCurrent()) throw Object.assign(new Error('CANCELLED'), { code: 'CANCELLED' }); };
  for (const step of steps) { assertCurrent(); await step(); assertCurrent(); }
}

/** Optional reminder cleanup cannot prevent authenticated account deletion. */
export async function runDeletionSequence(steps: {
  reauthenticate: () => Promise<unknown>;
  stopReminders: () => Promise<unknown>;
  withdrawLocal: () => Promise<unknown>;
  withdrawCloud: () => Promise<unknown>;
  deleteRemote: () => Promise<unknown>;
}, isCurrent: () => boolean): Promise<{ reminderStopFailed: boolean }> {
  let reminderStopFailed = false;
  await runAccountSequence([
    steps.reauthenticate,
    async () => { try { await steps.stopReminders(); } catch { reminderStopFailed = true; } },
    steps.withdrawLocal, steps.withdrawCloud, steps.deleteRemote,
  ], isCurrent);
  return { reminderStopFailed };
}
