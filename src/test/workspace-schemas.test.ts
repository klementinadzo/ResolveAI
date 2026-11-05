import { describe, expect, it } from "vitest";

import {
  createFollowUpInput,
  errorText,
  saveDraftInput,
  submitReplyInput,
  ticketStatusInput,
} from "@/lib/workspace-schemas";

const uuid = "6f1c2a0e-3b4d-4c5e-9f60-718293a4b5c6";

describe("write input rules", () => {
  it("requires a non-blank resolution note only when resolving", () => {
    expect(ticketStatusInput.safeParse({ ticketId: "4812", status: "Resolved" }).success).toBe(
      false,
    );
    expect(
      ticketStatusInput.safeParse({ ticketId: "4812", status: "Resolved", note: "   " }).success,
    ).toBe(false);
    expect(
      ticketStatusInput.safeParse({ ticketId: "4812", status: "Resolved", note: "Fixed token" })
        .success,
    ).toBe(true);
    expect(ticketStatusInput.safeParse({ ticketId: "4812", status: "Escalated" }).success).toBe(
      true,
    );
    expect(ticketStatusInput.safeParse({ ticketId: "4812", status: "Closed" }).success).toBe(false);
  });

  it("limits reply and draft length and rejects empty replies", () => {
    expect(
      submitReplyInput.safeParse({ ticketId: "4812", messageId: uuid, body: "  " }).success,
    ).toBe(false);
    expect(
      submitReplyInput.safeParse({ ticketId: "4812", messageId: uuid, body: "x".repeat(5001) })
        .success,
    ).toBe(false);
    expect(
      submitReplyInput.safeParse({ ticketId: "4812", messageId: "not-a-uuid", body: "Hi" }).success,
    ).toBe(false);
    expect(saveDraftInput.safeParse({ ticketId: "4812", draft: "", revision: 0 }).success).toBe(
      true,
    );
    expect(
      saveDraftInput.safeParse({ ticketId: "4812", draft: "x".repeat(5001), revision: 0 }).success,
    ).toBe(false);
    expect(saveDraftInput.safeParse({ ticketId: "4812", draft: "", revision: -1 }).success).toBe(
      false,
    );
  });

  it("checks follow-up owner, type, reason and due date", () => {
    const ok = {
      id: uuid,
      accountId: "northstar",
      type: "Recovery plan",
      reason: "Agree plan",
      owner: "You",
      due: "2026-10-08",
    };
    expect(createFollowUpInput.safeParse(ok).success).toBe(true);
    expect(createFollowUpInput.safeParse({ ...ok, owner: "Unassigned" }).success).toBe(false);
    expect(createFollowUpInput.safeParse({ ...ok, owner: "Aiko Tanaka" }).success).toBe(false);
    expect(createFollowUpInput.safeParse({ ...ok, type: "Lunch" }).success).toBe(false);
    expect(createFollowUpInput.safeParse({ ...ok, reason: " " }).success).toBe(false);
    expect(createFollowUpInput.safeParse({ ...ok, due: "2026-02-30" }).success).toBe(false);
    expect(createFollowUpInput.safeParse({ ...ok, due: "1999-01-01" }).success).toBe(false);
  });

  it("turns validation errors into a readable message", () => {
    const r = ticketStatusInput.safeParse({ ticketId: "4812", status: "Resolved" });
    expect(r.success).toBe(false);
    expect(errorText(new Error(JSON.stringify(r.error!.issues)))).toBe(
      "A resolution note is required to resolve a ticket.",
    );
    expect(errorText(new Error("That ticket no longer exists."))).toBe(
      "That ticket no longer exists.",
    );
  });
});
