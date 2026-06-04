interface Account {
  key: string;
  /** Estimated spend on this account, in USD. */
  used: number;
  /** Soft credit ceiling, in USD. */
  limit: number;
  healthy: boolean;
}

/**
 * Load balancer across multiple API keys. Strategy: deplete-first (use one key
 * until it nears its limit, then move to the next).
 */
export class AccountPool {
  private accounts: Account[];

  constructor() {
    // Accept a comma-separated GC_KEYS and/or numbered GC_KEY_1..20.
    const fromList = (process.env.GC_KEYS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const numbered: string[] = [];
    for (let i = 1; i <= 20; i++) {
      const k = process.env[`GC_KEY_${i}`];
      if (k && k.trim()) numbered.push(k.trim());
    }
    const keys = Array.from(new Set([...fromList, ...numbered]));

    const limit = Number(process.env.GC_ACCOUNT_LIMIT_USD ?? "100");
    this.accounts = keys.map((key) => ({ key, used: 0, limit, healthy: true }));
  }

  get size() {
    return this.accounts.length;
  }

  /** First healthy key that is under 95% of its limit. */
  getActiveKey(): string {
    const active = this.accounts.find(
      (a) => a.healthy && a.used < a.limit * 0.95,
    );
    if (!active) {
      throw new Error(
        this.size === 0
          ? "AI account pool is empty: set GC_KEY_1"
          : "AI account pool depleted: no healthy key under its limit",
      );
    }
    return active.key;
  }

  recordUsage(key: string, costUsd: number) {
    const account = this.accounts.find((a) => a.key === key);
    if (account) account.used += costUsd;
  }

  markUnhealthy(key: string) {
    const account = this.accounts.find((a) => a.key === key);
    if (account) account.healthy = false;
  }
}
