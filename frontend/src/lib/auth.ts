import { NextAuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import { MongoDBAdapter } from "@auth/mongodb-adapter"
import clientPromise from "@/lib/mongodb"

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      authorization: {
        params: {
          scope: "openid email profile https://www.googleapis.com/auth/drive.readonly",
        },
      },
    }),
  ],
  adapter: MongoDBAdapter(clientPromise) as any,
  session: {
    strategy: "database",
  },
  callbacks: {
    async session({ session, user }) {
      if (session?.user && user?.id) {
        session.user.id = user.id
      }
      return session
    },
  },
}
