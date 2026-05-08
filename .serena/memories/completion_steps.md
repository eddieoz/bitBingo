# Task Completion Rules

When a task is completed, you should ensure:
1. New or modified code has not broken existing tests or functionality.
2. Run backend tests: `cd server && pnpm test`
3. Run frontend tests: `cd client && pnpm test`
4. Alternatively, use root command: `pnpm test`
5. No sensitive keys or data (like pinata JWT keys) are placed to the codebase or committed.
6. Assure any logic relating to Bitcoin blockchain validation remains uncompromised and fully deterministic.
7. Verify multi-provider Bitcoin API resilience: changes should not break the provider fallback chain (mempool → blockstream → blockchain_info), configurable via BITCOIN_API_ORDER.