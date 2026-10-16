import { test } from "node:test";
import assert from "node:assert/strict";
import { extractLaundryToken } from "../lib/laundry/scan.ts";
import {
  REVIEW_CARD_ORIGIN,
  OFFICIAL_CARD_ORIGIN,
  cardOriginForEnvironment,
} from "../lib/laundry/card-origins.ts";

const token = "A".repeat(43);
const url = (origin, suffix = "") => `${origin}/k/${token}${suffix}`;

test("Preview QR always uses a stable alias across immutable deployments", () => {
  assert.equal(cardOriginForEnvironment("preview", "production"), REVIEW_CARD_ORIGIN);
  assert.equal(REVIEW_CARD_ORIGIN, "https://mas-git-main-m8traders-projects-081d9dc2.vercel.app");
  assert.equal(extractLaundryToken(url(REVIEW_CARD_ORIGIN)), token);
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
