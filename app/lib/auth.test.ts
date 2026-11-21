import { afterEach, describe, expect, it, vi } from "vitest";

import { login, readErrorMessage, register } from "./auth";

afterEach(() => {
  vi.unstubAllGlobals();
});

function jsonRes(body: unknown, status = 400): Response {
  return new Response(JSON.stringify(body), { status });
}

describe("readErrorMessage", () => {
  it("returns the error string from a JSON body", async () => {
    expect(await readErrorMessage(jsonRes({ error: "nope" }), "fb")).toBe(
      "nope"
    );
  });

  it("returns the fallback when error is absent or null", async () => {
    expect(await readErrorMessage(jsonRes({}), "fb")).toBe("fb");
    expect(await readErrorMessage(jsonRes({ message: "x" }), "fb")).toBe("fb");
    expect(await readErrorMessage(jsonRes({ error: null }), "fb")).toBe("fb");
  });

  it("keeps an empty error string (?? semantics, not truthiness)", async () => {
    expect(await readErrorMessage(jsonRes({ error: "" }), "fb")).toBe("");
  });

  it("returns the fallback for non-JSON, empty and null bodies", async () => {
    expect(
      await readErrorMessage(new Response("<html>oops</html>", { status: 502 }), "fb")
    ).toBe("fb");
    expect(await readErrorMessage(new Response("", { status: 500 }), "fb")).toBe(
      "fb"
    );
    expect(await readErrorMessage(new Response("null", { status: 500 }), "fb")).toBe(
      "fb"
    );
  });

  it("returns the fallback and does not throw when json() rejects", async () => {
    const res = {
      status: 500,
      json: () => Promise.reject(new Error("boom")),
    } as unknown as Response;
    await expect(readErrorMessage(res, "fb")).resolves.toBe("fb");
  });

  it("ignores the status code", async () => {
    expect(await readErrorMessage(jsonRes({ error: "x" }, 500), "fb")).toBe("x");
    expect(await readErrorMessage(jsonRes({ error: "x" }, 404), "fb")).toBe("x");
  });
});

describe("login / register error messages", () => {
  it("login uses the body error, else 'Login failed'", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonRes({ error: "bad creds" }, 401)));
    await expect(login("a@b.c", "pw")).rejects.toThrow(new Error("bad creds"));
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html/>", { status: 500 })));
    await expect(login("a@b.c", "pw")).rejects.toThrow(new Error("Login failed"));
  });

  it("register uses the body error, else 'Registration failed'", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonRes({ error: "taken" }, 409)));
    await expect(register("a@b.c", "pw")).rejects.toThrow(new Error("taken"));
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html/>", { status: 500 })));
    await expect(register("a@b.c", "pw")).rejects.toThrow(
      new Error("Registration failed")
    );
  });
});
