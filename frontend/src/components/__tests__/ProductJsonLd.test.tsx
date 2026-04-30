/**
 * 🧪 ProductJsonLd Tests — Schema.org Product + Offers (pricing v2)
 */

import { describe, it, expect } from "vitest";
import { buildProductJsonLd } from "../ProductJsonLd";

describe("buildProductJsonLd", () => {
  it("returns a Schema.org Product object with the right @context and @type", () => {
    const jsonLd = buildProductJsonLd();
    expect(jsonLd["@context"]).toBe("https://schema.org");
    expect(jsonLd["@type"]).toBe("Product");
    expect(jsonLd.name).toBe("DeepSight");
  });

  it("exposes exactly 3 offers (Free, Pro, Expert)", () => {
    const jsonLd = buildProductJsonLd();
    expect(Array.isArray(jsonLd.offers)).toBe(true);
    expect(jsonLd.offers).toHaveLength(3);
    const names = jsonLd.offers.map((o) => o.name);
    expect(names).toEqual(["Gratuit", "Pro", "Expert"]);
  });

  it("uses pricing v2: Pro = 8.99 EUR/month", () => {
    const jsonLd = buildProductJsonLd();
    const proOffer = jsonLd.offers.find((o) => o.name === "Pro");
    expect(proOffer).toBeDefined();
    expect(proOffer!.price).toBe("8.99");
    expect(proOffer!.priceCurrency).toBe("EUR");
    expect(proOffer!.priceSpecification.unitText).toBe("MONTH");
  });

  it("uses pricing v2: Expert = 19.99 EUR/month", () => {
    const jsonLd = buildProductJsonLd();
    const expertOffer = jsonLd.offers.find((o) => o.name === "Expert");
    expect(expertOffer).toBeDefined();
    expect(expertOffer!.price).toBe("19.99");
    expect(expertOffer!.priceCurrency).toBe("EUR");
    expect(expertOffer!.priceSpecification.unitText).toBe("MONTH");
  });

  it("does NOT contain any v0 legacy price (4.99 or 9.99) as offer values", () => {
    // We check actual price *values*, not substrings, so 19.99 (Expert) is not
    // mistakenly flagged for containing the substring "9.99".
    const jsonLd = buildProductJsonLd();
    const allPriceValues = jsonLd.offers.flatMap((o) => [
      o.price,
      o.priceSpecification.price,
    ]);
    expect(allPriceValues).not.toContain("4.99");
    expect(allPriceValues).not.toContain("9.99");
  });

  it("includes an aggregateRating (4.8 / 127 reviews) for rich snippets", () => {
    const jsonLd = buildProductJsonLd();
    expect(jsonLd.aggregateRating).toBeDefined();
    expect(jsonLd.aggregateRating!["@type"]).toBe("AggregateRating");
    expect(jsonLd.aggregateRating!.ratingValue).toBe("4.8");
    expect(jsonLd.aggregateRating!.reviewCount).toBe("127");
  });
});
