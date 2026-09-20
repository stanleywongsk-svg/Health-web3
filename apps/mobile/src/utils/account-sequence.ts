/** Account checks bracket every asynchronous stage; stale work cannot start its next stage. */
export async function runAccountSequence(steps: readonly (() => Promise<unknown>)[], isCurrent: () => boolean): Promise<void> {
  const assertCurrent = () => { if (!isCurrent()) throw Object.assign(new Error('CANCELLED'), { code: 'CANCELLED' }); };
  for (const step of steps) { assertCurrent(); await step(); assertCurrent(); }
}
