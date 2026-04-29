import { emailLayout } from "./_layout";

export type WelcomeEmailData = {
  firstName?: string;
};

export function welcomeEmail(data: WelcomeEmailData & { appName: string }) {
  const name = (data.firstName ?? "").trim();
  const greeting = name ? `Hi ${escapeHtml(name)},` : "Hi,";

  const subject = `Welcome to ${data.appName}`;
  const html = emailLayout({
    title: subject,
    preheader: "Your account has been created.",
    bodyHtml: `
      <p style="margin:0 0 12px 0;">${greeting}</p>
      <p style="margin:0 0 12px 0;">
        Thanks for signing up for <strong>${escapeHtml(data.appName)}</strong>.
      </p>
      <p style="margin:0;">
        We’re excited to have you on board.
      </p>
    `,
  });

  const text = `${name ? `Hi ${name},` : "Hi,"}\n\nThanks for signing up for ${data.appName}.`;

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
