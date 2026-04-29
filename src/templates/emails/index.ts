import { config } from "@/utils/config";
import { forgotPasswordEmail, type ForgotPasswordEmailData } from "./forgot-password";
import { resetPasswordSuccessEmail, type ResetPasswordSuccessEmailData } from "./reset-password-success";
import { verifyEmailEmail, type VerifyEmailData } from "./verify-email";
import { welcomeEmail, type WelcomeEmailData } from "./welcome";

export type EmailTemplateMap = {
  welcome: WelcomeEmailData;
  "forgot-password": ForgotPasswordEmailData;
  "reset-password-success": ResetPasswordSuccessEmailData;
  "verify-email": VerifyEmailData;
};

export type EmailTemplateName = keyof EmailTemplateMap;
export type EmailTemplateData<N extends EmailTemplateName> = EmailTemplateMap[N];

export type RenderedEmail = {
  subject: string;
  html: string;
  text?: string;
  headers?: Record<string, string>;
};

export function renderEmail<N extends EmailTemplateName>(
  name: N,
  data: EmailTemplateData<N>
): RenderedEmail {
  const appName = config("app.name");

  switch (name) {
    case "welcome":
      return welcomeEmail({ ...(data as WelcomeEmailData), appName });
    case "forgot-password":
      return forgotPasswordEmail({ ...(data as ForgotPasswordEmailData), appName });
    case "reset-password-success":
      return resetPasswordSuccessEmail({
        ...(data as ResetPasswordSuccessEmailData),
        appName,
      });
    case "verify-email":
      return verifyEmailEmail({ ...(data as VerifyEmailData), appName });
    default: {
      const exhaustive: never = name;
      throw new Error(`[MAIL] Unknown template: ${String(exhaustive)}`);
    }
  }
}
