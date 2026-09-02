import { describe, expect, it } from "vitest";

import { leadSubmitSchema } from "../../src/lib/contracts/lead";

const validLead = {
  name: "Анна Иванова",
  phone: "+7 (900) 000-00-00",
  goal: "Стать сильнее",
  consent: true,
  website: "",
  startedAt: 1_700_000_000_000,
};

function isValid(input: unknown) {
  return leadSubmitSchema.safeParse(input).success;
}

describe("leadSubmitSchema", () => {
  it("trims and accepts a complete valid lead", () => {
    const result = leadSubmitSchema.parse({ ...validLead, name: "  Анна Иванова  " });

    expect(result.name).toBe("Анна Иванова");
  });

  it.each([
    ["Аа", true],
    ["А", false],
    ["А".repeat(80), true],
    ["А".repeat(81), false],
  ])("enforces name boundary for %s", (name, expected) => {
    expect(isValid({ ...validLead, name })).toBe(expected);
  });

  it.each([
    ["1234567", true],
    ["123456", false],
    ["123456789012345", true],
    ["1234567890123456", false],
    ["123456789012345678901234567890123", false],
  ])("enforces phone digit and raw length boundaries for %s", (phone, expected) => {
    expect(isValid({ ...validLead, phone })).toBe(expected);
  });

  it("allows an omitted goal and a 300-character goal", () => {
    expect(isValid({ ...validLead, goal: undefined })).toBe(true);
    expect(isValid({ ...validLead, goal: "ц".repeat(300) })).toBe(true);
  });

  it("rejects a goal over 300 characters", () => {
    expect(isValid({ ...validLead, goal: "ц".repeat(301) })).toBe(false);
  });

  it.each([
    ["consent", false],
    ["website", "bot.example"],
    ["startedAt", 0],
    ["startedAt", 1.5],
  ])("rejects invalid %s values", (key, value) => {
    expect(isValid({ ...validLead, [key]: value })).toBe(false);
  });

  it("rejects unknown request keys", () => {
    expect(isValid({ ...validLead, unexpected: "value" })).toBe(false);
  });

  it("requires a Unicode letter and rejects control characters in name and phone", () => {
    expect(isValid({ ...validLead, name: "123456" })).toBe(false);
    expect(isValid({ ...validLead, name: "Анна\nИванова" })).toBe(false);
    expect(isValid({ ...validLead, phone: "123\n4567" })).toBe(false);
  });

  it.each([
    ["name", "\nАнна Иванова"],
    ["name", "Анна Иванова\r"],
    ["phone", "\n1234567"],
    ["phone", "1234567\r"],
  ])("rejects raw leading or trailing control characters in %s", (key, value) => {
    expect(isValid({ ...validLead, [key]: value })).toBe(false);
  });

  it("allows ordinary goal line breaks but rejects other goal control characters", () => {
    expect(isValid({ ...validLead, goal: "Сила\nВыносливость" })).toBe(true);
    expect(isValid({ ...validLead, goal: "Сила\u0001" })).toBe(false);
  });

  it("accepts ordinary goal line breaks before normalizing surrounding whitespace", () => {
    const result = leadSubmitSchema.parse({ ...validLead, goal: "\nСила\r\nВыносливость\n" });

    expect(result.goal).toBe("Сила\r\nВыносливость");
  });
});
