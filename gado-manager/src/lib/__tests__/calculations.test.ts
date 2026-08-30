import { describe, it, expect } from "vitest";
import {
  calculateWeightGain,
  calculateWeightGainPercentage,
  calculateAverageWeight,
  calculateMaxWeight,
  calculateMinWeight,
  calculatePeriodDays,
  calculateWeightVariation,
  generateInterpretation,
} from "../calculations";

describe("calculateWeightGain", () => {
  it("should calculate positive weight gain", () => {
    expect(calculateWeightGain(451, 420)).toBe(31);
  });

  it("should calculate negative weight gain (loss)", () => {
    expect(calculateWeightGain(412, 420)).toBe(-8);
  });

  it("should return 0 when weights are equal", () => {
    expect(calculateWeightGain(420, 420)).toBe(0);
  });

  it("should handle decimal values", () => {
    expect(calculateWeightGain(420.5, 418.3)).toBe(2.2);
  });
});

describe("calculateWeightGainPercentage", () => {
  it("should calculate positive percentage", () => {
    const result = calculateWeightGainPercentage(451, 420);
    expect(result).toBe(7.38);
  });

  it("should calculate negative percentage", () => {
    const result = calculateWeightGainPercentage(412, 420);
    expect(result).toBeCloseTo(-1.9, 1);
  });

  it("should return 0 when initial weight is 0", () => {
    expect(calculateWeightGainPercentage(100, 0)).toBe(0);
  });

  it("should return 0 when weights are equal", () => {
    expect(calculateWeightGainPercentage(420, 420)).toBe(0);
  });
});

describe("calculateAverageWeight", () => {
  it("should calculate average of weights", () => {
    expect(calculateAverageWeight([420, 430, 440])).toBe(430);
  });

  it("should return 0 for empty array", () => {
    expect(calculateAverageWeight([])).toBe(0);
  });

  it("should handle single weight", () => {
    expect(calculateAverageWeight([450])).toBe(450);
  });

  it("should handle decimal results", () => {
    expect(calculateAverageWeight([420, 431])).toBe(425.5);
  });
});

describe("calculateMaxWeight", () => {
  it("should find maximum weight", () => {
    expect(calculateMaxWeight([420, 451, 438])).toBe(451);
  });

  it("should return null for empty array", () => {
    expect(calculateMaxWeight([])).toBeNull();
  });

  it("should handle single weight", () => {
    expect(calculateMaxWeight([450])).toBe(450);
  });
});

describe("calculateMinWeight", () => {
  it("should find minimum weight", () => {
    expect(calculateMinWeight([420, 451, 438])).toBe(420);
  });

  it("should return null for empty array", () => {
    expect(calculateMinWeight([])).toBeNull();
  });
});

describe("calculatePeriodDays", () => {
  it("should calculate days between dates", () => {
    expect(calculatePeriodDays("2026-08-01", "2026-08-22")).toBe(21);
  });

  it("should return 0 for same date", () => {
    expect(calculatePeriodDays("2026-08-01", "2026-08-01")).toBe(0);
  });
});

describe("calculateWeightVariation", () => {
  it("should calculate positive variation", () => {
    const result = calculateWeightVariation(420, 451);
    expect(result.variacaoKg).toBe(31);
    expect(result.variacaoPercentual).toBe(7.38);
  });

  it("should calculate negative variation", () => {
    const result = calculateWeightVariation(420, 412);
    expect(result.variacaoKg).toBe(-8);
    expect(result.variacaoPercentual).toBeCloseTo(-1.9, 1);
  });
});

describe("generateInterpretation", () => {
  it("should generate positive interpretation", () => {
    const result = generateInterpretation(451, 420);
    expect(result).toContain("aumentou");
    expect(result).toContain("31");
    expect(result).toContain("7.38");
  });

  it("should generate negative interpretation", () => {
    const result = generateInterpretation(412, 420);
    expect(result).toContain("reduziu");
    expect(result).toContain("8");
  });

  it("should generate neutral interpretation", () => {
    const result = generateInterpretation(420, 420);
    expect(result).toContain("Não houve alteração");
  });

  it("should handle null values", () => {
    const result = generateInterpretation(null, null);
    expect(result).toContain("insuficientes");
  });
});
