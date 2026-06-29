import { emailLayout, escapeHtml } from "./_layout";

export type NotificationEmailData = {
  title: string;
  message: string;
};

export function notificationEmail(
  data: NotificationEmailData & { appName: string },
) {
  const subject = `[${data.appName}] ${data.title}`;
  const html = emailLayout({
    title: data.title,
    preheader: data.message.slice(0, 100),
    bodyHtml: `
      <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#171717;" class="email-title">
        ${escapeHtml(data.title)}
      </p>
      <p style="margin:0 0 24px 0;font-size:14px;line-height:1.6;color:#404040;" class="email-text">
        ${escapeHtml(data.message)}
      </p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0;border-top:1px solid #e5e5e5;padding-top:16px;" class="email-footer">
        <tr>
          <td style="font-size:12px;color:#737373;line-height:1.5;">
            You received this because you enabled email notifications for your ${escapeHtml(data.appName)} account.
          </td>
        </tr>
      </table>
    `,
  });

  return { subject, html, text: data.message };
}
