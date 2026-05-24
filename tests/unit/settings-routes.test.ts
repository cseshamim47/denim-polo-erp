import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
  vi.doUnmock("@/lib/auth");
  vi.doUnmock("@/lib/services/user-settings");
});

describe("settings route contracts", () => {
  it("updates the current partner profile name", async () => {
    const updateUserName = vi.fn().mockResolvedValue({
      _id: {
        toString() {
          return "507f1f77bcf86cd799439011";
        },
      },
      name: "Partner Prime",
      email: "partner@example.com",
      role: "partner",
    });

    vi.doMock("@/lib/auth", () => ({
      getRequiredSession: vi.fn().mockResolvedValue({
        user: {
          id: "507f1f77bcf86cd799439011",
          role: "partner",
        },
      }),
    }));
    vi.doMock("@/lib/services/user-settings", () => ({
      updateUserName,
      updateUserPassword: vi.fn(),
    }));

    const { PATCH } = await import("@/app/api/settings/profile/route");
    const response = await PATCH(
      new Request("http://localhost:3000/api/settings/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "  Partner Prime  " }),
      }),
    );

    expect(response.status).toBe(200);
    expect(updateUserName).toHaveBeenCalledWith({
      userId: "507f1f77bcf86cd799439011",
      name: "Partner Prime",
    });
  });

  it("updates the current salesman profile name", async () => {
    const updateUserName = vi.fn().mockResolvedValue({
      _id: {
        toString() {
          return "507f1f77bcf86cd799439012";
        },
      },
      name: "Sales Captain",
      email: "sales@example.com",
      role: "salesman",
    });

    vi.doMock("@/lib/auth", () => ({
      getRequiredSession: vi.fn().mockResolvedValue({
        user: {
          id: "507f1f77bcf86cd799439012",
          role: "salesman",
        },
      }),
    }));
    vi.doMock("@/lib/services/user-settings", () => ({
      updateUserName,
      updateUserPassword: vi.fn(),
    }));

    const { PATCH } = await import("@/app/api/settings/profile/route");
    const response = await PATCH(
      new Request("http://localhost:3000/api/settings/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Sales Captain" }),
      }),
    );

    expect(response.status).toBe(200);
    expect(updateUserName).toHaveBeenCalledWith({
      userId: "507f1f77bcf86cd799439012",
      name: "Sales Captain",
    });
  });

  it("rejects password changes with an invalid current password", async () => {
    const updateUserPassword = vi
      .fn()
      .mockRejectedValue(new Error("Current password is invalid"));

    vi.doMock("@/lib/auth", () => ({
      getRequiredSession: vi.fn().mockResolvedValue({
        user: {
          id: "507f1f77bcf86cd799439011",
          role: "partner",
        },
      }),
    }));
    vi.doMock("@/lib/services/user-settings", () => ({
      updateUserName: vi.fn(),
      updateUserPassword,
    }));

    const { PATCH } = await import("@/app/api/settings/password/route");
    const response = await PATCH(
      new Request("http://localhost:3000/api/settings/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: "wrong",
          newPassword: "new-pass",
          confirmPassword: "new-pass",
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Current password is invalid",
    });
  });

  it("changes password with a valid current password", async () => {
    const updateUserPassword = vi.fn().mockResolvedValue({
      _id: {
        toString() {
          return "507f1f77bcf86cd799439011";
        },
      },
    });

    vi.doMock("@/lib/auth", () => ({
      getRequiredSession: vi.fn().mockResolvedValue({
        user: {
          id: "507f1f77bcf86cd799439011",
          role: "partner",
        },
      }),
    }));
    vi.doMock("@/lib/services/user-settings", () => ({
      updateUserName: vi.fn(),
      updateUserPassword,
    }));

    const { PATCH } = await import("@/app/api/settings/password/route");
    const response = await PATCH(
      new Request("http://localhost:3000/api/settings/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: "123",
          newPassword: "new-pass",
          confirmPassword: "new-pass",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(updateUserPassword).toHaveBeenCalledWith({
      userId: "507f1f77bcf86cd799439011",
      currentPassword: "123",
      newPassword: "new-pass",
    });
  });
});
