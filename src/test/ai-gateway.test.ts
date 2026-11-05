import { describe, expect, it } from "vitest";

import { AI_MAX_INPUT_CHARS, AI_MAX_RETRIES } from "@/lib/ai-insight";
import {
  AiError,
  GEMINI_URL,
  insightPrompt,
  insightWithGateway,
  LOVABLE_URL,
  parseInsight,
  resolveAiProvider,
  type AiProvider,
  type InsightContext,
} from "@/lib/ai-gateway.server";

const context: InsightContext = {
  account: {
    name: "Northstar Logistics",
    tier: "Enterprise",
    users: 640,
    renewal: "2026-11-17",
    renewalInDays: 42,
    sentiment: "Declining",
    risk: "High",
    owner: "You",
    contact: "Priya Nair",
  },
  ticket: {
    id: "4812",
    title: "Reporting dashboard not syncing",
    category: "Integration",
    priority: "High",
    status: "Open",
    reopened: false,
    opened: "2026-10-05",
  },
  messages: [
    {
      fromCustomer: true,
      author: "Priya Nair",
      body: "Dashboards stopped syncing before our board review.",
    },
  ],
  otherTickets: [
    {
      id: "4790",
      title: "Webhook delivery failures",
      priority: "Medium",
      status: "Open",
      reopened: true,
    },
  ],
  followUps: [{ type: "Recovery plan", reason: "Agree a plan", due: "2026-10-02", overdue: true }],
  recentEvents: [{ date: "2026-10-05", title: "#4812 opened" }],
};
const answer = {
  summary_points: [
    "Issue: reporting dashboard stopped syncing shipment data",
    "History: third integration problem in two weeks",
    "Account: renewal in 42 days, sentiment declining",
  ],
  next_steps: [
    "Escalate the sync failure to the integrations team",
    "Confirm the fix with Priya before Thursday",
  ],
  reply: "Hi Priya,\n\nWe're on it and will update you by [time].\n\nBest regards,\nMara",
};
const completion = (args: unknown) => ({
  choices: [
    {
      message: {
        tool_calls: [{ function: { name: "brief_ticket", arguments: JSON.stringify(args) } }],
      },
    },
  ],
});

