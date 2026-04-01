import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const size = { width: 1200, height: 600 };
export const contentType = "image/png";

export default function TwitterImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #050505 0%, #0b0b0b 100%)",
          color: "white",
          fontSize: 96,
          fontWeight: 700,
          letterSpacing: -2,
        }}
      >
        24p
      </div>
    ),
    size,
  );
}

