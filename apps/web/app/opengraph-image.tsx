import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "IonexFlow — Autonomous AI Agent Workflows";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 72,
          background: "linear-gradient(145deg, #05070F 0%, #0B1220 55%, #0A1A22 100%)",
          color: "#E8F1FF",
        }}
      >
        <div style={{ fontSize: 28, letterSpacing: 8, color: "#3DFFF2", fontWeight: 700 }}>
          COMMAND CENTER
        </div>
        <div style={{ marginTop: 24, fontSize: 72, fontWeight: 800, lineHeight: 1.05 }}>
          IonexFlow
        </div>
        <div style={{ marginTop: 20, maxWidth: 780, fontSize: 30, color: "#9BB0C9", lineHeight: 1.35 }}>
          Orchestrate autonomous AI agent workflows visually.
        </div>
      </div>
    ),
    size
  );
}
