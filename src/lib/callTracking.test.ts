import { describe, expect, test } from "bun:test";
import { dailyCallSummary, trackedCallDate, validateTrackedCall } from "./callTracking";

describe("Call Tracking", () => {
  test("every outcome including no answer contributes to daily calls", () => {
    const calls = ["no_answer", "voicemail", "conversation", "not_interested", "appointment_set", "do_not_call"].map((outcome, i) => ({ lead_id: String(i), outcome, created_at: "2026-10-25T02:00:00Z" }));
    expect(dailyCallSummary(calls, "2026-10-24", "America/Chicago")).toEqual({ calls: 6, leads: 6, conversations: 1, appointments: 1 });
  });
  test("repeated calls remain separate but a daily owner counts once", () => {
    const call = { lead_id: "one", outcome: "no_answer", created_at: "2026-10-25T02:00:00Z" };
    expect(dailyCallSummary([call, call], "2026-10-24", "America/Chicago")).toMatchObject({ calls: 2, leads: 1 });
  });
  test("a historical call belongs to its selected date, not entry date", () => {
    expect(trackedCallDate({ lead_id: "one", call_date: "2026-10-20", created_at: "2026-10-25T02:00:00Z" }, "America/Chicago")).toBe("2026-10-20");
  });
  test("future calls are rejected", () => {
    expect(validateTrackedCall("2026-10-26", "2026-10-25", "", false)).toBe("Call date cannot be in the future.");
  });
  test("follow-up cannot precede the call", () => {
    expect(validateTrackedCall("2026-10-25", "2026-10-25", "2026-10-24", false)).toBe("Follow-up cannot be before the call.");
  });
  test("do not contact ignores the follow-up date", () => {
    expect(validateTrackedCall("2026-10-25", "2026-10-25", "2026-10-24", true)).toBeNull();
  });
});