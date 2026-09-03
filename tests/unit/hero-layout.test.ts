import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const heroStylesPath = resolve("src/components/landing/HeroSection.module.css");

function declarationsFor(source: string, selector: string) {
  return new RegExp(`${selector}\\s*\\{([^}]*)\\}`, "u").exec(source)?.[1];
}

describe("wide hero portrait layout", () => {
  it("keeps the approved 1440 expansion and neutralizes it from 1600px", async () => {
    const styles = await readFile(heroStylesPath, "utf8");
    const desktopImage = declarationsFor(styles, "\\.image");
    const wideBlock = /@media \(min-width: 1600px\)\s*\{([\s\S]*?)\n\}/u.exec(styles)?.[1];
    const wideImage = wideBlock ? declarationsFor(wideBlock, "\\.image") : undefined;

    expect(desktopImage).toContain("inline-size: calc(100% + 7rem)");
    expect(desktopImage).toContain("margin-inline-start: -7rem");
    expect(wideImage).toContain("inline-size: 100%");
    expect(wideImage).toContain("margin-inline-start: 0");
  });
});
