import { describe, it, expect } from "vitest";
import { applyTransform } from "jscodeshift/src/testUtils";
import * as fs from "fs";
import * as path from "path";
import transform from "../codemod-readability";

const fixturesDir = path.join(__dirname, "..", "codemod-fixtures");

function loadFixture(name: string) {
  const input = fs.readFileSync(
    path.join(fixturesDir, "input", `${name}.tsx`),
    "utf-8",
  );
  const output = fs.readFileSync(
    path.join(fixturesDir, "output", `${name}.tsx`),
    "utf-8",
  );
  return { input, output };
}

describe("codemod-readability", () => {
  it.each(["01-text-white-translucent", "02-leave-alone", "03-mixed-classes"])(
    "transforms %s correctly",
    (fixtureName) => {
      const { input, output } = loadFixture(fixtureName);
      const result = applyTransform(
        transform,
        {},
        { source: input, path: `${fixtureName}.tsx` },
      );
      expect(result.trim()).toBe(output.trim());
    },
  );
});
