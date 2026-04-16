import "server-only";

import { Resend } from "resend";

export type StreamingChangeItem = {
  tmdbId: number;
  title: string;
  releaseYear: number | null;
  posterUrl: string | null;
  newProviderNames: string[];
};

export type PriceDropItem = {
  imdbId: string;
  title: string;
  releaseYear: number | null;
  posterUrl: string | null;
  oldPriceUsd: number;
  newPriceUsd: number;
};

function providerList(names: string[]): string {
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

function formatUsd(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

function renderPosterCell(posterUrl: string | null, title: string): string {
  return posterUrl
    ? `<img src="${posterUrl}" alt="${title}" width="48" height="72" style="border-radius:6px;object-fit:cover;display:block;" />`
    : `<div style="width:48px;height:72px;border-radius:6px;background:#1a1a1a;"></div>`;
}

function renderStreamingItemHtml(item: StreamingChangeItem): string {
  const year = item.releaseYear ? ` (${item.releaseYear})` : "";
  return `
    <tr>
      <td style="padding:12px 0;border-bottom:1px solid #1f1f1f;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
          <td width="60" valign="top" style="padding-right:14px;">${renderPosterCell(item.posterUrl, item.title)}</td>
          <td valign="top">
            <p style="margin:0 0 2px;font-size:15px;font-weight:600;color:#f5f5f5;">${item.title}<span style="font-weight:400;color:#737373;">${year}</span></p>
            <p style="margin:0;font-size:13px;color:#a3a3a3;">Now on <strong style="color:#e5e5e5;">${providerList(item.newProviderNames)}</strong></p>
          </td>
        </tr></table>
      </td>
    </tr>`;
}

function renderPriceDropItemHtml(item: PriceDropItem): string {
  const year = item.releaseYear ? ` (${item.releaseYear})` : "";
  const savings = item.oldPriceUsd - item.newPriceUsd;
  const pct = Math.round((savings / item.oldPriceUsd) * 100);
  return `
    <tr>
      <td style="padding:12px 0;border-bottom:1px solid #1f1f1f;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
          <td width="60" valign="top" style="padding-right:14px;">${renderPosterCell(item.posterUrl, item.title)}</td>
          <td valign="top">
            <p style="margin:0 0 2px;font-size:15px;font-weight:600;color:#f5f5f5;">${item.title}<span style="font-weight:400;color:#737373;">${year}</span></p>
            <p style="margin:0;font-size:13px;color:#a3a3a3;">
              Buy on iTunes&nbsp;
              <strong style="color:#e5e5e5;">${formatUsd(item.newPriceUsd)}</strong>
              <span style="text-decoration:line-through;color:#525252;margin-left:6px;">${formatUsd(item.oldPriceUsd)}</span>
              <span style="margin-left:6px;color:#4ade80;">&minus;${pct}%</span>
            </p>
          </td>
        </tr></table>
      </td>
    </tr>`;
}

function buildSection(label: string, rows: string): string {
  return `
    <tr><td style="padding:20px 0 8px;">
      <p style="margin:0;font-size:11px;font-weight:600;letter-spacing:0.2em;text-transform:uppercase;color:#525252;">${label}</p>
    </td></tr>
    <tr><td>
      <table cellpadding="0" cellspacing="0" border="0" width="100%">${rows}</table>
    </td></tr>`;
}

function buildDigestHtml(
  streamingItems: StreamingChangeItem[],
  priceDropItems: PriceDropItem[],
  appUrl: string,
): string {
  const totalCount = streamingItems.length + priceDropItems.length;
  let headline: string;
  if (totalCount === 1) {
    headline = streamingItems.length
      ? `<strong>${streamingItems[0].title}</strong> is now streaming somewhere new.`
      : `<strong>${priceDropItems[0].title}</strong> just dropped in price.`;
  } else {
    const parts: string[] = [];
    if (streamingItems.length) parts.push(`${streamingItems.length} streaming arrival${streamingItems.length > 1 ? "s" : ""}`);
    if (priceDropItems.length) parts.push(`${priceDropItems.length} price drop${priceDropItems.length > 1 ? "s" : ""}`);
    headline = `<strong>${parts.join(" and ")}</strong> for titles in your lists.`;
  }

  const sections: string[] = [];
  if (streamingItems.length) {
    sections.push(buildSection("New on streaming", streamingItems.map(renderStreamingItemHtml).join("")));
  }
  if (priceDropItems.length) {
    sections.push(buildSection("Price drops", priceDropItems.map(renderPriceDropItemHtml).join("")));
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Updates from 24p</title>
</head>
<body style="margin:0;padding:0;background:#0d0d0d;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#0d0d0d;">
  <tr><td align="center" style="padding:32px 16px;">
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:520px;">

      <tr><td style="padding-bottom:24px;">
        <p style="margin:0 0 14px;font-size:13px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;color:#525252;">24p</p>
        <h1 style="margin:0;font-size:22px;font-weight:700;color:#f5f5f5;line-height:1.3;">${headline}</h1>
      </td></tr>

      ${sections.join("")}

      <tr><td style="padding-top:28px;">
        <a href="${appUrl}" style="display:inline-block;padding:11px 22px;background:#f5f5f5;color:#0d0d0d;font-size:14px;font-weight:600;border-radius:10px;text-decoration:none;">Open 24p</a>
      </td></tr>

      <tr><td style="padding-top:28px;border-top:1px solid #1f1f1f;margin-top:8px;">
        <p style="margin:0;font-size:12px;color:#404040;">
          You're receiving this because you opted in to notifications on 24p.<br />
          <a href="${appUrl}/settings" style="color:#525252;">Manage notification preferences</a>
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;
}

function buildDigestText(
  streamingItems: StreamingChangeItem[],
  priceDropItems: PriceDropItem[],
  appUrl: string,
): string {
  const lines: string[] = ["Updates from 24p", ""];

  if (streamingItems.length) {
    lines.push("NEW ON STREAMING", "");
    for (const item of streamingItems) {
      const year = item.releaseYear ? ` (${item.releaseYear})` : "";
      lines.push(`• ${item.title}${year} — now on ${providerList(item.newProviderNames)}`);
    }
    lines.push("");
  }

  if (priceDropItems.length) {
    lines.push("PRICE DROPS", "");
    for (const item of priceDropItems) {
      const year = item.releaseYear ? ` (${item.releaseYear})` : "";
      const pct = Math.round(((item.oldPriceUsd - item.newPriceUsd) / item.oldPriceUsd) * 100);
      lines.push(`• ${item.title}${year} — ${formatUsd(item.newPriceUsd)} on iTunes (was ${formatUsd(item.oldPriceUsd)}, -${pct}%)`);
    }
    lines.push("");
  }

  lines.push(`Open 24p: ${appUrl}`, `Manage notifications: ${appUrl}/settings`);
  return lines.join("\n");
}

function buildSubject(streamingItems: StreamingChangeItem[], priceDropItems: PriceDropItem[]): string {
  const total = streamingItems.length + priceDropItems.length;
  if (total === 1) {
    if (streamingItems.length) return `${streamingItems[0].title} is now streaming somewhere new`;
    return `${priceDropItems[0].title} just dropped to ${formatUsd(priceDropItems[0].newPriceUsd)} on iTunes`;
  }
  const parts: string[] = [];
  if (streamingItems.length) parts.push(`${streamingItems.length} streaming arrival${streamingItems.length > 1 ? "s" : ""}`);
  if (priceDropItems.length) parts.push(`${priceDropItems.length} price drop${priceDropItems.length > 1 ? "s" : ""}`);
  return `${parts.join(" and ")} from your lists`;
}

export async function sendNotificationDigest(
  to: string,
  streamingItems: StreamingChangeItem[],
  priceDropItems: PriceDropItem[],
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "24p <notifications@24p.mov>";
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://24p.mov").replace(/\/$/, "");

  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY not set — skipping email to", to);
    return;
  }
  if (!streamingItems.length && !priceDropItems.length) return;

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from,
    to,
    subject: buildSubject(streamingItems, priceDropItems),
    html: buildDigestHtml(streamingItems, priceDropItems, appUrl),
    text: buildDigestText(streamingItems, priceDropItems, appUrl),
  });

  if (error) {
    console.error("[email] Failed to send digest to", to, error);
  }
}
