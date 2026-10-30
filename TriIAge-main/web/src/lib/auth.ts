import "server-only";

import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { redirect } from "next/navigation";
import { verifyDemoUser } from "./demo-users";
import { isRole, type Role } from "./roles";

/** Expira após 15 minutos sem atividade (RNF11). */
const SESSION_MAX_AGE = 15 * 60;

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE, updateAge: 60 },
  jwt: { maxAge: SESSION_MAX_AGE },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "TriIAge",
      credentials: {
        email: { label: "E-mail", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      authorize(credentials) {
        if (!credentials?.email || !credentials.password) return null;
        return verifyDemoUser(credentials.email, credentials.password);
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) token.role = user.role;
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.role = token.role;
      }
      return session;
    },
  },
};

export type CurrentUser = {
  id: string;
  name: string;
  role: Role;
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await getServerSession(authOptions);
  const user = session?.user;
  if (!user || !isRole(user.role)) return null;
  return { id: user.id, name: user.name ?? "", role: user.role };
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
