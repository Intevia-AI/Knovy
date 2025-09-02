/// <reference lib="deno.ns" />
import { handler } from "./index.ts";
import { assertEquals } from "https://deno.land/std@0.177.0/testing/asserts.ts";
import { stub } from "https://deno.land/std@0.177.0/testing/mock.ts";

Deno.test("ai-action-keyword-search handler", async (t) => {
  let envStub: any;
  let fetchStub: any;

  const setup = (envValue: string | undefined, fetchResponse: any) => {
    envStub = stub(Deno.env, "get", (key) => {
      if (key === "GOOGLE_GENERATIVE_AI_API_KEY") {
        return envValue;
      }
      return undefined;
    });
    fetchStub = stub(globalThis, "fetch", () => Promise.resolve(fetchResponse));
  };

  const teardown = () => {
    envStub.restore();
    fetchStub.restore();
  };

  await t.step("OPTIONS preflight request", async () => {
    const req = new Request("http://localhost/ai-action-keyword-search", { method: "OPTIONS" });
    const response = await handler(req);
    assertEquals(response.status, 200);
    assertEquals(response.headers.get("Access-Control-Allow-Origin"), "*");
  });

  await t.step("Successful keyword extraction", async () => {
    setup("test_api_key", {
      ok: true,
      json: () =>
        Promise.resolve({
          candidates: [
            {
              content: {
                parts: [{ text: '```json\n[\"Deno\", \"TypeScript\", \"testing\"]\n```' }],
              },
            },
          ],
        }),
    });

    const req = new Request("http://localhost/ai-action-keyword-search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "Deno is a modern runtime for JavaScript and TypeScript." }),
    });

    const response = await handler(req);
    const body = await response.json();

    assertEquals(response.status, 200);
    assertEquals(body.keywords, ["Deno", "TypeScript", "testing"]);

    teardown();
  });

  await t.step("Missing text in request body", async () => {
    setup("test_api_key", { ok: true });

    const req = new Request("http://localhost/ai-action-keyword-search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const response = await handler(req);
    const body = await response.json();

    assertEquals(response.status, 400);
    assertEquals(body.error, "Text is required");

    teardown();
  });

  await t.step("Missing API key environment variable", async () => {
    setup(undefined, { ok: true });

    const req = new Request("http://localhost/ai-action-keyword-search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "Some text" }),
    });

    const response = await handler(req);
    const body = await response.json();

    assertEquals(response.status, 500);
    assertEquals(body.error, "Internal Server Error");

    teardown();
  });

  await t.step("Gemini API request failed", async () => {
    setup("test_api_key", {
      ok: false,
      status: 500,
      text: () => Promise.resolve("Internal Server Error"),
    });

    const req = new Request("http://localhost/ai-action-keyword-search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "Some text" }),
    });

    const response = await handler(req);
    const body = await response.json();

    assertEquals(response.status, 500);
    assertEquals(body.error, "Internal Server Error");

    teardown();
  });
});
