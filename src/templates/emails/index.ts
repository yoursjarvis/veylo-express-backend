import { config } from "@/utils/config";

import {
  forgotPasswordEmail,
  type ForgotPasswordEmailData,
} from "./forgot-password";
import { inviteEmail, type InviteEmailData } from "./invite";
import { notificationEmail, type NotificationEmailData } from "./notification";
import {
  resetPasswordSuccessEmail,
  type ResetPasswordSuccessEmailData,
} from "./reset-password-success";
import { twoFactorOtpEmail, type TwoFactorOtpData } from "./two-factor-otp";
import { verifyEmailEmail, type VerifyEmailData } from "./verify-email";
import { welcomeEmail, type WelcomeEmailData } from "./welcome";

export type EmailTemplateMap = {
  welcome: WelcomeEmailData;
  "forgot-password": ForgotPasswordEmailData;
  "reset-password-success": ResetPasswordSuccessEmailData;
  "verify-email": VerifyEmailData;
  "two-factor-otp": TwoFactorOtpData;
  invite: InviteEmailData;
  notification: NotificationEmailData;
};

export type EmailTemplateName = keyof EmailTemplateMap;
export type EmailTemplateData<N extends EmailTemplateName> =
  EmailTemplateMap[N];

export type RenderedEmail = {
  subject: string;
  html: string;
  text?: string;
  headers?: Record<string, string>;
};

export function renderEmail<N extends EmailTemplateName>(
  name: N,
  data: EmailTemplateData<N>,
): RenderedEmail {
  const appName = config("app.name");

  switch (name) {
    case "welcome":
      return welcomeEmail({ ...(data as WelcomeEmailData), appName });
    case "forgot-password":
      return forgotPasswordEmail({
        ...(data as ForgotPasswordEmailData),
        appName,
      });
    case "reset-password-success":
      return resetPasswordSuccessEmail({
        ...(data as ResetPasswordSuccessEmailData),
        appName,
      });
    case "verify-email":
      return verifyEmailEmail({ ...(data as VerifyEmailData), appName });
    case "two-factor-otp":
      return twoFactorOtpEmail({ ...(data as TwoFactorOtpData), appName });
    case "invite":
      return inviteEmail(data as InviteEmailData);
    case "notification":
      return notificationEmail({ ...(data as NotificationEmailData), appName });
    default:
      throw new Error(`Template ${name} not found`);
  }
}
