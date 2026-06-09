import { emailLayout } from "./_layout";

export type TwoFactorOtpData = {
  firstName?: string;
  otp: string;
};

export function twoFactorOtpEmail(data: TwoFactorOtpData & { appName: string }) {
  const name = (data.firstName ?? "").trim();
  const greeting = name ? `Hi ${escapeHtml(name)},` : "Hi,";

  const subject = `[${data.appName}] Verify your identity`;
  const html = emailLayout({
    title: subject,
    preheader: "Your verification code for two-factor authentication.",
    bodyHtml: `
      <p style="margin:0 0 12px 0;">${greeting}</p>
      <p style="margin:0 0 16px 0;">
        You are initiating two-factor authentication enablement. Please use the following code to verify your identity:
      </p>
      <div style="margin: 32px 0; text-align: center; background: #f9fafb; padding: 24px; border-radius: 8px;">
        <span style="font-size: 32px; font-weight: 700; letter-spacing: 4px; color: #111827;">${data.otp}</span>
      </div>
      <p style="margin:16px 0 0 0; font-size: 13px; color: #6b7280;">
        This code will expire in 10 minutes. If you did not request this, please ignore this email.
      </p>
    `,
  });

  const text = `${greeting}\n\nYour verification code for 2FA is: ${data.otp}\n\nThis code will expire in 10 minutes.`;

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
