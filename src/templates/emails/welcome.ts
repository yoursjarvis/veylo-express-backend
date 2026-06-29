import { emailLayout, escapeHtml } from "./_layout";

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
      <p style="margin:0 0 16px 0;">${greeting}</p>
      <p style="margin:0 0 24px 0;">
        Thanks for signing up for <strong>${escapeHtml(data.appName)}</strong>. We’re excited to have you on board.
      </p>
      <p style="margin:0 0 12px 0;font-weight:500;">Here are a few next steps to get started:</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 24px 0;">
        <tr>
          <td style="padding:10px 0;border-bottom:1px dashed #e5e5e5;color:#404040;" class="email-footer">
            <span style="font-weight:500;color:#171717;" class="email-title">1. Setup Profile</span> &mdash; Complete your personal information
          </td>
        </tr>
        <tr>
          <td style="padding:10px 0;border-bottom:1px dashed #e5e5e5;color:#404040;" class="email-footer">
            <span style="font-weight:500;color:#171717;" class="email-title">2. Invite Team</span> &mdash; Add your collaborators to your workspace
          </td>
        </tr>
        <tr>
          <td style="padding:10px 0;color:#404040;">
            <span style="font-weight:500;color:#171717;" class="email-title">3. Explore Dashboard</span> &mdash; Check out features and start building
          </td>
        </tr>
      </table>
    `,
  });

  const text = `${name ? `Hi ${name},` : "Hi,"}\n\nThanks for signing up for ${data.appName}. We're excited to have you on board.`;

  return { subject, html, text };
}
