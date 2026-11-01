import { test } from "node:test";
import assert from "node:assert/strict";
import { extractLaundryToken } from "../lib/laundry/scan.ts";
import {
  REVIEW_CARD_ORIGIN,
  QA_CARD_ORIGIN,
  QA_REVIEW_BRANCH,
  OFFICIAL_CARD_ORIGIN,
  cardOriginForEnvironment,
} from "../lib/laundry/card-origins.ts";

const token = "A".repeat(43);
const url = (origin, suffix = "") => `${origin}/k/${token}${suffix}`;
const newQaOrigin = "https://mas-git-pos-qa-m8traders-projects-081d9dc2.vercel.app";

test("every Preview branch requires its explicit safe QA card origin", () => {
  for (const branch of [undefined, "main", "feature/pos-foundation-v2", QA_REVIEW_BRANCH]) {
    assert.equal(cardOriginForEnvironment("preview", "production", branch, newQaOrigin), newQaOrigin);
    assert.throws(() => cardOriginForEnvironment("preview", "production", branch));
  }
});

test("Production QR only uses official origin; local development remains local", () => {
  assert.equal(cardOriginForEnvironment("production", "production"), OFFICIAL_CARD_ORIGIN);
  assert.equal(cardOriginForEnvironment(undefined, "production"), OFFICIAL_CARD_ORIGIN);
  assert.equal(cardOriginForEnvironment(undefined, "development"), "http://localhost:3000");
  assert.equal(extractLaundryToken(url(OFFICIAL_CARD_ORIGIN)), token);
});

test("Previously generated Vercel test cards can be resolved locally", () => {
  const previous = [
    "https://mas-hpilxtnzd-m8traders-projects-081d9dc2.vercel.app",
    "https://mas-9zj8a7oc1-m8traders-projects-081d9dc2.vercel.app",
    "https://masjawalaundry-preview-ombotak-property-s-projects.vercel.app",
  ];
  for (const origin of previous) assert.equal(extractLaundryToken(url(origin)), token);
});

test("Reject hostile links rather than following or accepting arbitrary URLs", () => {
  const bad = [
    "https://not-masjawalaundry.web.id",
    "https://masjawalaundry.web.id.evil.example",
    "https://mas-git-main-m8traders-projects-081d9dc2.vercel.app.evil.example",
    "https://mas-unrelated-team.vercel.app",
    "https://masjawalaundry.web.id@evil.example",
    "http://masjawalaundry.web.id",
    "javascript:alert(1)",
    "https://masjawalaundry.web.id:8080",
    "https://user:pass@masjawalaundry.web.id",
  ];
  for (const origin of bad) {
    const input = origin.includes("/k/") ? origin : url(origin);
    assert.equal(extractLaundryToken(input), null, input);
  }
  for (const suffix of ["?utm=x", "#fragment", "/extra"]) {
    assert.equal(extractLaundryToken(url(REVIEW_CARD_ORIGIN, suffix)), null);
  }
  assert.equal(extractLaundryToken("https://evil.example/k/" + token), null);
  assert.equal(extractLaundryToken(token), token);
});

test("new QA card destinations reject production, retired QA and unclean origins", () => {
  for (const origin of [
    undefined, "", REVIEW_CARD_ORIGIN, QA_CARD_ORIGIN, OFFICIAL_CARD_ORIGIN,
    "http://mas-git-pos-qa-m8traders-projects-081d9dc2.vercel.app",
    "https://mas-git-pos-qa-other-team.vercel.app",
    "https://mas-git-pos-qa-m8traders-projects-081d9dc2.vercel.app.evil.invalid",
    "https://mas-immutable-m8traders-projects-081d9dc2.vercel.app",
    newQaOrigin + "/", newQaOrigin + "/k", newQaOrigin + "?q=1", newQaOrigin + "#fragment",
    newQaOrigin + ":443", newQaOrigin + ":8080", " " + newQaOrigin, newQaOrigin + " ",
    newQaOrigin.replace("https://", "https://user:pass@"),
  ]) assert.throws(() => cardOriginForEnvironment("preview", "production", "main", origin), String(origin));
  assert.equal(cardOriginForEnvironment("production", "production", QA_REVIEW_BRANCH, newQaOrigin), OFFICIAL_CARD_ORIGIN);
  assert.equal(extractLaundryToken(url(QA_CARD_ORIGIN)), token);
  assert.equal(extractLaundryToken(url(REVIEW_CARD_ORIGIN)), token);
});
