import { describe, expect, it } from "vitest";

import { compareTickets } from "@/lib/ticket-order";
import type { Ticket } from "@/domain/types";

const t = (
  id: string,
  priority: Ticket["priority"],
  status: Ticket["status"],
  reopened = false,
  opened = "2026-10-20",
): Ticket => ({
  id,
  priority,
  status,
  reopened,
  opened,
  accountId: "a",
  title: id,
  category: "API",
  messages: [],
  summary: "",
  draft: "",
  knowledge: [],
  draftRevision: 0,
  resolutionNote: null,
  insight: null,
});

describe("Tickets list order", () => {
  it("puts high escalated first, then high, then medium reopened, then medium open, then low", () => {
    const list = [
      t("medium-open", "Medium", "Open"),
      t("low-open", "Low", "Open"),
      t("high-open", "High", "Open"),
      t("medium-reopened", "Medium", "Open", true),
      t("high-escalated", "High", "Escalated"),
      t("resolved-high", "High", "Resolved"),
    ];
    expect(list.sort(compareTickets).map((x) => x.id)).toEqual([
      "high-escalated",
      "high-open",
      "medium-reopened",
      "medium-open",
      "low-open",
      "resolved-high",
    ]);
  });

  it("breaks ties with the newest ticket first", () => {
    const list = [
      t("older", "Medium", "Open", false, "2026-10-01"),
      t("newer", "Medium", "Open", false, "2026-10-25"),
    ];
    expect(list.sort(compareTickets).map((x) => x.id)).toEqual(["newer", "older"]);
  });
});
