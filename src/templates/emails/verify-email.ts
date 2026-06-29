import { emailLayout, escapeHtml } from "./_layout";

export type VerifyEmailData = {
  firstName?: string;
  verifyUrl: string;
};

export function verifyEmailEmail(data: VerifyEmailData & { appName: string }) {
  const name = (data.firstName ?? "").trim();
  const greeting = name ? `Hi ${escapeHtml(name)},` : "Hi,";
  const subject = `Verify your email for ${data.appName}`;

  const html = emailLayout({
    title: subject,
    preheader: "Confirm your email to finish setup.",
    bodyHtml: `
      <p style="margin:0 0 16px 0;">${greeting}</p>
      <p style="margin:0 0 24px 0;">
        Please verify your email address to finish setting up your account and gain full access:
      </p>
      <p style="margin:0 0 24px 0;text-align:center;">
        <a href="${escapeHtml(data.verifyUrl)}" class="email-button"
           style="display:inline-block;background-color:#171717;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:500;font-size:14px;">
           Verify Email
        </a>
      </p>
      <p style="margin:0 0 8px 0;color:#737373;font-size:12px;" class="email-footer">
        Or copy and paste this link into your browser:
      </p>
      <div class="email-code-box" style="margin:0;background-color:#f5f5f5;border:1px solid #e5e5e5;padding:12px;border-radius:6px;word-break:break-all;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:12px;line-height:1.4;">
        <a href="${escapeHtml(data.verifyUrl)}" class="email-link" style="color:#171717;text-decoration:none;">${escapeHtml(data.verifyUrl)}</a>
      </div>
    `,
  });

  const text = `${name ? `Hi ${name},` : "Hi,"}\n\nVerify your email: ${data.verifyUrl}`;

  return { subject, html, text };
}
