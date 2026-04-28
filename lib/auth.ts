import { getServerSession } from "next-auth";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { z } from "zod";

import { connectToDatabase } from "@/lib/db";
import UserModel, { type AuthProvider, type UserRole } from "@/models/User";

const credentialsSchema = z.object({
  mode: z.literal("salesman"),
  email: z.email().trim().toLowerCase(),
  password: z.string().optional(),
});

function getPartnerEmailAllowList() {
  return (process.env.PARTNER_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function getSalesmanCredentials() {
  return {
    email: (process.env.SALESMAN_EMAIL ?? "").trim().toLowerCase(),
    password: process.env.SALESMAN_PASSWORD ?? "",
    name:
      (process.env.SALESMAN_NAME ?? "Default Salesman").trim() ||
      "Default Salesman",
  };
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
        mode: { label: "Mode", type: "text" },
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);

        if (!parsed.success) {
          return null;
        }

        const salesmanCredentials = getSalesmanCredentials();

        if (
          parsed.data.email !== salesmanCredentials.email ||
          !parsed.data.password ||
          parsed.data.password !== salesmanCredentials.password
        ) {
          return null;
        }

        const user = await upsertUser({
          email: salesmanCredentials.email,
          role: "salesman",
          name: salesmanCredentials.name,
          authProvider: "credentials",
        });

        if (!user) {
          return null;
        }

        return {
          id: user._id.toString(),
          email: user.email,
          name: user.name,
          image: user.image ?? undefined,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== "google") {
        return true;
      }

      const email = user.email?.trim().toLowerCase();

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
