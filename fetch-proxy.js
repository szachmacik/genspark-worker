// HOLON-META: {
//   purpose: "genspark-worker",
//   morphic_field: "agent-state:4c67a2b1-6830-44ec-97b1-7c8f93722add",
//   startup_protocol: "READ morphic_field + biofield_external + em_grid",
//   wiki: "32d6d069-74d6-8164-a6d5-f41c3d26ae9b"
// }


export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/fetch") {
      const target = url.searchParams.get("url") || "https://genspark.ai";
      const r = await fetch(target, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5"
        },
        redirect: "follow"
      });
      const html = await r.text();
      return new Response(html, {headers: {"Content-Type": "text/html", "Access-Control-Allow-Origin": "*"}});
    }
    return new Response("use /fetch?url=https://genspark.ai");
  }
};
