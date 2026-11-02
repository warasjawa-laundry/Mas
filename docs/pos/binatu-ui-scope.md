# Binatu admin UI scope, 2 November 2026

User approved implementation after reviewing the HTML-reference audit, then narrowed scope: rebuild all admin UI/UX using the supplied Binatu HTML, skip scan, promotion, points and price-setting UI for now, preserve their backend. This is an implementation authorization for the documented direction, not a new request to brainstorm alternatives.

Source: attached `Binatu POS _ Mas Jawa Laundry Paiton.html`, SHA256 606330386e88df158f4fcbe1da3b823a895079e88cac5593a71089dd8cb86b29. This branch starts from main a9376b7 (PR28), which includes POS backend beyond the earlier foundation checkpoint. Preserve those newer financial/session contracts.

Direction: Plus Jakarta Sans, yellow #F7B801, dark #22252A, white surfaces, gray #F3F4F6 canvas. Reuse supplied laundry motif and illustrations. Mobile has Pesanan/Menu bottom navigation, white curved header, status tabs and large bottom actions; desktop has outlet sidebar and content-appropriate split workspaces. ENERGY 2 / RHYTHM 2 / MOTION 1. Yellow marks primary actions/active navigation; laundry pattern carries identity; no generic glyph art or demo toolbar.

Keep actual sessions, owner/cashier authorization, queries/RPCs, form payloads, request IDs, payment safeguards and write locks unchanged. Do not create fake orders/stats, import demo contacts, modify database or enable production writes. Backend modules and deferred route implementations remain in repo. Remove deferred-feature links from the newly exposed navigation/profile/order flow; QR implementation modules stay present.

Implement login, shell/menu, order board, customer directory/profile/edit/create, staff/account settings, and cashier order/service/summary/detail/cash/report styling. Legacy member transaction/points/promo panels are not included in the new default profile UI. Existing deep routes remain protected for compatibility, not presented as redesigned features. Catalog-price configuration is deferred. Customer registration backend still issues its existing card; do not remove or change that behavior.

Verification: behavioral/source rendering tests, existing regression suite, typecheck and production build; inspect git diff to ensure no SQL/backend mutation. Browser is disabled by Work settings: report visual acceptance pending instead of fabricating screenshots or 1:1 acceptance. No production deployment in this change without completed review. UI implementation can be delivered for review despite the external visual gate limitation, clearly labeled.
