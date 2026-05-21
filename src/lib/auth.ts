import NextAuth, { type NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET;

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
