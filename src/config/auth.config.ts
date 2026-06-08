import { env } from "@/utils/env";

const defaultRedirectOrigin = (() => {
  const origins = env("ALLOWED_ORIGINS").array(",");
  for (const origin of origins) {
    try {
      return new URL(origin).origin;
    } catch {
      // ignore invalid origins; env() validation happens elsewhere
    }
  }

  return new URL(env("APP_URL").string("http://localhost:4000")).origin;
})();

export default {
  betterAuth: {
    secret: env("BETTER_AUTH_SECRET").required(),
    secondaryStorageEnabled: env("AUTH_SECONDARY_STORAGE_ENABLED").boolean(false),
    url: env("BETTER_AUTH_URL").url(env("APP_URL").string("http://localhost:4000")),
    emailVerificationRedirectURL: env("AUTH_EMAIL_VERIFICATION_REDIRECT").url(
      `${defaultRedirectOrigin}/verify-email`
    ),
    resetPasswordRedirectURL: env("AUTH_RESET_PASSWORD_REDIRECT").url(
      `${defaultRedirectOrigin}/reset-password`
    ),
  },
  social: {
    google: {
      clientId: env("GOOGLE_CLIENT_ID").required(),
      clientSecret: env("GOOGLE_CLIENT_SECRET").required(),
      callbackUrl: env("GOOGLE_CALLBACK_URL").required(),
      frontendCallbackUrl: env("FRONTEND_GOOGLE_CALLBACK_URL").required(),
      frontendOrigin: env("FRONTEND_ORIGIN").string("http://localhost:5173"),
    },
  },
};
