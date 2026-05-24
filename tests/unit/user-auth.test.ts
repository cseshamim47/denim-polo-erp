import { describe, expect, it } from "vitest";

import {
  buildSessionUser,
  hashUserPassword,
  verifyUserPassword,
} from "@/lib/services/user-auth";

describe("user auth helpers", () => {
  it("hashes plaintext passwords before storage", async () => {
    const hash = await hashUserPassword("123");

    expect(hash).not.toBe("123");
    expect(hash.length).toBeGreaterThan(20);
  });

  it("accepts a matching password for an existing hash", async () => {
    const hash = await hashUserPassword("123");

    await expect(verifyUserPassword("123", hash)).resolves.toBe(true);
  });

  it("rejects a non-matching password", async () => {
    const hash = await hashUserPassword("123");

    await expect(verifyUserPassword("456", hash)).resolves.toBe(false);
  });

  it("builds a stable session-safe user payload", () => {
    const result = buildSessionUser({
      _id: {
        toString() {
          return "507f1f77bcf86cd799439011";
        },
      },
      email: "partner@example.com",
      name: "Partner One",
      image: null,
      role: "partner",
    });

    expect(result).toEqual({
      id: "507f1f77bcf86cd799439011",
      email: "partner@example.com",
      name: "Partner One",
      image: undefined,
      role: "partner",
    });
  });
});
