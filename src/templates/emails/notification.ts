import { emailLayout } from "./_layout";

export type NotificationEmailData = {
  title: string;
  message: string;
};

export function notificationEmail(data: NotificationEmailData & { appName: string }) {
  const subject = `[${data.appName}] ${data.title}`;
  const html = emailLayout({
    title: data.title,
    preheader: data.message.slice(0, 100),
    bodyHtml: `
      <p style="margin:0 0 12px 0; font-size: 16px; font-weight: bold; color: #1f2937;">
        ${escapeHtml(data.title)}
      </p>
      <p style="margin:0 0 16px 0; font-size: 14px; line-height: 1.5; color: #4b5563;">
        ${escapeHtml(data.message)}
      </p>
      <p style="margin:0; font-size: 12px; color: #9ca3af;">
        You received this because you enabled email notifications for your Veylo account.
      </p>
    `,
  });

  return { subject, html, text: data.message };
}

function escapeHtml(str: string): string {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
