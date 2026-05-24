import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
  vi.doUnmock("@/lib/db");
  vi.doUnmock("@/models/User");
  vi.doUnmock("@/lib/services/user-auth");
});

function getCredentialsAuthorize(provider: unknown) {
  const authorize =
    (
      provider as {
        options?: {
          authorize?: (
            credentials: Record<string, string>,
          ) => Promise<unknown>;
        };
      }
    ).options?.authorize ??
    (
      provider as {
        authorize?: (credentials: Record<string, string>) => Promise<unknown>;
      }
    ).authorize;

  if (!authorize) {
    throw new Error("Credentials authorize function not found");
  }

  return authorize;
}

describe("auth options", () => {
  it("authenticates a partner with DB-backed credentials", async () => {
    const user = {
      _id: {
        toString() {
          return "507f1f77bcf86cd799439011";
        },
      },
      email: "partner@example.com",
      name: "Partner One",
      image: null,
      role: "partner",
      isActive: true,
      passwordHash: "hashed-password",
    };

    vi.doMock("@/lib/db", () => ({
      connectToDatabase: vi.fn().mockResolvedValue(undefined),
    }));
    vi.doMock("@/lib/services/user-auth", () => ({
      buildSessionUser: vi.fn().mockReturnValue({
        id: "507f1f77bcf86cd799439011",
        email: "partner@example.com",
        name: "Partner One",
        image: undefined,
        role: "partner",
      }),
      findActiveUserByEmail: vi.fn().mockResolvedValue(user),
      normalizeUserEmail: vi.fn((email: string) => email.trim().toLowerCase()),
      verifyUserPassword: vi.fn().mockResolvedValue(true),
    }));

    const { authOptions } = await import("@/lib/auth");
    const credentialsProvider = authOptions.providers.find(
      (provider) => provider.id === "credentials",
    );

    const authorizedUser = await getCredentialsAuthorize(credentialsProvider)({
      email: "partner@example.com",
      password: "123",
    });

    expect(authorizedUser).toEqual({
      id: "507f1f77bcf86cd799439011",
      email: "partner@example.com",
      name: "Partner One",
      image: undefined,
      role: "partner",
    });
  });

  it("authenticates a salesman with DB-backed credentials", async () => {
    const user = {
      _id: {
        toString() {
          return "507f1f77bcf86cd799439012";
        },
      },
      email: "salesman@example.com",
      name: "Salesman One",
      image: null,
      role: "salesman",
      isActive: true,
      passwordHash: "hashed-password",
    };

    vi.doMock("@/lib/db", () => ({
      connectToDatabase: vi.fn().mockResolvedValue(undefined),
    }));
    vi.doMock("@/lib/services/user-auth", () => ({
      buildSessionUser: vi.fn().mockReturnValue({
        id: "507f1f77bcf86cd799439012",
        email: "salesman@example.com",
        name: "Salesman One",
        image: undefined,
        role: "salesman",
      }),
      findActiveUserByEmail: vi.fn().mockResolvedValue(user),
      normalizeUserEmail: vi.fn((email: string) => email.trim().toLowerCase()),
      verifyUserPassword: vi.fn().mockResolvedValue(true),
    }));

    const { authOptions } = await import("@/lib/auth");
    const credentialsProvider = authOptions.providers.find(
      (provider) => provider.id === "credentials",
    );

    const authorizedUser = await getCredentialsAuthorize(credentialsProvider)({
      email: "salesman@example.com",
      password: "123",
    });

    expect(authorizedUser).toEqual({
      id: "507f1f77bcf86cd799439012",
      email: "salesman@example.com",
      name: "Salesman One",
      image: undefined,
      role: "salesman",
    });
  });

  it("keeps existing password hashes intact during partner Google upsert", async () => {
    const lean = vi.fn().mockResolvedValue({
      _id: {
        toString() {
          return "507f1f77bcf86cd799439011";
        },
      },
      email: "partner@example.com",
      name: "Partner One",
      role: "partner",
      isActive: true,
      passwordHash: "existing-hash",
    });
    const findOne = vi.fn().mockReturnValue({ lean });
    const findOneAndUpdate = vi.fn().mockResolvedValue({
      _id: {
        toString() {
          return "507f1f77bcf86cd799439011";
        },
      },
      email: "partner@example.com",
      name: "Partner One",
      role: "partner",
      isActive: true,
    });

    vi.doMock("@/lib/db", () => ({
      connectToDatabase: vi.fn().mockResolvedValue(undefined),
    }));
    vi.doMock("@/models/User", () => ({
      default: {
        findOne,
        findOneAndUpdate,
      },
    }));

    process.env.PARTNER_EMAILS = "partner@example.com";

    const { authOptions } = await import("@/lib/auth");
    const result = await authOptions.callbacks?.signIn?.({
      user: {
        email: "partner@example.com",
        name: "Partner One",
        image: null,
      },
      account: {
        provider: "google",
        type: "oauth",
        providerAccountId: "google-1",
      },
      profile: undefined,
      email: undefined,
      credentials: undefined,
    });

    expect(result).toBe(true);
    expect(findOne).toHaveBeenCalledWith({ email: "partner@example.com" });
    expect(findOneAndUpdate).toHaveBeenCalledWith(
      { email: "partner@example.com" },
      expect.objectContaining({
        $set: expect.not.objectContaining({
          passwordHash: expect.anything(),
        }),
      }),
      expect.any(Object),
    );
  });
});
