import { getServerSession } from "next-auth";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { z } from "zod";

import { connectToDatabase } from "@/lib/db";
import UserModel, { type AuthProvider, type UserRole } from "@/models/User";
import {
  buildSessionUser,
  findActiveUserByEmail,
  normalizeUserEmail,
  verifyUserPassword,
} from "@/lib/services/user-auth";

const credentialsSchema = z.object({
  email: z.email().trim().toLowerCase(),
  password: z.string().trim().min(1),
});

function getPartnerEmailAllowList() {
  return (process.env.PARTNER_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function buildPartnerName(email: string) {
  const localPart = email.split("@")[0] ?? email;

  return localPart
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

async function upsertUser(input: {
  email: string;
  role: UserRole;
  name: string;
  authProvider: AuthProvider;
  image?: string | null;
}) {
  await connectToDatabase();

  const existingUser = await UserModel.findOne({ email: input.email }).lean();

  if (existingUser && !existingUser.isActive) {
    return null;
  }

  return UserModel.findOneAndUpdate(
    { email: input.email },
    {
      $set: {
        name: input.name,
        image: input.image ?? null,
        authProvider: input.authProvider,
        role: input.role,
        isActive: true,
      },
      $setOnInsert: {
        email: input.email,
        passwordHash: null,
      },
    },
    {
      upsert: true,
      returnDocument: "after",
      setDefaultsOnInsert: true,
    },
  );
}

export const authOptions: NextAuthOptions = {
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
    CredentialsProvider({
      name: "ERP Login",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);

        if (!parsed.success) {
          return null;
        }

        await connectToDatabase();

        const user = await findActiveUserByEmail(parsed.data.email);

        if (!user?.passwordHash) {
          return null;
        }

        const isPasswordValid = await verifyUserPassword(
          parsed.data.password,
          user.passwordHash,
        );

        if (!isPasswordValid) {
          return null;
        }

        return buildSessionUser(user);
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== "google") {
        return true;
      }

      const email = normalizeUserEmail(user.email ?? "");

      if (!email) {
        return false;
      }

      if (!getPartnerEmailAllowList().includes(email)) {
        return false;
      }

      const savedUser = await upsertUser({
        email,
        role: "partner",
        name: user.name?.trim() || buildPartnerName(email),
        authProvider: "google",
        image: user.image ?? null,
      });

      return Boolean(savedUser);
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: UserRole }).role;
      }

      if (!token.email) {
        return token;
      }

      await connectToDatabase();

      const dbUser = await UserModel.findOne({
        email: token.email,
        isActive: true,
      }).lean();

      if (!dbUser) {
        return token;
      }

      token.id = dbUser._id.toString();
      token.role = dbUser.role;
      token.name = dbUser.name;
      token.picture = dbUser.image ?? undefined;

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id ?? "";
        session.user.role = token.role;
      }

      return session;
    },
  },
};

export async function getRequiredSession(allowedRoles: UserRole[]) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id || !session.user.role) {
    return null;
  }

  return allowedRoles.includes(session.user.role) ? session : null;
}
