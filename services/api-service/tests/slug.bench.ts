import { bench, describe } from "vitest";
import { generateSlug } from "../src/utils/slug.ts";

describe("Slug generation performance", () => {
  bench("generateSlug default length", () => {
    generateSlug();
  });

  bench("generateSlug length 12", () => {
    generateSlug(12);
  });
});
