import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import type { NextAuthConfig } from "next-auth";

export function isGoogleAuthConfigured() {
  return Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
}

const providers: NextAuthConfig["providers"] = [];

if (isGoogleAuthConfigured()) {
  providers.push(
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),
  );
}

export const authConfig = {
  providers,
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account?.provider === "google" && profile) {
        const p = profile as { picture?: string; email?: string; name?: string };
        if (p.picture) token.picture = p.picture;
        if (p.email) token.email = p.email;
        if (p.name) token.name = p.name;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        if (typeof token.picture === "string") session.user.image = token.picture;
        if (typeof token.email === "string") session.user.email = token.email;
        if (typeof token.name === "string") session.user.name = token.name;
      }
      return session;
    },
  },
  trustHost: true,
} satisfies NextAuthConfig;

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
