import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Home from "../../src/app/page";

describe("Home", () => {
  it("renders exactly two top-level main sections", () => {
    render(<Home />);

    expect(screen.getByRole("main").querySelectorAll(":scope > section")).toHaveLength(2);
  });
});