/** Fake fetch that replays a script of responses and records each request. */
function fakeFetch(script: (Response | Error)[]) {
  const requests: { url: string; init: RequestInit }[] = [];
  const impl = (async (url: string, init: RequestInit) => {
    requests.push({ url, init });
    const next = script.shift();
    if (!next) throw new Error("no more scripted responses");
    if (next instanceof Error) throw next;
    return next;
  }) as unknown as typeof fetch;
  return { impl, requests };
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const noSleep = async () => {};
const provider: AiProvider = {
  name: "Gemini",
  url: GEMINI_URL,
  apiKey: "test-key",
  model: "test-model",
};
const run = (f: ReturnType<typeof fakeFetch>, p: AiProvider = provider) =>
  insightWithGateway(context, { provider: p, fetchImpl: f.impl, sleep: noSleep });

describe("insightWithGateway", () => {
  it("sends one server-side request with the key, model, account context and forced function call", async () => {
    const f = fakeFetch([json(completion(answer))]);
    await expect(run(f)).resolves.toEqual(answer);
    expect(f.requests).toHaveLength(1);
    expect(f.requests[0]!.url).toBe(GEMINI_URL);
    expect((f.requests[0]!.init.headers as Record<string, string>)["Authorization"]).toBe(
      "Bearer test-key",
    );
    const body = JSON.parse(f.requests[0]!.init.body as string);
    expect(body.model).toBe("test-model");
    expect(body.max_tokens).toBeLessThanOrEqual(1024);
    expect(body.tool_choice).toEqual({ type: "function", function: { name: "brief_ticket" } });
    const prompt = body.messages[1].content as string;
    for (const fact of [
      "Northstar Logistics",
      "in 42 days",
      "#4790 Webhook delivery failures",
      "(OVERDUE)",
      "Priya Nair",
    ]) {
      expect(prompt).toContain(fact);
    }
  });

  it("retries rate limits and server errors, then succeeds", async () => {
    const f = fakeFetch([json({}, 429), json({}, 503), json(completion(answer))]);
    await expect(run(f)).resolves.toEqual(answer);
    expect(f.requests).toHaveLength(3);
  });

  it(`gives up after ${AI_MAX_RETRIES} retries with a readable message`, async () => {
    const f = fakeFetch([json({}, 503), json({}, 503), json({}, 503), json(completion(answer))]);
    await expect(run(f)).rejects.toThrow("Gemini is overloaded right now");
    expect(f.requests).toHaveLength(AI_MAX_RETRIES + 1);
  });

  it("does not retry when the allowance is used up (402)", async () => {
    const f = fakeFetch([json({}, 402), json(completion(answer))]);
    await expect(run(f)).rejects.toThrow("allowance is used up");
    expect(f.requests).toHaveLength(1);
  });

  it("retries timeouts and network errors", async () => {
    const f = fakeFetch([new Error("timeout"), new Error("network"), new Error("timeout")]);
    await expect(run(f)).rejects.toThrow("couldn't be reached or didn't respond in time");
    expect(f.requests).toHaveLength(3);
  });

  it("never puts the API key in an error message", async () => {
    const f = fakeFetch([json({ error: "bad request" }, 400)]);
    const err = await run(f, { ...provider, apiKey: "secret-value" }).catch((e) => e);
    expect(err).toBeInstanceOf(AiError);
    expect(String(err.message)).not.toContain("secret-value");
  });
});

describe("parseInsight", () => {
  it("rejects answers that don't match the expected shape", () => {
    expect(() => parseInsight(completion({ ...answer, next_steps: [] }))).toThrow(AiError);
    expect(
      () => parseInsight(completion({ ...answer, next_steps: ["a", "b", "c", "d"] })), // max 3
    ).toThrow(AiError);
    expect(() =>
      parseInsight(completion({ ...answer, summary_points: ["Issue: only one point"] })),
    ).toThrow(AiError);
    expect(() =>
      parseInsight(
        completion({ ...answer, summary_points: ["Issue: " + "x".repeat(130), "Impact: y"] }),
      ),
    ).toThrow(AiError);
    expect(() => parseInsight({ choices: [{ message: { content: "It's urgent" } }] })).toThrow(
      AiError,
    );
  });

  it("accepts a JSON answer in plain content when no function call is returned", () => {
    const content = "```json\n" + JSON.stringify(answer) + "\n```";
    expect(parseInsight({ choices: [{ message: { content } }] })).toEqual(answer);
  });
});

describe("insightPrompt", () => {
  it("caps the text sent to the model, keeping the newest messages", () => {
    const long = {
      ...context,
      messages: [
        { fromCustomer: true, author: "Priya Nair", body: "old ".repeat(3000) },
        { fromCustomer: true, author: "Priya Nair", body: "LATEST" },
      ],
    };
    const prompt = insightPrompt(long);
    expect(prompt.length).toBeLessThanOrEqual(AI_MAX_INPUT_CHARS);
    expect(prompt.endsWith("LATEST")).toBe(true);
    expect(prompt).toContain("Northstar Logistics"); // account context is never cut
  });
});

describe("resolveAiProvider", () => {
  it("prefers the Gemini key, then Lovable's, and lets AI_MODEL override the model", () => {
    expect(resolveAiProvider({ AI_API_KEY: "g", LOVABLE_API_KEY: "l" })).toMatchObject({
      name: "Gemini",
      url: GEMINI_URL,
      apiKey: "g",
    });
    expect(resolveAiProvider({ LOVABLE_API_KEY: "l" })).toMatchObject({
      name: "Lovable AI",
      url: LOVABLE_URL,
      apiKey: "l",
    });
    expect(resolveAiProvider({ AI_API_KEY: "g", AI_MODEL: "m1" })?.model).toBe("m1");
    expect(resolveAiProvider({})).toBeNull();
  });
});
