/**
 * Only canonical origins may be embedded in a card. An immutable build URL is
 * not suitable for cards that customers keep after redeployment.
 *
 * The preview alias is exclusively for internal test cards. Production cards
 * switch to the official origin only after the separately approved launch.
 */
export const OFFICIAL_CARD_ORIGIN = "https://masjawalaundry.web.id";
export const REVIEW_CARD_ORIGIN =
  "https://mas-git-main-m8traders-projects-081d9dc2.vercel.app";

export function cardOriginForEnvironment(
  vercelEnv: string | undefined,
  nodeEnv: string | undefined,
): string {
  if (vercelEnv === "preview") return REVIEW_CARD_ORIGIN;
  if (nodeEnv !== "production") return "http://localhost:3000";
  return OFFICIAL_CARD_ORIGIN;
}
