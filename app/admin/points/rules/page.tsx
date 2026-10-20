import { notFound } from "next/navigation";

// Point rules are database-managed. No owner/staff account, even with the old
// direct URL, can access a rule-editing screen.
export default function PointRulesNotAvailable() {
  notFound();
}
