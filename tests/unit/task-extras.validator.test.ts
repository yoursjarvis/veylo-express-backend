import { describe, expect, it } from "vitest";
import {
  statusSchema,
  statusUpdateSchema,
} from "../../src/app/http/validators/task-extras.validator";

describe("task-extras validators", () => {
  describe("statusSchema", () => {
    it("UT-VAL-01: parses valid input with progressWeight successfully", () => {
      const input = {
        name: "Backlog",
        category: "backlog",
        progressWeight: 20,
      };
      const parsed = statusSchema.parse(input);
      expect(parsed.progressWeight).toBe(20);
      expect(parsed.order).toBe(0);
    });

    it("UT-VAL-02: defaults progressWeight to 0 if not provided", () => {
      const input = {
        name: "Backlog",
        category: "backlog",
      };
      const parsed = statusSchema.parse(input);
      expect(parsed.progressWeight).toBe(0);
    });

    it("UT-VAL-03: throws error for invalid progressWeight range", () => {
      const lowInput = {
        name: "Backlog",
        category: "backlog",
        progressWeight: -5,
      };
      const highInput = {
        name: "Backlog",
        category: "backlog",
        progressWeight: 105,
      };

      expect(() => statusSchema.parse(lowInput)).toThrow();
      expect(() => statusSchema.parse(highInput)).toThrow();
    });

    it("UT-VAL-04: throws error if progressWeight is not an integer", () => {
      const floatInput = {
        name: "Backlog",
        category: "backlog",
        progressWeight: 12.5,
      };
      expect(() => statusSchema.parse(floatInput)).toThrow();
    });
  });

  describe("statusUpdateSchema", () => {
    it("UT-VAL-05: parses valid partial updates successfully", () => {
      const input = {
        progressWeight: 50,
      };
      const parsed = statusUpdateSchema.parse(input);
      expect(parsed.progressWeight).toBe(50);
      expect(parsed.name).toBeUndefined();
    });

    it("UT-VAL-06: throws error if updated progressWeight is invalid", () => {
      const lowInput = { progressWeight: -1 };
      const floatInput = { progressWeight: 5.5 };

      expect(() => statusUpdateSchema.parse(lowInput)).toThrow();
      expect(() => statusUpdateSchema.parse(floatInput)).toThrow();
    });
  });
});
