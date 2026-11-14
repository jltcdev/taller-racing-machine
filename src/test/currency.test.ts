import { describe, expect, it } from "vitest";

import { formatCOP, formatCOPInput, parseCOPInput } from "@/lib/orders";

describe("COP input formatting", () => {
  it("groups hundreds, thousands, and millions with Colombian separators", () => {
    expect(formatCOPInput("60000")).toBe("60.000");
    expect(formatCOPInput("1234567")).toBe("1.234.567");
    expect(formatCOPInput(1234567.5)).toBe("1.234.568");
    expect(formatCOP(15339000)).toBe("$15.339.000");
    expect(formatCOPInput("")).toBe("");
  });

  it("parses formatted COP amounts as integer digits", () => {
    expect(parseCOPInput("1.234.567")).toBe("1234567");
    expect(parseCOPInput("")).toBe("");
  });
});
