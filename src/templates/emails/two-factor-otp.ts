import { emailLayout, escapeHtml } from "./_layout";

export type TwoFactorOtpData = {
  firstName?: string;
  otp: string;
};

export function twoFactorOtpEmail(
  data: TwoFactorOtpData & { appName: string },
) {
  const name = (data.firstName ?? "").trim();
  const greeting = name ? `Hi ${escapeHtml(name)},` : "Hi,";
  const subject = `[${data.appName}] Verify your identity`;

  const html = emailLayout({
    title: subject,
    preheader: "Your verification code for two-factor authentication.",
    bodyHtml: `
      <p style="margin:0 0 16px 0;">${greeting}</p>
      <p style="margin:0 0 24px 0;">
        Please use the verification code below to complete two-factor authentication setup or verification:
      </p>
      <div class="email-code-box" style="margin:24px 0;text-align:center;background-color:#f5f5f5;border:1px solid #e5e5e5;padding:24px;border-radius:8px;">
        <span style="font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:32px;font-weight:700;letter-spacing:6px;color:#171717;">${escapeHtml(data.otp)}</span>
      </div>
      <p style="margin:0;font-size:13px;color:#737373;line-height:1.5;" class="email-footer">
        This code is valid for 10 minutes. If you did not request this code, please secure your account credentials.
      </p>
    `,
  });

  const text = `${name ? `Hi ${name},` : "Hi,"}\n\nYour verification code is: ${data.otp}\n\nThis code will expire in 10 minutes.`;

  return { subject, html, text };
}
