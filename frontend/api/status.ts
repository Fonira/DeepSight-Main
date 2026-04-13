/**
 * Vercel Serverless Function — Deep Health Check Proxy
 *
 * Proxies to the backend /api/health/deep endpoint with the
 * HEALTH_CHECK_SECRET so the secret is never exposed to the client.
 *
 * GET /api/status
 */

export const config = { runtime: "edge" };

export default async function handler(request: Request) {
  if (request.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const API_URL =
    process.env.VITE_API_URL ||
    process.env.API_URL ||
    "https://api.deepsightsynthesis.com";
  const secret = process.env.HEALTH_CHECK_SECRET || "";

  if (!secret) {
    return new Response(
      JSON.stringify({ error: "HEALTH_CHECK_SECRET not configured" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  try {
    const backendUrl = `${API_URL}/api/health/deep?secret=${encodeURIComponent(secret)}`;
    const resp = await fetch(backendUrl, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15000),
    });

    const data = await resp.json();

    return new Response(JSON.stringify(data), {
      status: resp.status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: "Backend unreachable", detail: message }),
      { status: 502, headers: { "Content-Type": "application/json" } },
    );
  }
}
