import NextAuth, { type NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET;

// Fail loudly if a production runtime is missing its signing secret or OAuth
// credentials, instead of silently booting with a derived key / placeholder
// creds (which would let an operator ship forgeable sessions or a broken login
// without noticing). Skipped during `next build`, which runs with NODE_ENV=
// production but no secrets injected (see Dockerfile), and in dev where the
// placeholders below keep local boot working.
if (process.env.NODE_ENV === "production" && process.env.NEXT_PHASE !== "phase-production-build") {
  if (!NEXTAUTH_SECRET) {
    throw new Error("NEXTAUTH_SECRET is required in production");
  }
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new Error("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required in production");
  }
}

export const authOptions: NextAuthOptions = {
  secret: NEXTAUTH_SECRET,
  providers: [
    GoogleProvider({
      clientId: GOOGLE_CLIENT_ID ?? "placeholder-client-id",
      clientSecret: GOOGLE_CLIENT_SECRET ?? "placeholder-client-secret",
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
        },
      },
    }),
  ],
  callbacks: {
    // Reject Google id_tokens that don't assert a verified email. Without this,
    // an attacker controlling any OIDC IdP that returns email='owner@example.com'
    // with email_verified=false would be admitted as that user.
    async signIn({ account, profile }) {
      if (account?.provider !== "google") return true;
      const googleProfile = profile as { email_verified?: boolean } | undefined;
      return googleProfile?.email_verified === true;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
};

export default NextAuth(authOptions);
