import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import type { NextAuthConfig } from "next-auth";
import { ensureDefaultAdmin, findUserById, findUserByLogin, verifyPassword } from "@/lib/users";
import type { UserRole } from "@/lib/users";

const providers: NextAuthConfig["providers"] = [
  Credentials({
    name: "credentials",
    credentials: {
      email: { label: "Usuário", type: "text" },
      password: { label: "Senha", type: "password" },
    },
    async authorize(credentials) {
      const login = typeof credentials?.email === "string" ? credentials.email : "";
      const password = typeof credentials?.password === "string" ? credentials.password : "";
      if (!login || !password) return null;

      await ensureDefaultAdmin();
      const user = await findUserByLogin(login);
      if (!user || !verifyPassword(user, password)) return null;

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      };
    },
  }),
];

export const authConfig = {
  providers,
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        if (user.email) token.email = user.email;
        if (user.name) token.name = user.name;
        const role = "role" in user ? (user.role as UserRole) : undefined;
        if (role) token.role = role;
      } else if (typeof token.sub === "string") {
        try {
          const dbUser = await findUserById(token.sub);
          if (dbUser) {
            token.email = dbUser.email;
            token.name = dbUser.name;
            token.role = dbUser.role;
          }
        } catch {
          /* keep the existing token if the store is unavailable */
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        if (typeof token.sub === "string") session.user.id = token.sub;
        if (typeof token.email === "string") session.user.email = token.email;
        if (typeof token.name === "string") session.user.name = token.name;
        session.user.role = token.role === "admin" ? "admin" : "user";
      }
      return session;
    },
  },
  trustHost: true,
} satisfies NextAuthConfig;

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
