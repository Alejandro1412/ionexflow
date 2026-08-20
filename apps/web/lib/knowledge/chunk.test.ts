import { describe, expect, it } from "vitest";
import { chunkDocumentText, scoreChunk, tokenize } from "@/lib/knowledge/chunk";

describe("knowledge chunking", () => {
  it("keeps short docs as one chunk", () => {
    expect(chunkDocumentText("hola mundo")).toEqual(["hola mundo"]);
  });

  it("splits long docs", () => {
    const text = "alpha. ".repeat(400);
    const chunks = chunkDocumentText(text, { size: 200, overlap: 20 });
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join("").length).toBeGreaterThan(100);
  });

  it("scores relevant chunks higher", () => {
    const q = "política de reembolsos cliente enojado";
    const good = scoreChunk(q, "Nuestra política de reembolsos permite 14 días");
    const bad = scoreChunk(q, "El menú del restaurante incluye pizza");
    expect(good).toBeGreaterThan(bad);
  });

  it("tokenizes spanish", () => {
    expect(tokenize("Reembolsos y política")).toContain("reembolsos");
  });
});
