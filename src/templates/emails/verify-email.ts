import { emailLayout } from "./_layout";

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
      <p style="margin:0 0 12px 0;">${greeting}</p>
      <p style="margin:0 0 16px 0;">
        Please verify your email address to finish setting up your account.
      </p>
      <p style="margin:0 0 20px 0;">
        <a href="${escapeHtml(data.verifyUrl)}"
           style="display:inline-block;background:#16a34a;color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:10px;font-weight:600;">
           Verify Email
        </a>
      </p>
      <p style="margin:0 0 6px 0;color:#6b7280;font-size:12px;">
        Or copy and paste this link into your browser:
      </p>
      <p style="margin:0;word-break:break-all;font-size:12px;">
        <a href="${escapeHtml(data.verifyUrl)}" style="color:#16a34a;">${escapeHtml(
          data.verifyUrl
        )}</a>
      </p>
    `,
  });

  const text = `${name ? `Hi ${name},` : "Hi,"}\n\nVerify your email: ${data.verifyUrl}`;

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
