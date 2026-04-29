import { emailLayout } from "./_layout";

export type ForgotPasswordEmailData = {
  firstName?: string;
  resetUrl: string;
};

export function forgotPasswordEmail(
  data: ForgotPasswordEmailData & { appName: string }
) {
  const name = (data.firstName ?? "").trim();
  const greeting = name ? `Hi ${escapeHtml(name)},` : "Hi,";

  const subject = `Reset your ${data.appName} password`;
  const html = emailLayout({
    title: subject,
    preheader: "Use the link to reset your password.",
    bodyHtml: `
      <p style="margin:0 0 12px 0;">${greeting}</p>
      <p style="margin:0 0 16px 0;">
        We received a request to reset your password. Click the button below to continue:
      </p>
      <p style="margin:0 0 20px 0;">
        <a href="${escapeHtml(data.resetUrl)}"
           style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:10px;font-weight:600;">
           Reset Password
        </a>
      </p>
      <p style="margin:0 0 6px 0;color:#6b7280;font-size:12px;">
        Or copy and paste this link into your browser:
      </p>
      <p style="margin:0;word-break:break-all;font-size:12px;">
        <a href="${escapeHtml(data.resetUrl)}" style="color:#4f46e5;">${escapeHtml(
          data.resetUrl
        )}</a>
      </p>
    `,
  });

  const text = `${name ? `Hi ${name},` : "Hi,"}\n\nReset your password: ${data.resetUrl}`;

  return { subject, html, text };
}

function escapeHtml(str: string): string {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
