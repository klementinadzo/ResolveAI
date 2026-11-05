// @vitest-environment node
import type { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { SEED_FILE } from "../../scripts/db";
import { createTestDb, failure } from "./db/test-db";

// The database functions against a real Postgres: migrations + demo data, each test
// rolled back afterwards. Calls run as service_role, the role the server uses.

let db: PGlite;

beforeAll(async () => {
  db = await createTestDb();
}, 60_000);
afterAll(() => db.close());
beforeEach(() => db.exec("begin; set local role service_role;"));
afterEach(() => db.exec("rollback"));

/** A function call: SQL and its parameters. */
type Call = [sql: string, params?: unknown[]];
const value = async <T>([sql, params = []]: Call) =>
  Object.values((await db.query<Record<string, T>>(sql, params)).rows[0] ?? {})[0] as T;
const row = async <T>(sql: string, params: unknown[] = []) =>
  (await db.query<T>(sql, params)).rows[0] as T;
const fails = ([sql, params]: Call) => failure(db, sql, params);
/** Raised by `raise exception '<key>'` in our functions. */
const raised = (key: string) => ({ code: "P0001", message: key });

const setStatus = (id: string, status: string, note: string | null = null): Call => [
  "select public.set_ticket_status($1, $2, $3)",
  [id, status, note],
];
const saveDraft = (id: string, draft: string, revision: number): Call => [
  "select public.save_ticket_draft($1, $2, $3)",
  [id, draft, revision],
];
const reply = (id: string, messageId: string, body: string): Call => [
  "select public.submit_simulated_reply($1, $2, $3, 'Mara Okafor')",
  [id, messageId, body],
];
const createFollowUp = (id: string, account: string): Call => [
  "select public.create_follow_up($1, $2, 'Recovery plan', '  Agree a plan  ', 'You', current_date + 3)",
  [id, account],
];
const completeFollowUp = (id: string): Call => ["select public.complete_follow_up($1)", [id]];
const setRisk = (account: string, risk: string): Call => [
  "select public.set_account_risk($1, $2)",
  [account, risk],
];
const beginAi = (ticketId: string, dailyLimit = 50): Call => [
  "select public.begin_ai_request($1, $2, 30)",
  [ticketId, dailyLimit],
];
const saveInsight = (ticketId: string, prefill: boolean): Call => [
  "select public.save_ticket_insight($1, 'Issue: x', array['Call Tom'], '  Hi Tom  ', 'test-model', 3, $2)",
  [ticketId, prefill],
];

const ticket = (id: string) =>
  row<{ status: string; draft: string; draft_revision: number; resolution_note: string | null }>(
    "select status, draft, draft_revision, resolution_note from public.tickets where id = $1",
    [id],
  );
/** Timeline entries with this title (all events in one transaction share a timestamp). */
const events = async (title: string) =>
  (
    await db.query<{ detail: string; kind: string }>(
      "select detail, kind from public.timeline_events where title = $1",
      [title],
    )
  ).rows;
const eventCount = () => value<number>(["select count(*)::int from public.timeline_events"]);

describe("demo data", () => {
  it("loads the full dataset", async () => {
    const counts = await row(`select
      (select count(*)::int from public.accounts) as accounts,
      (select count(*)::int from public.tickets) as tickets,
      (select count(*)::int from public.ticket_messages) as messages,
      (select count(*)::int from public.follow_ups) as follow_ups,
      (select count(*)::int from public.timeline_events) as events`);
    expect(counts).toEqual({ accounts: 10, tickets: 36, messages: 45, follow_ups: 6, events: 42 });
  });

  it("is dated relative to today and matches the demo's rules", async () => {
    const r = await row(`select
      (select count(*)::int from public.tickets where opened_on > current_date) as future_tickets,
      (select count(*)::int from public.ticket_messages where sent_at > now()) as future_messages,
      (select min(renewal_date - current_date) from public.accounts) as soonest_renewal,
      (select count(*)::int from public.tickets where status = 'Escalated') as escalated,
      (select count(*)::int from public.tickets where priority = 'High' and status <> 'Resolved') as urgent,
      (select count(*)::int from public.accounts where owner <> 'You') as not_mara`);
    expect(r).toEqual({
      future_tickets: 0,
      future_messages: 0,
      soonest_renewal: 42,
      escalated: 2,
      urgent: 5,
      not_mara: 0,
    });
  });

  it("can be loaded again without adding or changing anything", async () => {
    await db.exec("reset role");
    const before = await eventCount();
    await db.exec(readFileSync(SEED_FILE, "utf8"));
    expect(await eventCount()).toBe(before);
  });
});

describe("access", () => {
  it.each(["anon", "authenticated"])("%s can read no table and run no function", async (role) => {
    await db.exec(`set local role ${role}`);
    expect((await fails(["select * from public.tickets"])).code).toBe("42501");
    expect((await fails(["select * from public.ai_requests"])).code).toBe("42501");
    expect((await fails(setRisk("harbor", "Low"))).code).toBe("42501");
    expect((await fails(reply("4810", "m-x", "Hi"))).code).toBe("42501");
  });
});

describe("set_ticket_status", () => {
  it("requires a resolution note and logs it", async () => {
    expect(await fails(setStatus("4810", "Resolved", "  "))).toEqual(
      raised("resolution_note_required"),
    );
    await value(setStatus("4810", "Resolved", "Rolled back the update"));
    expect(await ticket("4810")).toMatchObject({
      status: "Resolved",
      resolution_note: "Rolled back the update",
    });
    expect(await events("#4810 resolved")).toEqual([
      { detail: "Resolved by You · Note: Rolled back the update", kind: "ticket" },
    ]);
  });

  it("clears the note when reopened and logs escalation", async () => {
    await value(setStatus("4810", "Resolved", "Fixed"));
    await value(setStatus("4810", "Open"));
    expect((await ticket("4810")).resolution_note).toBeNull();
    await value(setStatus("4810", "Escalated"));
    expect(await events("#4810 escalated")).toEqual([
      { detail: "Escalated to Tier-2", kind: "ticket" },
    ]);
  });

  it("does nothing when the status is unchanged", async () => {
    const before = await eventCount();
    await value(setStatus("4813", "Escalated"));
    expect(await eventCount()).toBe(before);
  });

  it("rejects unknown tickets and the retired Pending status", async () => {
    expect(await fails(setStatus("nope", "Open"))).toEqual(raised("ticket_not_found"));
    expect((await fails(setStatus("4810", "Pending"))).code).toBe("23514"); // check constraint
  });
});

describe("drafts and replies", () => {
  it("saves a draft only for the current revision", async () => {
    const { draft_revision } = await ticket("4810");
    expect(await value(saveDraft("4810", "Hi Tom", draft_revision))).toBe(true);
    expect(await value(saveDraft("4810", "stale", draft_revision - 1))).toBe(false);
    expect((await ticket("4810")).draft).toBe("Hi Tom");
    expect(await fails(saveDraft("nope", "x", 0))).toEqual(raised("ticket_not_found"));
  });

  it("records a reply in one step: message, empty draft, new revision, history", async () => {
    const before = await ticket("4810");
    await value(saveDraft("4810", "Hi Tom", before.draft_revision));
    const revision = await value<number>(reply("4810", "m-test-1", "  We are on it.  "));
    expect(revision).toBe(before.draft_revision + 1);
    expect(await ticket("4810")).toMatchObject({
      draft: "",
      draft_revision: revision,
      status: before.status, // replying never changes the status
    });
    expect(
      await row("select body, from_customer from public.ticket_messages where id = 'm-test-1'"),
    ).toEqual({ body: "We are on it.", from_customer: false });
    expect(await events("Simulated reply recorded on #4810")).toEqual([
      { detail: "We are on it.", kind: "reply" },
    ]);
  });

  it("treats a retried reply as already recorded", async () => {
    const first = await value(reply("4810", "m-test-2", "Once"));
    const count = await eventCount();
    expect(await value(reply("4810", "m-test-2", "Once"))).toEqual(first);
    expect(await eventCount()).toBe(count);
  });

  it("rejects empty replies and replies on resolved tickets", async () => {
    expect(await fails(reply("4810", "m-test-3", "   "))).toEqual(raised("reply_empty"));
    await value(setStatus("4810", "Resolved", "Done"));
    expect(await fails(reply("4810", "m-test-4", "Hello"))).toEqual(raised("ticket_resolved"));
  });
});

describe("follow-ups and risk", () => {
  it("creates a follow-up once and completes it once", async () => {
    const before = await eventCount();
    await value(createFollowUp("f-test", "harbor"));
    await value(createFollowUp("f-test", "harbor")); // a retry adds nothing
    expect(await row("select reason, status from public.follow_ups where id = 'f-test'")).toEqual({
      reason: "Agree a plan",
      status: "Open",
    });
    await value(completeFollowUp("f-test"));
    await value(completeFollowUp("f-test"));
    expect(await eventCount()).toBe(before + 2); // created + completed
    expect(
      await row(
        "select status, completed_at is not null as done from public.follow_ups where id = 'f-test'",
      ),
    ).toEqual({ status: "Done", done: true });
  });

  it("rejects unknown accounts and follow-ups", async () => {
    expect(await fails(createFollowUp("f-x", "nope"))).toEqual(raised("account_not_found"));
    expect(await fails(completeFollowUp("nope"))).toEqual(raised("follow_up_not_found"));
  });

  it("changes risk only when it differs, and logs it", async () => {
    const before = await eventCount();
    await value(setRisk("harbor", "High")); // already High
    expect(await eventCount()).toBe(before);
    await value(setRisk("harbor", "Medium"));
    expect(await events("Risk level set to Medium")).toEqual([
      { detail: "Updated manually by You after review", kind: "risk" },
    ]);
    expect(await fails(setRisk("nope", "Low"))).toEqual(raised("account_not_found"));
  });
});

describe("AI requests", () => {
  it("enforces the per-ticket cooldown, except after a failed attempt", async () => {
    const id = await value<string>(beginAi("4810"));
    expect(await fails(beginAi("4810"))).toEqual(raised("ai_ticket_cooldown"));
    await db.query("update public.ai_requests set succeeded = false where id = $1", [id]);
    expect(await value(beginAi("4810"))).toBeTruthy();
  });

  it("enforces the daily limit across tickets", async () => {
    await value(beginAi("4810", 1));
    expect(await fails(beginAi("4812", 1))).toEqual(raised("ai_daily_limit"));
    expect(await fails(beginAi("nope"))).toEqual(raised("ticket_not_found"));
  });

  it("fills an empty draft with the suggested reply only when asked", async () => {
    expect(await value(saveInsight("4810", false))).toBe(false);
    expect((await ticket("4810")).draft).toBe("");
    expect(await value(saveInsight("4810", true))).toBe(true);
    expect((await ticket("4810")).draft).toBe("Hi Tom");
  });

  it("never overwrites a draft someone is writing", async () => {
    const { draft_revision } = await ticket("4810");
    await value(saveDraft("4810", "My own words", draft_revision));
    expect(await value(saveInsight("4810", true))).toBe(false);
    expect((await ticket("4810")).draft).toBe("My own words");
  });
});
