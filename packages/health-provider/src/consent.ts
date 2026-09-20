export class UploadCancelledError extends Error {
  readonly code = 'CONSENT_UPLOAD_CANCELLED';
  constructor() { super('Upload stopped because consent or account context changed'); this.name = 'UploadCancelledError'; }
}
interface QueuedOperation { run: (signal: AbortSignal) => Promise<void>; cancel: () => void }
/**
 * Starts uploads serially. Disabling consent clears queued work and aborts in-flight transport.
 * Aborting cannot retract bytes already received: the server must also check current cloud consent.
 * Call cancelAll on logout/account switch; do not persist raw-health upload queues.
 */
export class ConsentUploadCoordinator {
  private enabled = false;
  private running = false;
  private generation = 0;
  private controller: AbortController | null = null;
  private queue: QueuedOperation[] = [];
  setConsent(enabled: boolean): void {
    if (!enabled) this.cancelAll();
    this.enabled = enabled;
  }
  cancelAll(): void {
    this.enabled = false;
    this.generation += 1;
    this.controller?.abort();
    for (const operation of this.queue.splice(0)) operation.cancel();
  }
  enqueue<T>(operation: (signal: AbortSignal) => Promise<T>): Promise<T> {
    if (!this.enabled) return Promise.reject(new UploadCancelledError());
    const generation = this.generation;
    return new Promise<T>((resolve, reject) => {
      let settled = false;
      const cancel = () => { if (!settled) { settled = true; reject(new UploadCancelledError()); } };
      this.queue.push({
        cancel,
        run: async (signal) => {
          if (!this.enabled || generation !== this.generation || signal.aborted) { cancel(); return; }
          let rejectAbort: (reason: UploadCancelledError) => void = () => {};
          const aborted = new Promise<never>((_resolve, rejectAborted) => { rejectAbort = rejectAborted; });
          const onAbort = () => { cancel(); rejectAbort(new UploadCancelledError()); };
          signal.addEventListener('abort', onAbort, { once: true });
          try {
            const result = await Promise.race([operation(signal), aborted]);
            if (signal.aborted || generation !== this.generation || !this.enabled) cancel();
            else if (!settled) { settled = true; resolve(result); }
          } catch (error) { if (!settled) { settled = true; reject(error); } }
          finally { signal.removeEventListener('abort', onAbort); }
        },
      });
      void this.drain();
    });
  }
  private async drain(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      while (this.enabled && this.queue.length) {
        const operation = this.queue.shift();
        if (!operation) continue;
        this.controller = new AbortController();
        await operation.run(this.controller.signal);
        this.controller = null;
      }
    } finally { this.running = false; }
  }
}
