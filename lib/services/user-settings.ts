import { Types } from "mongoose";

import UserModel from "@/models/User";

import {
  hashUserPassword,
  verifyUserPassword,
} from "@/lib/services/user-auth";

export async function updateUserName(input: {
  userId: string;
  name: string;
}) {
  return UserModel.findOneAndUpdate(
    {
      _id: new Types.ObjectId(input.userId),
      isActive: true,
    },
    {
      $set: {
        name: input.name,
      },
    },
    {
      returnDocument: "after",
    },
  );
}

export async function updateUserPassword(input: {
  userId: string;
  currentPassword: string;
  newPassword: string;
}) {
  const user = await UserModel.findOne({
    _id: new Types.ObjectId(input.userId),
    isActive: true,
  });

  if (!user?.passwordHash) {
    throw new Error("Current password is invalid");
  }

  const isCurrentPasswordValid = await verifyUserPassword(
    input.currentPassword,
    user.passwordHash,
  );

  if (!isCurrentPasswordValid) {
    throw new Error("Current password is invalid");
  }

  user.passwordHash = await hashUserPassword(input.newPassword);
  await user.save();

  return user;
}
