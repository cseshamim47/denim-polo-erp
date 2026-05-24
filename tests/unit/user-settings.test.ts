import { describe, expect, it } from "vitest";

import {
  parsePasswordSettingsInput,
  parseProfileSettingsInput,
} from "@/lib/domain/settings";

describe("user settings validation", () => {
  it("trims profile names and rejects empty values", () => {
    expect(parseProfileSettingsInput({ name: "  Partner One  " })).toEqual({
      name: "Partner One",
    });

    expect(() => parseProfileSettingsInput({ name: "   " })).toThrow(
      "Name is required",
    );
  });

  it("requires old password for password changes", () => {
    expect(() =>
      parsePasswordSettingsInput({
        currentPassword: "",
        newPassword: "new-pass",
        confirmPassword: "new-pass",
      }),
    ).toThrow("Current password is required");
  });

  it("requires a non-empty new password", () => {
    expect(() =>
      parsePasswordSettingsInput({
        currentPassword: "123",
        newPassword: "   ",
        confirmPassword: "   ",
      }),
    ).toThrow("New password is required");
  });

  it("requires matching password confirmation", () => {
    expect(() =>
      parsePasswordSettingsInput({
        currentPassword: "123",
        newPassword: "new-pass",
        confirmPassword: "other-pass",
      }),
    ).toThrow("New password confirmation does not match");
  });
});
