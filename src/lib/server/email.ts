import "server-only";

import { Resend } from "resend";

export type StreamingChangeItem = {
  tmdbId: number;
  title: string;
  releaseYear: number | null;
  posterUrl: string | null;
  newProviderNames: string[];
};

function providerList(names: string[]): string {
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

function renderItemHtml(item: StreamingChangeItem): string {
  const year = item.releaseYear ? ` (${item.releaseYear})` : "";
  const providers = providerList(item.newProviderNames);

  const posterHtml = item.posterUrl
    ? `<img src="${item.posterUrl}" alt="${item.title}" width="48" height="72" style="border-radius:6px;object-fit:cover;flex-shrink:0;" />`
    : `<div style="width:48px;height:72px;border-radius:6px;background:#1a1a1a;flex-shrink:0;"></div>`;

  return `
    <tr>
      <td style="padding:12px 0;border-bottom:1px solid #1f1f1f;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td width="60" valign="top" style="padding-right:14px;">
              ${posterHtml}
            </td>
            <td valign="top">
              <p style="margin:0 0 2px;font-size:15px;font-weight:600;color:#f5f5f5;">${item.title}<span style="font-weight:400;color:#737373;">${year}</span></p>
              <p style="margin:0;font-size:13px;color:#a3a3a3;">Now on <strong style="color:#e5e5e5;">${providers}</strong></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
}

function buildDigestHtml(items: StreamingChangeItem[], appUrl: string): string {
  const count = items.length;
  const headline =
    count === 1
      ? `<strong>${items[0].title}</strong> is now streaming somewhere new.`
      : `<strong>${count} titles</strong> from your lists hit new streaming platforms.`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>New on streaming</title>
</head>
<body style="margin:0;padding:0;background:#0d0d0d;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#0d0d0d;">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:520px;">

        <!-- header -->
        <tr>
          <td style="padding-bottom:28px;">
            <p style="margin:0 0 16px;font-size:13px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;color:#525252;">24p</p>
            <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#f5f5f5;line-height:1.3;">${headline}</h1>
            <p style="margin:0;font-size:14px;color:#737373;">Titles from your watchlists that arrived on new platforms today.</p>
          </td>
        </tr>

        <!-- items -->
        <tr>
          <td>
            <table cellpadding="0" cellspacing="0" border="0" width="100%">
              ${items.map(renderItemHtml).join("")}
            </table>
          </td>
        </tr>

        <!-- cta -->
        <tr>
          <td style="padding-top:28px;">
            <a href="${appUrl}" style="display:inline-block;padding:11px 22px;background:#f5f5f5;color:#0d0d0d;font-size:14px;font-weight:600;border-radius:10px;text-decoration:none;">Open 24p</a>
          </td>
        </tr>

        <!-- footer -->
        <tr>
          <td style="padding-top:32px;border-top:1px solid #1f1f1f;margin-top:32px;">
            <p style="margin:0;font-size:12px;color:#404040;">
              You're receiving this because you opted in to streaming notifications on 24p.<br />
              <a href="${appUrl}/settings" style="color:#525252;">Manage notification preferences</a>
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

function buildDigestText(items: StreamingChangeItem[], appUrl: string): string {
  const lines = items.map((item) => {
    const year = item.releaseYear ? ` (${item.releaseYear})` : "";
    return `• ${item.title}${year} — now on ${providerList(item.newProviderNames)}`;
  });
  return [
    "New on streaming — 24p",
    "",
    "Titles from your lists that hit new streaming platforms today:",
    "",
    ...lines,
    "",
    `Open 24p: ${appUrl}`,
    "",
    `Manage notifications: ${appUrl}/settings`,
  ].join("\n");
}

export async function sendStreamingDigest(to: string, items: StreamingChangeItem[]): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "24p <notifications@24p.mov>";
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://24p.mov").replace(/\/$/, "");

  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY not set — skipping email to", to);
    return;
  }
  if (!items.length) return;

  const resend = new Resend(apiKey);

  const count = items.length;
  const subject =
    count === 1
      ? `${items[0].title} is now streaming somewhere new`
      : `${count} titles from your lists hit new streaming platforms`;

  const { error } = await resend.emails.send({
    from,
    to,
    subject,
    html: buildDigestHtml(items, appUrl),
    text: buildDigestText(items, appUrl),
  });

  if (error) {
    console.error("[email] Failed to send digest to", to, error);
  }
}
