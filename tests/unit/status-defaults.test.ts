import { describe, expect, it } from "vitest";
import { getDefaultStatusColorAndWeight } from "../../src/utils/status-defaults";

describe("status-defaults helper utilities", () => {
  it("UT-STD-01: returns emerald green and weight 100 for done category or names", () => {
    expect(getDefaultStatusColorAndWeight("Completed", "todo")).toEqual({
      color: "#10b981",
      progressWeight: 100,
    });
    expect(getDefaultStatusColorAndWeight("Done", "done")).toEqual({
      color: "#10b981",
      progressWeight: 100,
    });
    expect(getDefaultStatusColorAndWeight("Go Live", "in_progress")).toEqual({
      color: "#10b981",
      progressWeight: 100,
    });
  });

  it("UT-STD-02: returns red and weight 0 for backlog category or names", () => {
    expect(getDefaultStatusColorAndWeight("Ideas Pool", "todo")).toEqual({
      color: "#ef4444",
      progressWeight: 0,
    });
    expect(getDefaultStatusColorAndWeight("Backlog", "backlog")).toEqual({
      color: "#ef4444",
      progressWeight: 0,
    });
  });

  it("UT-STD-03: returns purple and weight 50 for active/creation in_progress names", () => {
    expect(
      getDefaultStatusColorAndWeight("Active Development", "in_progress"),
    ).toEqual({
      color: "#8b5cf6",
      progressWeight: 50,
    });
  });

  it("UT-STD-04: returns amber and weight 80 for review/testing/qa in_progress names", () => {
    expect(
      getDefaultStatusColorAndWeight("Awaiting Approval", "in_progress"),
    ).toEqual({
      color: "#f59e0b",
      progressWeight: 80,
    });
    expect(getDefaultStatusColorAndWeight("QA Testing", "in_progress")).toEqual(
      {
        color: "#f59e0b",
        progressWeight: 80,
      },
    );
  });

  it("UT-STD-05: returns blue and weight 0 for default/todo category", () => {
    expect(getDefaultStatusColorAndWeight("Ready for Dev", "todo")).toEqual({
      color: "#3b82f6",
      progressWeight: 0,
    });
  });
});
