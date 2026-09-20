/** In-flight completions must carry the same generation and account as their start. */
export class ConsentGate {
  private generation = 0;
  private controllers = new Set<AbortController>();
  private account: string | null = null;
  private localRead = false;
  private cloudSync = false;
  configure(account: string | null, localRead: boolean, cloudSync: boolean) {
    if (account !== this.account || localRead !== this.localRead || cloudSync !== this.cloudSync) this.cancel();
    this.account = account; this.localRead = localRead; this.cloudSync = cloudSync;
  }
  cancel() { this.generation += 1; for (const controller of this.controllers) controller.abort(); this.controllers.clear(); }
  begin(upload = false) {
    if (!this.account || !this.localRead || (upload && !this.cloudSync)) throw Object.assign(new Error('CONSENT_REQUIRED'), { code: 'CONSENT_REQUIRED' });
    const generation = this.generation; const account = this.account; const controller = new AbortController();
    this.controllers.add(controller);
    return { signal: controller.signal, isCurrent: () => generation === this.generation && account === this.account && !controller.signal.aborted, finish: () => this.controllers.delete(controller) };
  }
}
