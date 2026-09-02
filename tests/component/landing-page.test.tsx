import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import Home from "../../src/app/page";

afterEach(cleanup);

describe("Home", () => {
  it("renders exactly two top-level main sections", () => {
    render(<Home />);

    expect(screen.getByRole("main").querySelectorAll(":scope > section")).toHaveLength(2);
  });

  it("renders the approved two-screen landing structure from centralized content", () => {
    render(<Home />);

    const main = screen.getByRole("main");
    const sections = main.querySelectorAll(":scope > section");
    const hero = sections.item(0);

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("Сила становится стилем");
    expect(hero.querySelector("header")).not.toBeNull();
    expect(screen.getByRole("link", { name: "Начать персонально" }).getAttribute("href")).toBe(
      "#lead-form",
    );
    expect(screen.getByTestId("process-steps").querySelectorAll("li")).toHaveLength(3);
    expect(main.querySelectorAll(":scope > section")).toHaveLength(2);
  });

  it("does not publish unsupported numerical marketing claims", () => {
    render(<Home />);

    expect(screen.getByRole("main").textContent).not.toMatch(
      /\b(?:\d+%|\d+\s*(?:лет|клиент(?:ов|а)?|кг))\b/i,
    );
  });
});
