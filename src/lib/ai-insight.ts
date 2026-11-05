import { z } from "zod";

// Shared by the server (to validate the model's answer) and the UI. Contains no credentials.

/* Spending limits */
/** Max AI requests per 24 hours across the whole demo. */
export const AI_DAILY_LIMIT = 50;
/** Wait after an AI summary for a ticket before it can be refreshed again. */
export const AI_INSIGHT_COOLDOWN_SECONDS = 30;
/** Ticket and account context sent to the model is cut to this many characters. */
export const AI_MAX_INPUT_CHARS = 6000;
/** Upper bound on the model's answer length (room for models that reason before answering). */
export const AI_MAX_OUTPUT_TOKENS = 1024;
export const AI_TIMEOUT_MS = 20_000;
/** Retries for rate limits, server errors and timeouts (not for 4xx such as 402). */
export const AI_MAX_RETRIES = 2;

/** The summary is 3-4 short labelled points ("Issue: …"), stored one per line. */
export const SUMMARY_POINTS_MAX = 4;
export const SUMMARY_POINT_MAX = 120;
export const NEXT_STEP_MAX = 100;
export const NEXT_STEPS_MAX = 3;
export const AI_REPLY_MAX = 1200;

/** What the model must return for a ticket. */
export const insightSchema = z.object({
  summary_points: z
    .array(z.string().trim().min(1).max(SUMMARY_POINT_MAX))
    .min(2)
    .max(SUMMARY_POINTS_MAX),
  next_steps: z.array(z.string().trim().min(1).max(NEXT_STEP_MAX)).min(1).max(NEXT_STEPS_MAX),
  reply: z.string().trim().min(1).max(AI_REPLY_MAX),
});
export type InsightResult = z.infer<typeof insightSchema>;

/** A saved AI summary as the UI uses it. */
export type TicketInsight = {
  /** Short labelled points, e.g. "Impact: 52 stores can't take cards". */
  summaryPoints: string[];
  nextSteps: string[];
  reply: string;
  model: string;
  generatedAt: string;
  /** Messages on the ticket when it was generated; more now means it may be out of date. */
  messageCount: number;
};
