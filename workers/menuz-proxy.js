export default {
  async fetch(request, env) {
    const originHost = (env.ORIGIN_HOST || "").trim();
    if (!originHost) {
      return new Response("ORIGIN_HOST not configured", { status: 500 });
    }

    const incoming = new URL(request.url);
    const upstream = new URL(request.url);
    upstream.protocol = "https:";
    upstream.hostname = originHost;
    upstream.port = "";

    const headers = new Headers(request.headers);
    headers.set("host", originHost);
    headers.set("x-forwarded-host", incoming.host);

    const proxiedRequest = new Request(upstream.toString(), {
      method: request.method,
      headers,
      body: request.body,
      redirect: "manual"
    });

    try {
      return await fetch(proxiedRequest);
    } catch (err) {
      return new Response("origin unavailable", { status: 502 });
    }
  }
};
