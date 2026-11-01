# POS QA environment contract

## Enforced in this patch

All Preview branches require explicit QA mode, exact clean-QA origin/ref, and an active publishable/legacy-anon key whose digest is pinned to that project. Runtime environment values cannot authorize an unknown key. Both actual active QA formats and both production formats passed an uncommitted positive smoke; keys were not logged/committed.

Production retains the operational URL/key and original primary+legacy card-key decryption. Generic CI, GitHub Actions and explicit test runners reject operational DB configuration. Vercel sets CI=1 during legitimate production builds, so trusted VERCEL=1 + production metadata can validate operational configuration unless a test-runner marker is present. This is not network sandboxing; server environment metadata is trusted deployment configuration. Configured local DB access requires explicit mode; standalone no-DB public tests/builds remain available. Privileged keys, extra client credentials and direct Postgres env configuration are rejected at the application boundary.

Registry rotation requires a reviewed source change containing fingerprints only. A new valid provider key intentionally fails closed until registered. This is an application credential boundary, not a network-egress firewall or a restriction on a separately privileged database admin.

QA cards only use `LAUNDRY_CARD_ENCRYPTION_KEY_QA`; operational keys cannot be a fallback. Every QA issuance requires a configured clean owned-team stable Preview alias. Missing/retired/main aliases fail closed. The existing scanner continues to read legacy QR formats; the exact new QA alias must be added only after it is returned by an actual deployment.

The catalog realtime helper checks the same boundary before emitting a client URL/key. Readiness exposes only configured/blocked status and is Preview-only, no-store; it does not certify login/RPC/data access.

## Cloud work and current blocker

Preview-only Vercel Authentication protection was enabled (`ssoProtection.deploymentType=preview`). Production deployment/domain was not switched.

Prepared branch-specific QA overrides include QA URL/key/mode/ref, a separate random QA card key, empty operational/legacy card key overrides, synthetic owner identity, optional owner flags off, and POS writes disabled. **These variables have not been applied:** Vercel rejects the branch because the project's Git connection points at `unyilhm1-hue/mas`. No broad Preview or Production env variable was overwritten as a workaround.

MCP does not expose reconnecting an existing project's Git source. Its create-git-project tool would create/reuse a different repo-linked project, which violates the one-project constraint. Browser fallback is disabled by Work settings. Local Vercel CLI identifies another account and returned 403 reading this project; no CLI write was attempted.

Required external fix: existing Vercel `mas` -> Settings -> Git -> reconnect to `warasjawa-laundry/Mas`, preserving the project/team/domains and repository policy disabling automatic deploys. Then verify the link through the connector, apply branch-only QA overrides, create a protected Preview, use its observed branch alias for `QA_CARD_ORIGIN`/scanner allowlist, and provision a synthetic QA owner through the supported Auth admin workflow. Do not copy owner passwords or production encryption material.

Before G1 completion, prove Preview readiness, isolated read/write behavior with synthetic data, unavailable production credentials, card/QR round trip, and authenticated QA access. Foundation code may be reviewed as a draft while this gate is pending; it must not be promoted as a complete POS release.
