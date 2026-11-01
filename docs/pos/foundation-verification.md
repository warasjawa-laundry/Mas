# POS foundation verification

This is a foundation change, not an operational POS release. No order/payment/cashier UI or POS write RPC is enabled.

## Tests and review

- Clean baseline: 151 Node tests passed.
- Final local Node suite: 189 passed, zero failed.
- TypeScript and Next.js 16.4.2 production build passed.
- Local Playwright regression suite: 78 passed. This uses fixtures/unauthenticated local pages, not production writes or physical Android hardware.
- Clean QA: all 17 canonical legacy migrations replayed; all 46 function definition hashes match the captured production baseline.
- Eight repository SQL regressions passed with rollback/read-only wrapping on the clean QA. Customer rows remained empty afterward. Existing schema seeds are synthetic migration defaults, not copies of customer records.
- Actual active QA and operational legacy-anon/modern publishable key formats: four positive wrapper validations passed without logging keys. Production cases include VERCEL=1/CI=1 build metadata.
- Final production read-only point reconciliation: 18 active cards, all balances match legacy amount events after excluding VOID reversals.
- Independent money review found unknown monetary fields could be silently dropped; a misspelled fee now rejects. Regression tests failed before correction and pass afterward.
- Independent broad review found Vercel CI build metadata could be mistaken for a test runner; this was fixed and independently re-reviewed. Preview, GitHub Actions and explicit test-runner rejection remain enforced. No unresolved load-bearing code findings in the reviewed scope.

## Recorded red/green behavior

1. Preview bypass red: seven new guard cases failed because the old guard allowed operational single mode/unreviewed branches/configuration. New boundary now denies them.
2. QA card/realtime red: six of ten extension tests exposed inherited operational key use, missing origin readiness, main-alias fallback and credentials emitted before guard. QA has a dedicated key/origin boundary and realtime validates first.
3. Money red: missing contract assertions failed; utility then passed 13 tests. Exact-key review regressions produced three further failures before correction; now all 16 money tests pass.
4. Vercel build red: valid pinned production credentials with VERCEL=1/CI=1 were rejected, and an explicit runner without CI was not rejected; dedicated build-vs-runner tests now pass.

## Release blockers

- Existing Vercel project is linked to the wrong repository. Branch-scoped QA env creation failed and has not been replaced with a global overwrite. Protected Preview has not been deployed or verified. See environments.md for evidence and recovery steps.
- No observed canonical alias for the new QA deployment exists yet. QA card issuance fails closed without it. Add only the actual alias to the scanner allowlist before QR UAT.
- Synthetic authenticated owner/cashier UAT, physical camera/Android, restore rehearsal, and financial concurrency contracts have not been verified for POS.
- Full G2 legacy actor FK design and G3–G8 implementation remain pending. No production migration, merge or cutover should be inferred from these foundation test results.
