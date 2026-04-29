type LayoutInput = {
  title: string;
  preheader?: string;
  bodyHtml: string;
  footerHtml?: string;
};

export function emailLayout(input: LayoutInput): string {
  const preheader = input.preheader
    ? `<span style="display:none!important;opacity:0;color:transparent;height:0;width:0;max-height:0;max-width:0;overflow:hidden;mso-hide:all;visibility:hidden;">${escapeHtml(input.preheader)}</span>`
    : "";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(input.title)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f6f7fb;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;">
    ${preheader}
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f7fb;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:600px;max-width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 10px rgba(17,24,39,0.06);">
            <tr>
              <td style="padding:24px 24px 8px 24px;">
                <h1 style="margin:0;font-size:18px;line-height:1.3;color:#111827;">${escapeHtml(
                  input.title
                )}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 24px 24px 24px;color:#374151;font-size:14px;line-height:1.6;">
                ${input.bodyHtml}
              </td>
            </tr>
            ${
              input.footerHtml
                ? `<tr><td style="padding:16px 24px;color:#6b7280;font-size:12px;line-height:1.5;border-top:1px solid #eef2ff;">${input.footerHtml}</td></tr>`
                : ""
            }
          </table>
          <div style="color:#9ca3af;font-size:12px;line-height:1.5;padding:12px 24px;">
            If you didn’t request this, you can safely ignore this email.
          </div>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function escapeHtml(str: string): string {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

