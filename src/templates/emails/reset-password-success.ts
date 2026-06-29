import { emailLayout, escapeHtml } from "./_layout";

export type ResetPasswordSuccessEmailData = {
  firstName?: string;
};

export function resetPasswordSuccessEmail(
  data: ResetPasswordSuccessEmailData & { appName: string },
) {
  const name = (data.firstName ?? "").trim();
  const greeting = name ? `Hi ${escapeHtml(name)},` : "Hi,";
  const subject = `Your ${data.appName} password was changed`;

  const html = emailLayout({
    title: subject,
    preheader: "Password reset successful.",
    bodyHtml: `
      <p style="margin:0 0 16px 0;">${greeting}</p>
      <p style="margin:0 0 24px 0;">
        This is a confirmation that your password for <strong>${escapeHtml(data.appName)}</strong> was changed successfully.
      </p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0;background-color:#f5f5f5;border:1px solid #e5e5e5;border-radius:8px;" class="email-warning-box">
        <tr>
          <td style="padding:16px;font-size:12px;color:#737373;line-height:1.5;" class="email-text">
            <strong>Security Notice:</strong> If you did not make this change, please contact our support team immediately or reset your password to secure your account.
          </td>
        </tr>
      </table>
    `,
  });

  const text = `${name ? `Hi ${name},` : "Hi,"}\n\nYour password was changed successfully.`;

  return { subject, html, text };
}
