/* eslint-disable @next/next/no-img-element */
import { ImageResponse } from "next/og";
import { getListByUsernameSlugForViewer, resolveListPreviewPosters } from "@/lib/server/lists";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const alt = "A film list on 24p";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Dynamic share card: a poster collage of the list's films with the title and
// owner. This is what renders when a list URL is pasted into iMessage, Slack,
// X, etc. — it sells the click far better than a generic site icon.
export default async function Image({ params }: { params: Promise<{ username: string; slug: string }> }) {
  const { username, slug } = await params;
  const list = await getListByUsernameSlugForViewer(username, slug, null);

  const title = list?.title ?? "24p";
  const owner = list?.username ?? username;
  const count = list?.movies.length ?? 0;
  const posters = list ? (await resolveListPreviewPosters([list], 5))[list.id] ?? [] : [];
  const bigPosters = posters.map((url) => url.replace("/w185/", "/w500/")).slice(0, 5);

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          position: "relative",
          width: "100%",
          height: "100%",
          backgroundColor: "#0a0a0a",
          color: "white",
        }}
      >
        <div style={{ display: "flex", position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
          {bigPosters.length > 0 ? (
            bigPosters.map((src, index) => (
              <img key={index} src={src} style={{ width: "20%", height: "100%", objectFit: "cover" }} />
            ))
          ) : (
            <div
              style={{
                display: "flex",
                width: "100%",
                height: "100%",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 200,
                fontWeight: 800,
                color: "#262626",
              }}
            >
              24p
            </div>
          )}
        </div>

        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundImage:
              "linear-gradient(to bottom, rgba(10,10,10,0.15) 0%, rgba(10,10,10,0.25) 45%, rgba(10,10,10,0.97) 100%)",
          }}
        />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            position: "absolute",
            left: 56,
            right: 56,
            bottom: 48,
          }}
        >
          <div style={{ fontSize: 68, fontWeight: 800, lineHeight: 1.05, letterSpacing: -1 }}>{title}</div>
          <div style={{ marginTop: 14, fontSize: 30, color: "#cfcfcf" }}>
            {`@${owner}  ·  ${count} ${count === 1 ? "film" : "films"}  ·  24p`}
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
