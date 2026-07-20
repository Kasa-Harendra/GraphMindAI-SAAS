declare namespace NodeJS {
  interface ProcessEnv {
    MONGODB_URI: string;
    GOOGLE_CLIENT_ID: string;
    GOOGLE_CLIENT_SECRET: string;
    NEXTAUTH_SECRET: string;
    NEXTAUTH_URL: string;
    NEXT_PUBLIC_API_URL: string;
  }
}
