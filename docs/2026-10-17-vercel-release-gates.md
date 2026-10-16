# Mas Jawa Laundry — Controlled Vercel Releases

Status: ENFORCED on integration branch (not merged to main). Date: 2026-10-17.

## Why
During Stage 1–9, every pushed commit could trigger an automatic Vercel build, quickly exhausting the Hobby daily deployment capacity. GitHub Actions currently performs tests and builds but does NOT deploy to Vercel.

## GitHub-owned control
The root vercel.json keeps Next.js as the framework and sets git.deploymentEnabled to false. This disables automatic Git-triggered deployments for branches containing this config, while still permitting intentional manual deployments.
A test (tests/vercel-deployment-policy.test.mjs) fails if the policy is removed, and checks that the integration CI does not contain a Vercel deploy step.

## Controlled release workflow
1. Develop and push on integration/mas-jawa-laundry. Run all GitHub CI gates; no automatic Vercel deployment.
2. Iterate on GitHub only until unit tests, TypeScript, Next.js build, and browser tests succeed.
3. Freeze an exact tested commit SHA and audit needed environment variables and Supabase migrations.
4. On explicit owner request, issue one manually initiated Vercel Preview deployment using the frozen SHA. Confirm READY and test on Android using an owner-approved test member; do not modify Kiki.
5. Merge to main or deploy/promote production only after separate explicit owner approval. Never move masjawalaundry.web.id as a side effect of Preview work.

## Important scope
- This GitHub branch policy is not a team-wide switch. Historical stage branches without the setting may still auto-deploy if pushed; do not push them.
- If merged into main, automatic production Git deployments will also be disabled. This requires a manual release step after approval.
- Project-level configuration, Git integrations, and deploy hooks can bypass the ordinary Git push policy and need independent checks.
- The existing main, Vercel production deployment, custom domain, and Supabase customer data remain untouched.
