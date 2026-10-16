# Mas Jawa Laundry — Review on unyil, Production on ristkyx

**Approved workflow:** The owner confirmed that `unyilhm1@gmail.com` Vercel project `mas` is the **review/testing environment** until the application is stable. The final live release continues on `ristkyx@gmail.com` Vercel project `masjawalaundry` only after review, explicit approval, and merge of PR #8 to `main`.

## Environment ownership

| Purpose | Vercel account/team | Vercel project | Source branch | Domain |
|---|---|---|---|---|
| Temporary review | `unyilhm1@gmail.com` / `m8traders' projects` | `mas` (`prj_XaFKO8opffvnhL9c0oE3GrGPt3H2`) | Frozen validated commit from `warasjawa-laundry/Mas` branch `integration/mas-jawa-laundry` | Isolated `*.vercel.app` URL only |
| Official production | `ristkyx@gmail.com` / `ombotak-property-s-projects` | `masjawalaundry` (`prj_o49NSdSAHCoNZFkJvn1IliqqjcdH`) | Merged `main` after explicit approval | `masjawalaundry.web.id` |

Both Vercel project names may represent Vercel target `production` internally: a `production` deployment *inside the `mas` review project* is NOT an authorization to change the official production project or custom domain.

## Current setup and incomplete wiring

- Primary, authoritative GitHub repository: `warasjawa-laundry/Mas`. Draft PR #8 contains integration stages 1–9. Do not merge yet.
- The Vercel project `mas` currently deployed the starter repo `unyilhm1-hue/mas` (GitHub `main` commit `c414ccef...`, Vercel deployment `dpl_8pE4FrGbVYeYdzSNfnzNzEWz5bC5`). Its `READY` status does NOT certify Mas Jawa Laundry functionality.
- The review project's Git repository is NOT yet synchronized to the canonical Stage 9 integration commit. Connecting that source, or setting up an explicit manual release mechanism, must precede functional review.
- Existing project `masjawalaundry` in Vercel unyil (`prj_EEVtaSIxW2HKzah2ZbqMxcBUmBz4`) is a separate unused project; do not confuse it with the approved review project `mas`.

## Required gates for review

1. Complete changes on `integration/mas-jawa-laundry`; GitHub CI is authoritative for tests, typecheck, build, browser tests.
2. Freeze an exact green commit SHA and explicitly choose a safe way of deploying that source to Vercel `unyilhm1/mas`. If a mirror is used, it must reflect the frozen integration SHA, not `main` or the blank starter; never mirror .env or credentials.
3. Prevent automatic Git-triggered deployments on review pushes; the canonical `vercel.json` uses `git.deploymentEnabled: false` and has a regression test. Use one intentional deployment after green CI and owner approval.
4. Configure the review project's own environment variables separately. Prefer a dedicated QA Supabase project/database; if review ever uses the production Supabase project, use specifically approved test members only, avoid modifying Kiki, and require owner login on writes.
5. Verify the deployed SHA, READY, member QR, registration, nominal transactions, points and reversal, owner permissions, customer privacy, mobile browser UAT and no server runtime errors.
6. Iterate only on the source branch until owner accepts review. Do not move production domain, change DNS, promote or merge early.

## Final live release

After explicit owner approval: update/merge reviewed PR into `main`; validate the merged commit with CI; perform a separately approved manual deployment to **ristkyx/masjawalaundry** using that exact merged SHA. Verify Supabase migrations, production environment variables, domain routing and smoke tests. Git auto-deploy is disabled by `vercel.json`, so merging alone does not deploy live.

## Safety boundary

Under no circumstance should a successful build in `unyilhm1/mas` automatically promote to official production. No project or repository sync, deployment, database test on real members, merge, or DNS change should be assumed complete merely because this runbook exists.
