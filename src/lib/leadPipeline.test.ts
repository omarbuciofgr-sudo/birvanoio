import { describe, expect, test } from "bun:test";
import { latestPipelineCall, nextPipelineFollowUp } from "./leadPipeline";

describe("Lead Pipeline records", () => {
  test("next follow-up is the earliest unfinished task for that lead", () => {
    const rows = [
      { lead_id: "a", due_date: "2026-10-28", done_at: null },
      { lead_id: "a", due_date: "2026-10-26", done_at: "2026-10-26" },
      { lead_id: "b", due_date: "2026-10-25", done_at: null },
      { lead_id: "a", due_date: "2026-10-27", done_at: null },
    ];
    expect(nextPipelineFollowUp(rows, "a")?.due_date).toBe("2026-10-27");
    expect(nextPipelineFollowUp(rows, "missing")).toBeUndefined();
  });
  test("latest outcome follows actual call date rather than when a historical call was entered", () => {
    const rows = [
      { lead_id: "a", call_date: "2026-10-20", created_at: "2026-10-26T03:00:00Z" },
      { lead_id: "a", call_date: "2026-10-25", created_at: "2026-10-25T03:00:00Z" },
      { lead_id: "b", call_date: "2026-10-26", created_at: "2026-10-26T03:00:00Z" },
    ];
    expect(latestPipelineCall(rows, "a")?.call_date).toBe("2026-10-25");
  });
});