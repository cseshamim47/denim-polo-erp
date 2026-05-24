import { z } from "zod";

const profileSettingsSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
});

const passwordSettingsSchema = z
  .object({
    currentPassword: z.string().trim().min(1, "Current password is required"),
    newPassword: z.string().trim().min(1, "New password is required"),
    confirmPassword: z.string().trim(),
  })
  .superRefine((value, context) => {
    if (!value.confirmPassword) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "New password confirmation does not match",
        path: ["confirmPassword"],
      });
      return;
    }

    if (value.confirmPassword !== value.newPassword) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "New password confirmation does not match",
        path: ["confirmPassword"],
      });
    }
  });

export function parseProfileSettingsInput(input: unknown) {
  return profileSettingsSchema.parse(input);
}

export function parsePasswordSettingsInput(input: unknown) {
  return passwordSettingsSchema.parse(input);
}
