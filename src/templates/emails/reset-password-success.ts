import { emailLayout } from "./_layout";

export type ResetPasswordSuccessEmailData = {
  firstName?: string;
};

export function resetPasswordSuccessEmail(
  data: ResetPasswordSuccessEmailData & { appName: string }
) {
  const name = (data.firstName ?? "").trim();
  const greeting = name ? `Hi ${escapeHtml(name)},` : "Hi,";

  const subject = `Your ${data.appName} password was changed`;
  const html = emailLayout({
    title: subject,
    preheader: "Password reset successful.",
    bodyHtml: `
      <p style="margin:0 0 12px 0;">${greeting}</p>
      <p style="margin:0 0 12px 0;">
        This is a confirmation that your password was changed successfully.
      </p>
      <p style="margin:0;color:#6b7280;font-size:12px;">
        If you didn’t do this, please contact support immediately.
      </p>
    `,
  });

  const text = `${name ? `Hi ${name},` : "Hi,"}\n\nYour password was changed successfully.`;

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
