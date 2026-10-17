import type { SupabaseClient } from "@supabase/supabase-js";

export const HISTORY_PAGE_SIZE = 30;

export function historyPageNumber(raw: string | undefined): number {
  if (!raw || !/^[1-9][0-9]{0,3}$/.test(raw)) return 1;
  return Number(raw);
}

export function historyPageHref(memberId: string, page: number): string {
  return `/admin/members/${memberId}?historyPage=${page}#transaction-history`;
}

type HistoryEvent = {
  id: string;
  event_type: string;
  reverses_event_id: string | null;
  reason: string | null;
  occurred_at: string;
};
type Amount = {
  visit_event_id: string;
  amount_idr: number | string;
  description: string;
  awarded_points: number;
  program_year: number;
};

/** The caller must verify the owner; all queries also run under the owner's RLS. */
export async function loadMemberHistory(
  supabase: Pick<SupabaseClient, "from">,
  memberId: string,
  page: number,
) {
  const offset = (page - 1) * HISTORY_PAGE_SIZE;
  const history = await supabase.from("laundry_checklist_events")
    .select("id,event_type,reverses_event_id,reason,occurred_at", { count: "exact" })
    .eq("member_id", memberId)
    .order("occurred_at", { ascending: false }).order("id", { ascending: false })
    .range(offset, offset + HISTORY_PAGE_SIZE - 1);
  const events = (history.error ? [] : history.data || []) as HistoryEvent[];
  const addIds = events.filter(event => event.event_type === "ADD").map(event => event.id);
  const empty = { data: [], error: null };
  // Resolve metadata by displayed event IDs, rather than a separate latest-N
  // window. A VOID can be on a different page from its original ADD.
  const [amounts, reversals] = addIds.length ? await Promise.all([
    supabase.from("laundry_amount_transactions")
      .select("visit_event_id,amount_idr,description,awarded_points,program_year")
      .eq("member_id", memberId).in("visit_event_id", addIds),
    supabase.from("laundry_checklist_events").select("reverses_event_id")
      .eq("member_id", memberId).eq("event_type", "VOID").in("reverses_event_id", addIds),
  ]) : [empty, empty];

  return {
    events,
    count: history.count,
    failed: Boolean(history.error),
    amountsFailed: Boolean(amounts.error),
    reversalsFailed: Boolean(reversals.error),
    amounts: new Map((amounts.error ? [] : amounts.data || []).map((row: Amount) => [row.visit_event_id, row])),
    corrected: new Set((reversals.error ? [] : reversals.data || []).map(row => row.reverses_event_id)),
    hasOlder: history.count !== null && offset + HISTORY_PAGE_SIZE < history.count,
  };
}
