import { emailLayout, escapeHtml } from "./_layout";

export type ForgotPasswordEmailData = {
  firstName?: string;
  resetUrl: string;
};

export function forgotPasswordEmail(
  data: ForgotPasswordEmailData & { appName: string },
) {
  const name = (data.firstName ?? "").trim();
  const greeting = name ? `Hi ${escapeHtml(name)},` : "Hi,";
  const subject = `Reset your ${data.appName} password`;

  const html = emailLayout({
    title: subject,
    preheader: "Use the link to reset your password.",
    bodyHtml: `
      <p style="margin:0 0 16px 0;">${greeting}</p>
      <p style="margin:0 0 24px 0;">
        We received a request to reset your password. Click the button below to secure a new password for your account:
      </p>
      <p style="margin:0 0 24px 0;text-align:center;">
        <a href="${escapeHtml(data.resetUrl)}" class="email-button"
           style="display:inline-block;background-color:#171717;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:500;font-size:14px;">
           Reset Password
        </a>
      </p>
      <p style="margin:0 0 8px 0;color:#737373;font-size:12px;" class="email-footer">
        Or copy and paste this link into your browser:
      </p>
      <div class="email-code-box" style="margin:0;background-color:#f5f5f5;border:1px solid #e5e5e5;padding:12px;border-radius:6px;word-break:break-all;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:12px;line-height:1.4;">
        <a href="${escapeHtml(data.resetUrl)}" class="email-link" style="color:#171717;text-decoration:none;">${escapeHtml(data.resetUrl)}</a>
      </div>
    `,
  });

  const text = `${name ? `Hi ${name},` : "Hi,"}\n\nReset your password: ${data.resetUrl}`;

  return { subject, html, text };
}
