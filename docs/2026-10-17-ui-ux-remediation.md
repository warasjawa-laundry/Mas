# Homepage and admin UX remediation

The desktop audit found repeated homepage information, competing customer/admin entry points, an oversized dashboard scan shortcut, stale checklist instructions, and inconsistent navigation.

## Resulting behavior

- Homepage leads with the actual service, pricing, usage steps, member access, and one location/contact block. Existing public anchors remain supported. Unverified tariffs and hours retain clear confirmation notices; business values are unchanged.
- Membership keeps the requested scanner and admin entry near the top, with the admin link visually secondary. Camera/gallery controls precede the preview in DOM and visual order.
- Dashboard starts with a member search and a scan alternative. Existing small count queries remain unchanged and totals explicitly cover all periods.
- Dashboard and list share Next Form GET navigation so searching inside admin does not trigger the fresh-document login policy. Refresh and public-to-admin entry still require authentication.
- Navigation owns the brand and logout controls. Mobile now has an explicit logout control. Contextual member back links remain available.
- Member list emphasizes transaction entry. Secondary actions stay in member detail. The member summary is compact, transaction fields come first, history is initially expanded, and successful registration/card viewing has a direct transaction link.
- Existing point rules, transaction validation, idempotency, cancellation audit history, QR processing, permissions, and database schemas are unchanged.

## Validation

- 108 Node tests passed after updating text/layout expectations.
- TypeScript and production build passed.
- Browser/CI verification is performed on the resulting Preview deployment; camera permissions and actual transaction writes are not required for this visual review.
- Physical Android camera testing and business verification of legacy photos, tariffs, and hours remain separate acceptance checks.

## Deployment scope

Update the existing PR #12 Preview candidate. No merge, production release, DNS change, or provider account-setting change is part of this UI task.
