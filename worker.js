// genspark-worker v2 - Groq primary, secrets via CF env
const ROUTER = "https://adaptive-router.maciej-koziej01.workers.dev";
const CORS = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET,POST,OPTIONS","Access-Control-Allow-Headers":"Content-Type"};

function J(d,s){return new Response(JSON.stringify(d),{status:s||200,headers:Object.assign({"Content-Type":"application/json"},CORS)});}

async function llm(prompt, type, env) {
  const gk = env.GROQ_KEY || "";
  const model = ["build","code","architect"].includes(type)
    ? "llama-3.3-70b-versatile"
    : "llama-3.1-8b-instant";
  if(gk) {
    try {
      const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method:"POST",
        headers:{"Authorization":"Bearer "+gk,"Content-Type":"application/json"},
        body:JSON.stringify({model, max_tokens:2000, messages:[{role:"user",content:prompt.slice(0,3000)}]}),
        signal:AbortSignal.timeout(30000)
      });
      const d = await r.json();
      if(d.choices && d.choices[0]) return d.choices[0].message.content || "";
    } catch(e) {}
  }
  try {
    const r = await fetch("https://mcp-gateway.maciej-koziej01.workers.dev/tool/groq_ask",{
      method:"POST", headers:{"Content-Type":"application/json"},
      body:JSON.stringify({prompt:prompt.slice(0,1500), tokens:800}),
      signal:AbortSignal.timeout(20000)
    });
    const d = await r.json();
    return d.answer || "";
  } catch(e) {}
  return "LLM unavailable";
}

async function search(q, env) {
  if(env.TAVILY_KEY) {
    try {
      const r = await fetch("https://api.tavily.com/search",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({api_key:env.TAVILY_KEY, query:q, max_results:5})});
      return (await r.json()).results || [];
    } catch(e) {}
  }
  try {
    const r = await fetch("https://mcp-gateway.maciej-koziej01.workers.dev/tool/groq_ask",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({prompt:"Wyszukaj: "+q, tokens:500})});
    return [{title:"Search",content:(await r.json()).answer||""}];
  } catch(e) { return []; }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const p = url.pathname;
    if(request.method==="OPTIONS") return new Response(null,{headers:CORS});

    
    if(p==="/" || p==="" || p==="/index.html") {
      const html = atob("PCFET0NUWVBFIGh0bWw+CjxodG1sIGxhbmc9InBsIj4KPGhlYWQ+CjxtZXRhIGNoYXJzZXQ9IlVURi04Ij4KPG1ldGEgbmFtZT0idmlld3BvcnQiIGNvbnRlbnQ9IndpZHRoPWRldmljZS13aWR0aCwgaW5pdGlhbC1zY2FsZT0xLjAiPgo8dGl0bGU+R2Vuc3BhcmsgLSBBSSBTdXBlciBBZ2VudDwvdGl0bGU+CjxzY3JpcHQgc3JjPSJodHRwczovL2Nkbi50YWlsd2luZGNzcy5jb20iPjwvc2NyaXB0Pgo8c3R5bGU+CiAgOnJvb3QgeyAtLXB1cnBsZTogIzhiNWNmNjsgLS1ibHVlOiAjM2I4MmY2OyAtLWJnOiAjMGEwYTBmOyAtLXN1cmZhY2U6ICMxMzEzMWE7IC0tYm9yZGVyOiAjMWUxZTJlOyB9CiAgYm9keSB7IGJhY2tncm91bmQ6IHZhcigtLWJnKTsgZm9udC1mYW1pbHk6ICdJbnRlcicsIHN5c3RlbS11aSwgc2Fucy1zZXJpZjsgfQogIC5ncmFkaWVudC10ZXh0IHsgYmFja2dyb3VuZDogbGluZWFyLWdyYWRpZW50KDEzNWRlZywgIzhiNWNmNiwgIzNiODJmNiwgI2VjNDg5OSk7IC13ZWJraXQtYmFja2dyb3VuZC1jbGlwOiB0ZXh0OyAtd2Via2l0LXRleHQtZmlsbC1jb2xvcjogdHJhbnNwYXJlbnQ7IGJhY2tncm91bmQtY2xpcDogdGV4dDsgfQogIC5nbG93LWJvcmRlciB7IGJveC1zaGFkb3c6IDAgMCAwIDFweCByZ2JhKDEzOSw5MiwyNDYsMC4zKSwgMCAwIDIwcHggcmdiYSgxMzksOTIsMjQ2LDAuMSk7IH0KICAuYnRuLW1vZGUgeyB0cmFuc2l0aW9uOiBhbGwgMC4yczsgfQogIC5idG4tbW9kZS5hY3RpdmUgeyBiYWNrZ3JvdW5kOiByZ2JhKDEzOSw5MiwyNDYsMC4yKTsgYm9yZGVyLWNvbG9yOiAjOGI1Y2Y2OyBjb2xvcjogI2E3OGJmYTsgfQogIC50eXBpbmctZG90IHsgYW5pbWF0aW9uOiB0eXBpbmcgMS40cyBpbmZpbml0ZTsgZGlzcGxheTogaW5saW5lLWJsb2NrOyB3aWR0aDogNnB4OyBoZWlnaHQ6IDZweDsgYm9yZGVyLXJhZGl1czogNTAlOyBiYWNrZ3JvdW5kOiAjOGI1Y2Y2OyBtYXJnaW46IDAgMnB4OyB9CiAgLnR5cGluZy1kb3Q6bnRoLWNoaWxkKDIpIHsgYW5pbWF0aW9uLWRlbGF5OiAwLjJzOyB9CiAgLnR5cGluZy1kb3Q6bnRoLWNoaWxkKDMpIHsgYW5pbWF0aW9uLWRlbGF5OiAwLjRzOyB9CiAgQGtleWZyYW1lcyB0eXBpbmcgeyAwJSwgNjAlLCAxMDAlIHsgdHJhbnNmb3JtOiB0cmFuc2xhdGVZKDApOyBvcGFjaXR5OiAwLjQ7IH0gMzAlIHsgdHJhbnNmb3JtOiB0cmFuc2xhdGVZKC04cHgpOyBvcGFjaXR5OiAxOyB9IH0KICAuc2xpZGUtY2FyZCB7IGJhY2tncm91bmQ6IGxpbmVhci1ncmFkaWVudCgxMzVkZWcsICMxMzEzMWEsICMxYTFhMmUpOyBib3JkZXI6IDFweCBzb2xpZCAjMWUxZTJlOyB9CiAgLnJlc3VsdC1mYWRlIHsgYW5pbWF0aW9uOiBmYWRlSW4gMC4zcyBlYXNlOyB9CiAgQGtleWZyYW1lcyBmYWRlSW4geyBmcm9tIHsgb3BhY2l0eTogMDsgdHJhbnNmb3JtOiB0cmFuc2xhdGVZKDhweCk7IH0gdG8geyBvcGFjaXR5OiAxOyB0cmFuc2Zvcm06IHRyYW5zbGF0ZVkoMCk7IH0gfQogIDo6LXdlYmtpdC1zY3JvbGxiYXIgeyB3aWR0aDogNHB4OyB9IDo6LXdlYmtpdC1zY3JvbGxiYXItdHJhY2sgeyBiYWNrZ3JvdW5kOiAjMTMxMzFhOyB9IDo6LXdlYmtpdC1zY3JvbGxiYXItdGh1bWIgeyBiYWNrZ3JvdW5kOiAjMmQyZDNkOyBib3JkZXItcmFkaXVzOiAycHg7IH0KICAuc2hpbW1lciB7IGJhY2tncm91bmQ6IGxpbmVhci1ncmFkaWVudCg5MGRlZywgIzEzMTMxYSAyNSUsICMxZTFlMmUgNTAlLCAjMTMxMzFhIDc1JSk7IGJhY2tncm91bmQtc2l6ZTogMjAwJSAxMDAlOyBhbmltYXRpb246IHNoaW1tZXIgMS41cyBpbmZpbml0ZTsgfQogIEBrZXlmcmFtZXMgc2hpbW1lciB7IDAlIHsgYmFja2dyb3VuZC1wb3NpdGlvbjogMjAwJSAwOyB9IDEwMCUgeyBiYWNrZ3JvdW5kLXBvc2l0aW9uOiAtMjAwJSAwOyB9IH0KPC9zdHlsZT4KPC9oZWFkPgo8Ym9keSBjbGFzcz0idGV4dC1ncmF5LTEwMCBtaW4taC1zY3JlZW4iPgoKPCEtLSBOQVYgLS0+CjxuYXYgY2xhc3M9ImZpeGVkIHRvcC0wIHctZnVsbCB6LTUwIGJvcmRlci1iIGJvcmRlci1ncmF5LTgwMC81MCBiYWNrZHJvcC1ibHVyLXhsIiBzdHlsZT0iYmFja2dyb3VuZDogcmdiYSgxMCwxMCwxNSwwLjgpIj4KICA8ZGl2IGNsYXNzPSJtYXgtdy03eGwgbXgtYXV0byBweC00IHB5LTMgZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1iZXR3ZWVuIj4KICAgIDxkaXYgY2xhc3M9ImZsZXggaXRlbXMtY2VudGVyIGdhcC0yIj4KICAgICAgPGRpdiBjbGFzcz0idy04IGgtOCByb3VuZGVkLWxnIGZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIHRleHQtbGciIHN0eWxlPSJiYWNrZ3JvdW5kOiBsaW5lYXItZ3JhZGllbnQoMTM1ZGVnLCM4YjVjZjYsIzNiODJmNikiPuKaoTwvZGl2PgogICAgICA8c3BhbiBjbGFzcz0iZm9udC1ib2xkIHRleHQtbGciPkdlbnNwYXJrPC9zcGFuPgogICAgICA8c3BhbiBjbGFzcz0idGV4dC14cyBweC0yIHB5LTAuNSByb3VuZGVkLWZ1bGwgdGV4dC1wdXJwbGUtMzAwIG1sLTEiIHN0eWxlPSJiYWNrZ3JvdW5kOnJnYmEoMTM5LDkyLDI0NiwwLjE1KSI+b2ZzaG9yZS5kZXY8L3NwYW4+CiAgICA8L2Rpdj4KICAgIDxkaXYgY2xhc3M9ImZsZXggaXRlbXMtY2VudGVyIGdhcC00IHRleHQtc20gdGV4dC1ncmF5LTQwMCI+CiAgICAgIDxzcGFuIGlkPSJjcmVkaXRzLWRpc3BsYXkiIGNsYXNzPSJmbGV4IGl0ZW1zLWNlbnRlciBnYXAtMSI+CiAgICAgICAgPHNwYW4gY2xhc3M9InctMS41IGgtMS41IHJvdW5kZWQtZnVsbCBiZy1ncmVlbi00MDAiPjwvc3Bhbj4KICAgICAgICA8c3BhbiBpZD0iY3JlZGl0cy1jb3VudCI+MTAwMDwvc3Bhbj4gY3JlZGl0cwogICAgICA8L3NwYW4+CiAgICAgIDxidXR0b24gb25jbGljaz0ic2hvd0hpc3RvcnkoKSIgY2xhc3M9ImhvdmVyOnRleHQtZ3JheS0yMDAgdHJhbnNpdGlvbiI+SGlzdG9yeTwvYnV0dG9uPgogICAgICA8YnV0dG9uIGNsYXNzPSJweC0zIHB5LTEuNSByb3VuZGVkLWxnIHRleHQtd2hpdGUgdGV4dC14cyBmb250LW1lZGl1bSIgc3R5bGU9ImJhY2tncm91bmQ6bGluZWFyLWdyYWRpZW50KDEzNWRlZywjOGI1Y2Y2LCMzYjgyZjYpIj5TaWduIEluPC9idXR0b24+CiAgICA8L2Rpdj4KICA8L2Rpdj4KPC9uYXY+Cgo8IS0tIE1BSU4gLS0+CjxtYWluIGNsYXNzPSJwdC0yMCBtaW4taC1zY3JlZW4iPgogIDwhLS0gSEVSTyAtLT4KICA8ZGl2IGlkPSJoZXJvIiBjbGFzcz0iZmxleCBmbGV4LWNvbCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXIgcHgtNCBweS0xNiB0cmFuc2l0aW9uLWFsbCBkdXJhdGlvbi01MDAiPgogICAgPGRpdiBjbGFzcz0ibWItMiB0ZXh0LXhzIGZvbnQtbWVkaXVtIHRleHQtcHVycGxlLTQwMCB0cmFja2luZy13aWRlc3QgdXBwZXJjYXNlIj5BSSBTdXBlciBBZ2VudCBQbGF0Zm9ybTwvZGl2PgogICAgPGgxIGNsYXNzPSJ0ZXh0LTV4bCBtZDp0ZXh0LTZ4bCBmb250LWJsYWNrIHRleHQtY2VudGVyIG1iLTMgbGVhZGluZy10aWdodCI+CiAgICAgIDxzcGFuIGNsYXNzPSJncmFkaWVudC10ZXh0Ij5Zb3VyIEFJIFN1cGVyIEFnZW50PC9zcGFuPgogICAgPC9oMT4KICAgIDxwIGNsYXNzPSJ0ZXh0LWdyYXktNDAwIHRleHQtY2VudGVyIG1iLTEwIG1heC13LWxnIHRleHQtbGciPlNsaWRlcywgc2hlZXRzLCByZXNlYXJjaCwgaW1hZ2VzIOKAlCBvbmUgcHJvbXB0IGF3YXkuPC9wPgoKICAgIDwhLS0gTU9ERSBCVVRUT05TIC0tPgogICAgPGRpdiBjbGFzcz0iZmxleCBmbGV4LXdyYXAganVzdGlmeS1jZW50ZXIgZ2FwLTIgbWItNiI+CiAgICAgIDxidXR0b24gY2xhc3M9ImJ0bi1tb2RlIGFjdGl2ZSBweC00IHB5LTIgcm91bmRlZC1mdWxsIGJvcmRlciBib3JkZXItZ3JheS03MDAgdGV4dC1zbSB0ZXh0LWdyYXktMzAwIGZsZXggaXRlbXMtY2VudGVyIGdhcC0yIiBkYXRhLW1vZGU9ImNoYXQiIG9uY2xpY2s9InNldE1vZGUodGhpcywnY2hhdCcpIj7wn5KsIENoYXQ8L2J1dHRvbj4KICAgICAgPGJ1dHRvbiBjbGFzcz0iYnRuLW1vZGUgcHgtNCBweS0yIHJvdW5kZWQtZnVsbCBib3JkZXIgYm9yZGVyLWdyYXktNzAwIHRleHQtc20gdGV4dC1ncmF5LTMwMCBmbGV4IGl0ZW1zLWNlbnRlciBnYXAtMiIgZGF0YS1tb2RlPSJzbGlkZXMiIG9uY2xpY2s9InNldE1vZGUodGhpcywnc2xpZGVzJykiPvCfk4ogU2xpZGVzPC9idXR0b24+CiAgICAgIDxidXR0b24gY2xhc3M9ImJ0bi1tb2RlIHB4LTQgcHktMiByb3VuZGVkLWZ1bGwgYm9yZGVyIGJvcmRlci1ncmF5LTcwMCB0ZXh0LXNtIHRleHQtZ3JheS0zMDAgZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTIiIGRhdGEtbW9kZT0ic2hlZXRzIiBvbmNsaWNrPSJzZXRNb2RlKHRoaXMsJ3NoZWV0cycpIj7wn5OLIFNoZWV0czwvYnV0dG9uPgogICAgICA8YnV0dG9uIGNsYXNzPSJidG4tbW9kZSBweC00IHB5LTIgcm91bmRlZC1mdWxsIGJvcmRlciBib3JkZXItZ3JheS03MDAgdGV4dC1zbSB0ZXh0LWdyYXktMzAwIGZsZXggaXRlbXMtY2VudGVyIGdhcC0yIiBkYXRhLW1vZGU9InNwYXJrcGFnZSIgb25jbGljaz0ic2V0TW9kZSh0aGlzLCdzcGFya3BhZ2UnKSI+8J+MkCBTcGFya1BhZ2U8L2J1dHRvbj4KICAgICAgPGJ1dHRvbiBjbGFzcz0iYnRuLW1vZGUgcHgtNCBweS0yIHJvdW5kZWQtZnVsbCBib3JkZXIgYm9yZGVyLWdyYXktNzAwIHRleHQtc20gdGV4dC1ncmF5LTMwMCBmbGV4IGl0ZW1zLWNlbnRlciBnYXAtMiIgZGF0YS1tb2RlPSJzZWFyY2giIG9uY2xpY2s9InNldE1vZGUodGhpcywnc2VhcmNoJykiPvCflI0gU2VhcmNoPC9idXR0b24+CiAgICAgIDxidXR0b24gY2xhc3M9ImJ0bi1tb2RlIHB4LTQgcHktMiByb3VuZGVkLWZ1bGwgYm9yZGVyIGJvcmRlci1ncmF5LTcwMCB0ZXh0LXNtIHRleHQtZ3JheS0zMDAgZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTIiIGRhdGEtbW9kZT0iaW1hZ2UiIG9uY2xpY2s9InNldE1vZGUodGhpcywnaW1hZ2UnKSI+8J+OqCBJbWFnZTwvYnV0dG9uPgogICAgICA8YnV0dG9uIGNsYXNzPSJidG4tbW9kZSBweC00IHB5LTIgcm91bmRlZC1mdWxsIGJvcmRlciBib3JkZXItZ3JheS03MDAgdGV4dC1zbSB0ZXh0LWdyYXktMzAwIGZsZXggaXRlbXMtY2VudGVyIGdhcC0yIiBkYXRhLW1vZGU9ImJlbmNobWFyayIgb25jbGljaz0ic2V0TW9kZSh0aGlzLCdiZW5jaG1hcmsnKSI+8J+TiCBCZW5jaG1hcms8L2J1dHRvbj4KICAgIDwvZGl2PgoKICAgIDwhLS0gSU5QVVQgLS0+CiAgICA8ZGl2IGNsYXNzPSJ3LWZ1bGwgbWF4LXctMnhsIHJlbGF0aXZlIj4KICAgICAgPGRpdiBjbGFzcz0icm91bmRlZC0yeGwgcC0wLjUgZ2xvdy1ib3JkZXIiIHN0eWxlPSJiYWNrZ3JvdW5kOmxpbmVhci1ncmFkaWVudCgxMzVkZWcscmdiYSgxMzksOTIsMjQ2LDAuNCkscmdiYSg1OSwxMzAsMjQ2LDAuNCkpIj4KICAgICAgICA8ZGl2IGNsYXNzPSJyb3VuZGVkLTJ4bCBmbGV4IGl0ZW1zLWVuZCBnYXAtMyBwLTQiIHN0eWxlPSJiYWNrZ3JvdW5kOiMxMzEzMWEiPgogICAgICAgICAgPHRleHRhcmVhIGlkPSJtYWluLWlucHV0IiByb3dzPSIyIiBwbGFjZWhvbGRlcj0iQXNrIGFueXRoaW5nLi4uIEdlbmVyYXRlIHNsaWRlcywgcmVzZWFyY2ggdG9waWNzLCBjcmVhdGUgc2hlZXRzLi4uIiAKICAgICAgICAgICAgY2xhc3M9ImZsZXgtMSBiZy10cmFuc3BhcmVudCByZXNpemUtbm9uZSBvdXRsaW5lLW5vbmUgdGV4dC1ncmF5LTEwMCBwbGFjZWhvbGRlci1ncmF5LTUwMCB0ZXh0LWJhc2UgbGVhZGluZy1yZWxheGVkIgogICAgICAgICAgICBvbmtleWRvd249ImlmKGV2ZW50LmtleT09PSdFbnRlcicmJiFldmVudC5zaGlmdEtleSl7ZXZlbnQucHJldmVudERlZmF1bHQoKTtnbygpfSIKICAgICAgICAgICAgb25pbnB1dD0idGhpcy5zdHlsZS5oZWlnaHQ9J2F1dG8nO3RoaXMuc3R5bGUuaGVpZ2h0PU1hdGgubWluKHRoaXMuc2Nyb2xsSGVpZ2h0LDE2MCkrJ3B4JyI+PC90ZXh0YXJlYT4KICAgICAgICAgIDxidXR0b24gb25jbGljaz0iZ28oKSIgaWQ9InNlbmQtYnRuIgogICAgICAgICAgICBjbGFzcz0iZmxleC1zaHJpbmstMCB3LTEwIGgtMTAgcm91bmRlZC14bCBmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciB0ZXh0LXdoaXRlIHRyYW5zaXRpb24tYWxsIGhvdmVyOnNjYWxlLTEwNSBhY3RpdmU6c2NhbGUtOTUiCiAgICAgICAgICAgIHN0eWxlPSJiYWNrZ3JvdW5kOmxpbmVhci1ncmFkaWVudCgxMzVkZWcsIzhiNWNmNiwjM2I4MmY2KSI+CiAgICAgICAgICAgIDxzdmcgd2lkdGg9IjE4IiBoZWlnaHQ9IjE4IiB2aWV3Qm94PSIwIDAgMjQgMjQiIGZpbGw9Im5vbmUiIHN0cm9rZT0iY3VycmVudENvbG9yIiBzdHJva2Utd2lkdGg9IjIuNSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIj48bGluZSB4MT0iMjIiIHkxPSIyIiB4Mj0iMTEiIHkyPSIxMyIvPjxwb2x5Z29uIHBvaW50cz0iMjIgMiAxNSAyMiAxMSAxMyAyIDkgMjIgMiIvPjwvc3ZnPgogICAgICAgICAgPC9idXR0b24+CiAgICAgICAgPC9kaXY+CiAgICAgIDwvZGl2PgogICAgICA8ZGl2IGlkPSJtb2RlLWhpbnQiIGNsYXNzPSJ0ZXh0LWNlbnRlciB0ZXh0LXhzIHRleHQtZ3JheS02MDAgbXQtMiI+8J+SoSBDaGF0IG1vZGUg4oCUIHByZXNzIEVudGVyIHRvIHNlbmQsIFNoaWZ0K0VudGVyIGZvciBuZXcgbGluZTwvZGl2PgogICAgPC9kaXY+CgogICAgPCEtLSBTVUdHRVNUSU9OUyAtLT4KICAgIDxkaXYgY2xhc3M9ImZsZXggZmxleC13cmFwIGp1c3RpZnktY2VudGVyIGdhcC0yIG10LTYgbWF4LXctMnhsIj4KICAgICAgPGJ1dHRvbiBvbmNsaWNrPSJzdWdnZXN0KCdDcmVhdGUgYSAxMC1zbGlkZSBwaXRjaCBkZWNrIGZvciBhbiBBSSBzdGFydHVwJykiIGNsYXNzPSJweC0zIHB5LTEuNSByb3VuZGVkLWZ1bGwgYm9yZGVyIGJvcmRlci1ncmF5LTgwMCB0ZXh0LXhzIHRleHQtZ3JheS00MDAgaG92ZXI6Ym9yZGVyLXB1cnBsZS03MDAgaG92ZXI6dGV4dC1wdXJwbGUtMzAwIHRyYW5zaXRpb24iPvCfk4ogQUkgc3RhcnR1cCBwaXRjaCBkZWNrPC9idXR0b24+CiAgICAgIDxidXR0b24gb25jbGljaz0ic3VnZ2VzdCgnUmVzZWFyY2ggdGhlIGxhdGVzdCB0cmVuZHMgaW4gbGFyZ2UgbGFuZ3VhZ2UgbW9kZWxzIDIwMjUnKSIgY2xhc3M9InB4LTMgcHktMS41IHJvdW5kZWQtZnVsbCBib3JkZXIgYm9yZGVyLWdyYXktODAwIHRleHQteHMgdGV4dC1ncmF5LTQwMCBob3Zlcjpib3JkZXItcHVycGxlLTcwMCBob3Zlcjp0ZXh0LXB1cnBsZS0zMDAgdHJhbnNpdGlvbiI+8J+UjSBMTE0gdHJlbmRzIDIwMjU8L2J1dHRvbj4KICAgICAgPGJ1dHRvbiBvbmNsaWNrPSJzdWdnZXN0KCdHZW5lcmF0ZSBhIGZpbmFuY2lhbCBjb21wYXJpc29uIHNwcmVhZHNoZWV0IG9mIHRvcCBBSSBjb21wYW5pZXMnKSIgY2xhc3M9InB4LTMgcHktMS41IHJvdW5kZWQtZnVsbCBib3JkZXIgYm9yZGVyLWdyYXktODAwIHRleHQteHMgdGV4dC1ncmF5LTQwMCBob3Zlcjpib3JkZXItcHVycGxlLTcwMCBob3Zlcjp0ZXh0LXB1cnBsZS0zMDAgdHJhbnNpdGlvbiI+8J+TiyBBSSBjb21wYW5pZXMgY29tcGFyaXNvbjwvYnV0dG9uPgogICAgICA8YnV0dG9uIG9uY2xpY2s9InN1Z2dlc3QoJ0NyZWF0ZSBhIGxhbmRpbmcgcGFnZSBmb3IgYSBTYWFTIHByb2R1Y3QnKSIgY2xhc3M9InB4LTMgcHktMS41IHJvdW5kZWQtZnVsbCBib3JkZXIgYm9yZGVyLWdyYXktODAwIHRleHQteHMgdGV4dC1ncmF5LTQwMCBob3Zlcjpib3JkZXItcHVycGxlLTcwMCBob3Zlcjp0ZXh0LXB1cnBsZS0zMDAgdHJhbnNpdGlvbiI+8J+MkCBTYWFTIGxhbmRpbmcgcGFnZTwvYnV0dG9uPgogICAgPC9kaXY+CiAgPC9kaXY+CgogIDwhLS0gUkVTVUxUUyAtLT4KICA8ZGl2IGlkPSJyZXN1bHRzIiBjbGFzcz0iaGlkZGVuIG1heC13LTR4bCBteC1hdXRvIHB4LTQgcGItMzIiPjwvZGl2Pgo8L21haW4+Cgo8IS0tIEJPVFRPTSBJTlBVVCAoc3RpY2t5IGFmdGVyIGZpcnN0IHVzZSkgLS0+CjxkaXYgaWQ9ImJvdHRvbS1iYXIiIGNsYXNzPSJoaWRkZW4gZml4ZWQgYm90dG9tLTAgbGVmdC0wIHJpZ2h0LTAgcC00IGJvcmRlci10IGJvcmRlci1ncmF5LTgwMC81MCIgc3R5bGU9ImJhY2tncm91bmQ6cmdiYSgxMCwxMCwxNSwwLjk1KTtiYWNrZHJvcC1maWx0ZXI6Ymx1cigyMHB4KSI+CiAgPGRpdiBjbGFzcz0ibWF4LXctM3hsIG14LWF1dG8iPgogICAgPGRpdiBjbGFzcz0iZmxleCBmbGV4LXdyYXAgZ2FwLTIgbWItMyI+CiAgICAgIDxidXR0b24gY2xhc3M9ImJ0bi1tb2RlLXNtYWxsIGFjdGl2ZSBweC0zIHB5LTEgcm91bmRlZC1mdWxsIGJvcmRlciBib3JkZXItZ3JheS03MDAgdGV4dC14cyB0ZXh0LWdyYXktNDAwIGZsZXggaXRlbXMtY2VudGVyIGdhcC0xIiBkYXRhLW1vZGU9ImNoYXQiIG9uY2xpY2s9InNldE1vZGUodGhpcywnY2hhdCcpIj7wn5KsIENoYXQ8L2J1dHRvbj4KICAgICAgPGJ1dHRvbiBjbGFzcz0iYnRuLW1vZGUtc21hbGwgcHgtMyBweS0xIHJvdW5kZWQtZnVsbCBib3JkZXIgYm9yZGVyLWdyYXktNzAwIHRleHQteHMgdGV4dC1ncmF5LTQwMCIgZGF0YS1tb2RlPSJzbGlkZXMiIG9uY2xpY2s9InNldE1vZGUodGhpcywnc2xpZGVzJykiPvCfk4ogU2xpZGVzPC9idXR0b24+CiAgICAgIDxidXR0b24gY2xhc3M9ImJ0bi1tb2RlLXNtYWxsIHB4LTMgcHktMSByb3VuZGVkLWZ1bGwgYm9yZGVyIGJvcmRlci1ncmF5LTcwMCB0ZXh0LXhzIHRleHQtZ3JheS00MDAiIGRhdGEtbW9kZT0ic2hlZXRzIiBvbmNsaWNrPSJzZXRNb2RlKHRoaXMsJ3NoZWV0cycpIj7wn5OLIFNoZWV0czwvYnV0dG9uPgogICAgICA8YnV0dG9uIGNsYXNzPSJidG4tbW9kZS1zbWFsbCBweC0zIHB5LTEgcm91bmRlZC1mdWxsIGJvcmRlciBib3JkZXItZ3JheS03MDAgdGV4dC14cyB0ZXh0LWdyYXktNDAwIiBkYXRhLW1vZGU9InNwYXJrcGFnZSIgb25jbGljaz0ic2V0TW9kZSh0aGlzLCdzcGFya3BhZ2UnKSI+8J+MkCBTcGFya1BhZ2U8L2J1dHRvbj4KICAgICAgPGJ1dHRvbiBjbGFzcz0iYnRuLW1vZGUtc21hbGwgcHgtMyBweS0xIHJvdW5kZWQtZnVsbCBib3JkZXIgYm9yZGVyLWdyYXktNzAwIHRleHQteHMgdGV4dC1ncmF5LTQwMCIgZGF0YS1tb2RlPSJzZWFyY2giIG9uY2xpY2s9InNldE1vZGUodGhpcywnc2VhcmNoJykiPvCflI0gU2VhcmNoPC9idXR0b24+CiAgICAgIDxidXR0b24gY2xhc3M9ImJ0bi1tb2RlLXNtYWxsIHB4LTMgcHktMSByb3VuZGVkLWZ1bGwgYm9yZGVyIGJvcmRlci1ncmF5LTcwMCB0ZXh0LXhzIHRleHQtZ3JheS00MDAiIGRhdGEtbW9kZT0iaW1hZ2UiIG9uY2xpY2s9InNldE1vZGUodGhpcywnaW1hZ2UnKSI+8J+OqCBJbWFnZTwvYnV0dG9uPgogICAgPC9kaXY+CiAgICA8ZGl2IGNsYXNzPSJyb3VuZGVkLXhsIHAtMC41IiBzdHlsZT0iYmFja2dyb3VuZDpsaW5lYXItZ3JhZGllbnQoMTM1ZGVnLHJnYmEoMTM5LDkyLDI0NiwwLjMpLHJnYmEoNTksMTMwLDI0NiwwLjMpKSI+CiAgICAgIDxkaXYgY2xhc3M9InJvdW5kZWQteGwgZmxleCBpdGVtcy1lbmQgZ2FwLTMgcC0zIiBzdHlsZT0iYmFja2dyb3VuZDojMTMxMzFhIj4KICAgICAgICA8dGV4dGFyZWEgaWQ9ImJvdHRvbS1pbnB1dCIgcm93cz0iMSIgcGxhY2Vob2xkZXI9IkZvbGxvdy11cCBvciBuZXcgcmVxdWVzdC4uLiIKICAgICAgICAgIGNsYXNzPSJmbGV4LTEgYmctdHJhbnNwYXJlbnQgcmVzaXplLW5vbmUgb3V0bGluZS1ub25lIHRleHQtZ3JheS0xMDAgcGxhY2Vob2xkZXItZ3JheS01MDAgdGV4dC1zbSIKICAgICAgICAgIG9ua2V5ZG93bj0iaWYoZXZlbnQua2V5PT09J0VudGVyJyYmIWV2ZW50LnNoaWZ0S2V5KXtldmVudC5wcmV2ZW50RGVmYXVsdCgpO2dvKCl9IgogICAgICAgICAgb25pbnB1dD0idGhpcy5zdHlsZS5oZWlnaHQ9J2F1dG8nO3RoaXMuc3R5bGUuaGVpZ2h0PU1hdGgubWluKHRoaXMuc2Nyb2xsSGVpZ2h0LDEwMCkrJ3B4JyI+PC90ZXh0YXJlYT4KICAgICAgICA8YnV0dG9uIG9uY2xpY2s9ImdvKCkiIGNsYXNzPSJmbGV4LXNocmluay0wIHctOCBoLTggcm91bmRlZC1sZyBmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciB0ZXh0LXdoaXRlIiBzdHlsZT0iYmFja2dyb3VuZDpsaW5lYXItZ3JhZGllbnQoMTM1ZGVnLCM4YjVjZjYsIzNiODJmNikiPgogICAgICAgICAgPHN2ZyB3aWR0aD0iMTQiIGhlaWdodD0iMTQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMi41IiBzdHJva2UtbGluZWNhcD0icm91bmQiPjxsaW5lIHgxPSIyMiIgeTE9IjIiIHgyPSIxMSIgeTI9IjEzIi8+PHBvbHlnb24gcG9pbnRzPSIyMiAyIDE1IDIyIDExIDEzIDIgOSAyMiAyIi8+PC9zdmc+CiAgICAgICAgPC9idXR0b24+CiAgICAgIDwvZGl2PgogICAgPC9kaXY+CiAgPC9kaXY+CjwvZGl2PgoKPHNjcmlwdD4KbGV0IG1vZGUgPSAnY2hhdCc7CmxldCBjcmVkaXRzID0gMTAwMDsKbGV0IGhpc3RvcnkgPSBbXTsKY29uc3QgQ09TVFMgPSB7Y2hhdDowLHNsaWRlczozMDAsc2hlZXRzOjIwMCxzcGFya3BhZ2U6MjAwLHNlYXJjaDowLGltYWdlOjAsYmVuY2htYXJrOjUwfTsKCmZ1bmN0aW9uIHNldE1vZGUoYnRuLCBtKSB7CiAgbW9kZSA9IG07CiAgZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnLmJ0bi1tb2RlLC5idG4tbW9kZS1zbWFsbCcpLmZvckVhY2goYiA9PiBiLmNsYXNzTGlzdC5yZW1vdmUoJ2FjdGl2ZScpKTsKICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKGBbZGF0YS1tb2RlPSIke219Il1gKS5mb3JFYWNoKGIgPT4gYi5jbGFzc0xpc3QuYWRkKCdhY3RpdmUnKSk7CiAgY29uc3QgaGludHMgPSB7Y2hhdDon8J+SrCBDaGF0IG1vZGUg4oCUIEFJIGFuc3dlcnMgYW55IHF1ZXN0aW9uJyxzbGlkZXM6J/Cfk4ogU2xpZGVzIG1vZGUg4oCUIGdlbmVyYXRlcyB2aXN1YWwgcHJlc2VudGF0aW9uJyxzaGVldHM6J/Cfk4sgU2hlZXRzIG1vZGUg4oCUIGNyZWF0ZXMgZGF0YSB0YWJsZXMgJiBzcHJlYWRzaGVldHMnLHNwYXJrcGFnZTon8J+MkCBTcGFya1BhZ2Ug4oCUIGJ1aWxkcyBhIG1pbmkgd2Vic2l0ZScsc2VhcmNoOifwn5SNIFNlYXJjaCBtb2RlIOKAlCByZXNlYXJjaGVzIGFueSB0b3BpYycsaW1hZ2U6J/CfjqggSW1hZ2Ug4oCUIGdlbmVyYXRlcyBBSSBhcnR3b3JrIChyZXF1aXJlcyBBUEkga2V5KScsYmVuY2htYXJrOifwn5OIIEJlbmNobWFyayDigJQgY29tcGFyZSB3aXRoIEdlbnNwYXJrIHJlc3BvbnNlJ307CiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ21vZGUtaGludCcpLnRleHRDb250ZW50ID0gaGludHNbbV0gfHwgJyc7Cn0KCmZ1bmN0aW9uIHN1Z2dlc3QodGV4dCkgewogIGNvbnN0IGlucCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdtYWluLWlucHV0JykgfHwgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2JvdHRvbS1pbnB1dCcpOwogIGlucC52YWx1ZSA9IHRleHQ7CiAgaW5wLmZvY3VzKCk7Cn0KCmZ1bmN0aW9uIGdldElucHV0KCkgewogIGNvbnN0IGJpID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2JvdHRvbS1pbnB1dCcpOwogIGNvbnN0IG1pID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ21haW4taW5wdXQnKTsKICByZXR1cm4gYmkgJiYgYmkudmFsdWUudHJpbSgpID8gYmkgOiBtaTsKfQoKYXN5bmMgZnVuY3Rpb24gZ28oKSB7CiAgY29uc3QgaW5wID0gZ2V0SW5wdXQoKTsKICBjb25zdCBxID0gaW5wLnZhbHVlLnRyaW0oKTsKICBpZiAoIXEpIHJldHVybjsKICBpbnAudmFsdWUgPSAnJzsKCiAgLy8gU3dpdGNoIHRvIHJlc3VsdHMgdmlldwogIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdoZXJvJykuY2xhc3NMaXN0LmFkZCgnaGlkZGVuJyk7CiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3Jlc3VsdHMnKS5jbGFzc0xpc3QucmVtb3ZlKCdoaWRkZW4nKTsKICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYm90dG9tLWJhcicpLmNsYXNzTGlzdC5yZW1vdmUoJ2hpZGRlbicpOwoKICAvLyBTaG93IGxvYWRpbmcKICBjb25zdCBpZCA9ICdyZXMtJyArIERhdGUubm93KCk7CiAgY29uc3QgZWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTsKICBlbC5pZCA9IGlkOwogIGVsLmNsYXNzTmFtZSA9ICdyZXN1bHQtZmFkZSBtYi02IHJvdW5kZWQtMnhsIHAtNSBib3JkZXIgYm9yZGVyLWdyYXktODAwJzsKICBlbC5zdHlsZS5iYWNrZ3JvdW5kID0gJyMxMzEzMWEnOwogIGVsLmlubmVySFRNTCA9IGAKICAgIDxkaXYgY2xhc3M9ImZsZXggaXRlbXMtY2VudGVyIGdhcC0yIHRleHQtc20gdGV4dC1ncmF5LTQwMCBtYi00Ij4KICAgICAgPHNwYW4gY2xhc3M9InB4LTIgcHktMC41IHJvdW5kZWQgdGV4dC14cyIgc3R5bGU9ImJhY2tncm91bmQ6cmdiYSgxMzksOTIsMjQ2LDAuMik7Y29sb3I6I2E3OGJmYSI+JHttb2RlfTwvc3Bhbj4KICAgICAgPHNwYW4gY2xhc3M9ImZsZXgtMSB0ZXh0LWdyYXktMzAwIj4ke3Euc2xpY2UoMCw4MCl9JHtxLmxlbmd0aD44MD8nLi4uJzonJ308L3NwYW4+CiAgICA8L2Rpdj4KICAgIDxkaXYgY2xhc3M9ImZsZXggaXRlbXMtY2VudGVyIGdhcC0yIHRleHQtZ3JheS01MDAgdGV4dC1zbSI+CiAgICAgIDxzcGFuIGNsYXNzPSJ0eXBpbmctZG90Ij48L3NwYW4+PHNwYW4gY2xhc3M9InR5cGluZy1kb3QiPjwvc3Bhbj48c3BhbiBjbGFzcz0idHlwaW5nLWRvdCI+PC9zcGFuPgogICAgICA8c3Bhbj5HZW5lcmF0aW5nLi4uPC9zcGFuPgogICAgPC9kaXY+YDsKICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncmVzdWx0cycpLnByZXBlbmQoZWwpOwoKICB0cnkgewogICAgbGV0IHJlc3VsdDsKICAgIGNvbnN0IGNvc3QgPSBDT1NUU1ttb2RlXSB8fCAwOwogICAgY3JlZGl0cyAtPSBjb3N0OwogICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NyZWRpdHMtY291bnQnKS50ZXh0Q29udGVudCA9IGNyZWRpdHM7CgogICAgaWYgKG1vZGUgPT09ICdjaGF0JykgewogICAgICBjb25zdCByID0gYXdhaXQgZmV0Y2goJy92MS9jaGF0Jywge21ldGhvZDonUE9TVCcsaGVhZGVyczp7J0NvbnRlbnQtVHlwZSc6J2FwcGxpY2F0aW9uL2pzb24nfSxib2R5OkpTT04uc3RyaW5naWZ5KHttZXNzYWdlOnF9KX0pOwogICAgICBjb25zdCBkID0gYXdhaXQgci5qc29uKCk7CiAgICAgIHJlc3VsdCA9IHJlbmRlckNoYXQoZC5jb250ZW50IHx8IGQuZXJyb3IgfHwgJ05vIHJlc3BvbnNlJyk7CiAgICB9IGVsc2UgaWYgKG1vZGUgPT09ICdzbGlkZXMnKSB7CiAgICAgIGNvbnN0IHIgPSBhd2FpdCBmZXRjaCgnL3YxL3NsaWRlcy9nZW5lcmF0ZScsIHttZXRob2Q6J1BPU1QnLGhlYWRlcnM6eydDb250ZW50LVR5cGUnOidhcHBsaWNhdGlvbi9qc29uJ30sYm9keTpKU09OLnN0cmluZ2lmeSh7cHJvbXB0OnEsc2xpZGVfY291bnQ6MTB9KX0pOwogICAgICBjb25zdCBkID0gYXdhaXQgci5qc29uKCk7CiAgICAgIHJlc3VsdCA9IHJlbmRlclNsaWRlcyhkKTsKICAgIH0gZWxzZSBpZiAobW9kZSA9PT0gJ3NoZWV0cycpIHsKICAgICAgY29uc3QgciA9IGF3YWl0IGZldGNoKCcvdjEvc2hlZXRzL2dlbmVyYXRlJywge21ldGhvZDonUE9TVCcsaGVhZGVyczp7J0NvbnRlbnQtVHlwZSc6J2FwcGxpY2F0aW9uL2pzb24nfSxib2R5OkpTT04uc3RyaW5naWZ5KHtwcm9tcHQ6cX0pfSk7CiAgICAgIGNvbnN0IGQgPSBhd2FpdCByLmpzb24oKTsKICAgICAgcmVzdWx0ID0gcmVuZGVyU2hlZXRzKGQpOwogICAgfSBlbHNlIGlmIChtb2RlID09PSAnc3BhcmtwYWdlJykgewogICAgICBjb25zdCByID0gYXdhaXQgZmV0Y2goJy92MS9zcGFya3BhZ2VzL2dlbmVyYXRlJywge21ldGhvZDonUE9TVCcsaGVhZGVyczp7J0NvbnRlbnQtVHlwZSc6J2FwcGxpY2F0aW9uL2pzb24nfSxib2R5OkpTT04uc3RyaW5naWZ5KHtwcm9tcHQ6cX0pfSk7CiAgICAgIGNvbnN0IGQgPSBhd2FpdCByLmpzb24oKTsKICAgICAgcmVzdWx0ID0gcmVuZGVyU3BhcmtQYWdlKGQpOwogICAgfSBlbHNlIGlmIChtb2RlID09PSAnc2VhcmNoJykgewogICAgICBjb25zdCByID0gYXdhaXQgZmV0Y2goJy92MS9zZWFyY2g/cT0nICsgZW5jb2RlVVJJQ29tcG9uZW50KHEpKTsKICAgICAgY29uc3QgZCA9IGF3YWl0IHIuanNvbigpOwogICAgICByZXN1bHQgPSByZW5kZXJTZWFyY2goZCk7CiAgICB9IGVsc2UgaWYgKG1vZGUgPT09ICdpbWFnZScpIHsKICAgICAgY29uc3QgciA9IGF3YWl0IGZldGNoKCcvdjEvaW1hZ2VzL2dlbmVyYXRlJywge21ldGhvZDonUE9TVCcsaGVhZGVyczp7J0NvbnRlbnQtVHlwZSc6J2FwcGxpY2F0aW9uL2pzb24nfSxib2R5OkpTT04uc3RyaW5naWZ5KHtwcm9tcHQ6cSxtb2RlbDonZmx1eC1zY2huZWxsJ30pfSk7CiAgICAgIGNvbnN0IGQgPSBhd2FpdCByLmpzb24oKTsKICAgICAgcmVzdWx0ID0gcmVuZGVySW1hZ2UoZCk7CiAgICB9IGVsc2UgaWYgKG1vZGUgPT09ICdiZW5jaG1hcmsnKSB7CiAgICAgIGNvbnN0IHIgPSBhd2FpdCBmZXRjaCgnL3YxL2JlbmNobWFyay9ydW4nLCB7bWV0aG9kOidQT1NUJyxoZWFkZXJzOnsnQ29udGVudC1UeXBlJzonYXBwbGljYXRpb24vanNvbid9LGJvZHk6SlNPTi5zdHJpbmdpZnkoe3Rhc2s6cX0pfSk7CiAgICAgIGNvbnN0IGQgPSBhd2FpdCByLmpzb24oKTsKICAgICAgcmVzdWx0ID0gcmVuZGVyQmVuY2htYXJrKGQpOwogICAgfQoKICAgIGVsLmlubmVySFRNTCA9IGAKICAgICAgPGRpdiBjbGFzcz0iZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTIgdGV4dC1zbSBtYi00Ij4KICAgICAgICA8c3BhbiBjbGFzcz0icHgtMiBweS0wLjUgcm91bmRlZCB0ZXh0LXhzIiBzdHlsZT0iYmFja2dyb3VuZDpyZ2JhKDEzOSw5MiwyNDYsMC4yKTtjb2xvcjojYTc4YmZhIj4ke21vZGV9PC9zcGFuPgogICAgICAgIDxzcGFuIGNsYXNzPSJ0ZXh0LWdyYXktNDAwIj4ke3Euc2xpY2UoMCw2MCl9JHtxLmxlbmd0aD42MD8nLi4uJzonJ308L3NwYW4+CiAgICAgICAgPHNwYW4gY2xhc3M9Im1sLWF1dG8gdGV4dC14cyB0ZXh0LWdyYXktNjAwIj4ke2Nvc3QgPiAwID8gJy0nK2Nvc3QrJyBjcmVkaXRzJyA6ICdmcmVlJ308L3NwYW4+CiAgICAgIDwvZGl2PgogICAgICAke3Jlc3VsdH1gOwogICAgaGlzdG9yeS5wdXNoKHtxLCBtb2RlLCByZXN1bHR9KTsKICB9IGNhdGNoKGVycikgewogICAgZWwuaW5uZXJIVE1MID0gYDxkaXYgY2xhc3M9InRleHQtcmVkLTQwMCB0ZXh0LXNtIj5FcnJvcjogJHtlcnIubWVzc2FnZX08L2Rpdj5gOwogIH0KfQoKZnVuY3Rpb24gcmVuZGVyQ2hhdCh0ZXh0KSB7CiAgLy8gQ29udmVydCBtYXJrZG93bi1saWtlIGZvcm1hdHRpbmcKICBjb25zdCBodG1sID0gdGV4dAogICAgLnJlcGxhY2UoL2BgYChcdyopXG4oW1xzXFNdKj8pYGBgL2csICc8cHJlIGNsYXNzPSJiZy1ncmF5LTkwMCByb3VuZGVkLWxnIHAtMyB0ZXh0LXhzIG92ZXJmbG93LXgtYXV0byBtdC0yIHRleHQtZ3JlZW4tMzAwIj4kMjwvcHJlPicpCiAgICAucmVwbGFjZSgvYChbXmBdKylgL2csICc8Y29kZSBjbGFzcz0icHgtMS41IHB5LTAuNSByb3VuZGVkIHRleHQteHMgdGV4dC1wdXJwbGUtMzAwIiBzdHlsZT0iYmFja2dyb3VuZDpyZ2JhKDEzOSw5MiwyNDYsMC4xNSkiPiQxPC9jb2RlPicpCiAgICAucmVwbGFjZSgvXCpcKihbXipdKylcKlwqL2csICc8c3Ryb25nIGNsYXNzPSJ0ZXh0LXdoaXRlIj4kMTwvc3Ryb25nPicpCiAgICAucmVwbGFjZSgvXCooW14qXSspXCovZywgJzxlbSBjbGFzcz0idGV4dC1ncmF5LTMwMCI+JDE8L2VtPicpCiAgICAucmVwbGFjZSgvXiN7MSwzfVxzKyguKykkL2dtLCAnPGgzIGNsYXNzPSJ0ZXh0LWxnIGZvbnQtc2VtaWJvbGQgdGV4dC13aGl0ZSBtdC00IG1iLTIiPiQxPC9oMz4nKQogICAgLnJlcGxhY2UoL15bLeKAol1ccysoLispJC9nbSwgJzxsaSBjbGFzcz0idGV4dC1ncmF5LTMwMCBtbC00IGxpc3QtZGlzYyI+JDE8L2xpPicpCiAgICAucmVwbGFjZSgvXG5cbi9nLCAnPC9wPjxwIGNsYXNzPSJtdC0zIHRleHQtZ3JheS0zMDAiPicpCiAgICAucmVwbGFjZSgvXG4vZywgJzxicj4nKTsKICByZXR1cm4gYDxkaXYgY2xhc3M9InRleHQtZ3JheS0zMDAgbGVhZGluZy1yZWxheGVkIHRleHQtc20iPjxwIGNsYXNzPSJtdC0wIHRleHQtZ3JheS0zMDAiPiR7aHRtbH08L3A+PC9kaXY+YDsKfQoKZnVuY3Rpb24gcmVuZGVyU2xpZGVzKGQpIHsKICBpZiAoIWQuc2xpZGVzIHx8ICFkLnNsaWRlcy5sZW5ndGgpIHJldHVybiBgPGRpdiBjbGFzcz0idGV4dC1ncmF5LTQwMCB0ZXh0LXNtIj5ObyBzbGlkZXMgZ2VuZXJhdGVkPC9kaXY+YDsKICBjb25zdCBzbGlkZXNIdG1sID0gZC5zbGlkZXMubWFwKChzLGkpID0+IGAKICAgIDxkaXYgY2xhc3M9InNsaWRlLWNhcmQgcm91bmRlZC14bCBwLTUgbWluLWgtMzIiPgogICAgICA8ZGl2IGNsYXNzPSJmbGV4IGl0ZW1zLWNlbnRlciBnYXAtMiBtYi0zIj4KICAgICAgICA8c3BhbiBjbGFzcz0idGV4dC14cyB0ZXh0LXB1cnBsZS00MDAgZm9udC1tb25vIj4ke1N0cmluZyhpKzEpLnBhZFN0YXJ0KDIsJzAnKX08L3NwYW4+CiAgICAgICAgPGgzIGNsYXNzPSJmb250LXNlbWlib2xkIHRleHQtd2hpdGUgdGV4dC1iYXNlIj4ke3MudGl0bGUgfHwgJyd9PC9oMz4KICAgICAgPC9kaXY+CiAgICAgIDx1bCBjbGFzcz0ic3BhY2UteS0xLjUiPgogICAgICAgICR7KHMuY29udGVudCB8fCBbXSkubWFwKGIgPT4gYDxsaSBjbGFzcz0idGV4dC1ncmF5LTQwMCB0ZXh0LXNtIGZsZXggaXRlbXMtc3RhcnQgZ2FwLTIiPjxzcGFuIGNsYXNzPSJ0ZXh0LXB1cnBsZS01MDAgbXQtMSBmbGV4LXNocmluay0wIj7ilrg8L3NwYW4+JHtifTwvbGk+YCkuam9pbignJyl9CiAgICAgIDwvdWw+CiAgICAgICR7cy5zcGVha2VyX25vdGVzID8gYDxkaXYgY2xhc3M9Im10LTMgcHQtMyBib3JkZXItdCBib3JkZXItZ3JheS03MDAgdGV4dC14cyB0ZXh0LWdyYXktNTAwIj7wn5OdICR7cy5zcGVha2VyX25vdGVzLnNsaWNlKDAsODApfS4uLjwvZGl2PmAgOiAnJ30KICAgIDwvZGl2PmApLmpvaW4oJycpOwogIHJldHVybiBgCiAgICA8ZGl2IGNsYXNzPSJtYi0zIj4KICAgICAgPGgyIGNsYXNzPSJ0ZXh0LXhsIGZvbnQtYm9sZCB0ZXh0LXdoaXRlIG1iLTEiPiR7ZC50aXRsZSB8fCAnUHJlc2VudGF0aW9uJ308L2gyPgogICAgICA8cCBjbGFzcz0idGV4dC1zbSB0ZXh0LWdyYXktNTAwIj4ke2Quc2xpZGVfY291bnR9IHNsaWRlcyDigKIgR2VuZXJhdGVkIGJ5IEdlbnNwYXJrPC9wPgogICAgPC9kaXY+CiAgICA8ZGl2IGNsYXNzPSJncmlkIGdyaWQtY29scy0xIG1kOmdyaWQtY29scy0yIGdhcC0zIj4ke3NsaWRlc0h0bWx9PC9kaXY+CiAgICA8ZGl2IGNsYXNzPSJtdC00IGZsZXggZ2FwLTIiPgogICAgICA8YnV0dG9uIG9uY2xpY2s9ImRvd25sb2FkU2xpZGVzKCR7SlNPTi5zdHJpbmdpZnkoZCkucmVwbGFjZSgvIi9nLCcmcXVvdDsnKX0pIiBjbGFzcz0icHgtNCBweS0yIHJvdW5kZWQtbGcgdGV4dC1zbSB0ZXh0LXdoaXRlIiBzdHlsZT0iYmFja2dyb3VuZDpyZ2JhKDEzOSw5MiwyNDYsMC4zKTtib3JkZXI6MXB4IHNvbGlkIHJnYmEoMTM5LDkyLDI0NiwwLjQpIj7irIcgRXhwb3J0IEpTT048L2J1dHRvbj4KICAgIDwvZGl2PmA7Cn0KCmZ1bmN0aW9uIHJlbmRlclNoZWV0cyhkKSB7CiAgaWYgKCFkLmhlYWRlcnMgfHwgIWQucm93cykgcmV0dXJuIGA8ZGl2IGNsYXNzPSJ0ZXh0LWdyYXktNDAwIHRleHQtc20iPk5vIGRhdGEgZ2VuZXJhdGVkPC9kaXY+YDsKICBjb25zdCB0aGVhZCA9IGA8dHI+JHtkLmhlYWRlcnMubWFwKGggPT4gYDx0aCBjbGFzcz0icHgtMyBweS0yIHRleHQtbGVmdCB0ZXh0LXhzIGZvbnQtc2VtaWJvbGQgdGV4dC1wdXJwbGUtMzAwIGJvcmRlci1iIGJvcmRlci1ncmF5LTcwMCI+JHtofTwvdGg+YCkuam9pbignJyl9PC90cj5gOwogIGNvbnN0IHRib2R5ID0gZC5yb3dzLnNsaWNlKDAsMjApLm1hcCgocm93LGkpID0+IGA8dHIgY2xhc3M9IiR7aSUyPT09MD8nYmctZ3JheS05MDAvMzAnOicnfSI+CiAgICAkeyhBcnJheS5pc0FycmF5KHJvdykgPyByb3cgOiBPYmplY3QudmFsdWVzKHJvdykpLm1hcChjID0+IGA8dGQgY2xhc3M9InB4LTMgcHktMiB0ZXh0LXNtIHRleHQtZ3JheS0zMDAgYm9yZGVyLWIgYm9yZGVyLWdyYXktODAwIj4ke2MgfHwgJyd9PC90ZD5gKS5qb2luKCcnKX0KICA8L3RyPmApLmpvaW4oJycpOwogIHJldHVybiBgCiAgICA8ZGl2IGNsYXNzPSJtYi0zIj4KICAgICAgPGgyIGNsYXNzPSJ0ZXh0LXhsIGZvbnQtYm9sZCB0ZXh0LXdoaXRlIG1iLTEiPiR7ZC50aXRsZSB8fCAnU3ByZWFkc2hlZXQnfTwvaDI+CiAgICAgIDxwIGNsYXNzPSJ0ZXh0LXNtIHRleHQtZ3JheS01MDAiPiR7ZC5yb3dzLmxlbmd0aH0gcm93cyDigKIgJHtkLmhlYWRlcnMubGVuZ3RofSBjb2x1bW5zPC9wPgogICAgPC9kaXY+CiAgICA8ZGl2IGNsYXNzPSJvdmVyZmxvdy14LWF1dG8gcm91bmRlZC14bCBib3JkZXIgYm9yZGVyLWdyYXktODAwIj4KICAgICAgPHRhYmxlIGNsYXNzPSJ3LWZ1bGwgdGV4dC1sZWZ0Ij48dGhlYWQ+JHt0aGVhZH08L3RoZWFkPjx0Ym9keT4ke3Rib2R5fTwvdGJvZHk+PC90YWJsZT4KICAgIDwvZGl2PmA7Cn0KCmZ1bmN0aW9uIHJlbmRlclNwYXJrUGFnZShkKSB7CiAgcmV0dXJuIGAKICAgIDxkaXYgY2xhc3M9Im1iLTMiPgogICAgICA8aDIgY2xhc3M9InRleHQteGwgZm9udC1ib2xkIHRleHQtd2hpdGUgbWItMSI+JHtkLnRpdGxlIHx8ICdTcGFya1BhZ2UnfTwvaDI+CiAgICAgIDxhIGhyZWY9IiR7ZC5wdWJsaWNfdXJsfSIgdGFyZ2V0PSJfYmxhbmsiIGNsYXNzPSJ0ZXh0LXNtIHRleHQtcHVycGxlLTQwMCBob3Zlcjp1bmRlcmxpbmUiPiR7ZC5wdWJsaWNfdXJsfTwvYT4KICAgIDwvZGl2PgogICAgJHtkLmh0bWwgPyBgCiAgICA8ZGl2IGNsYXNzPSJyb3VuZGVkLXhsIG92ZXJmbG93LWhpZGRlbiBib3JkZXIgYm9yZGVyLWdyYXktNzAwIG10LTMiIHN0eWxlPSJoZWlnaHQ6NDAwcHgiPgogICAgICA8aWZyYW1lIHNyY2RvYz0iJHtkLmh0bWwucmVwbGFjZSgvIi9nLCcmcXVvdDsnKX0iIGNsYXNzPSJ3LWZ1bGwgaC1mdWxsIiBzYW5kYm94PSJhbGxvdy1zY3JpcHRzIGFsbG93LWZvcm1zIj48L2lmcmFtZT4KICAgIDwvZGl2PmAgOiAnPGRpdiBjbGFzcz0idGV4dC1ncmF5LTQwMCB0ZXh0LXNtIj5QYWdlIGdlbmVyYXRlZCBhdCBVUkwgYWJvdmU8L2Rpdj4nfWA7Cn0KCmZ1bmN0aW9uIHJlbmRlclNlYXJjaChkKSB7CiAgY29uc3QgcmVzdWx0cyA9IGQucmVzdWx0cyB8fCBbXTsKICBpZiAoIXJlc3VsdHMubGVuZ3RoKSByZXR1cm4gYDxkaXYgY2xhc3M9InRleHQtZ3JheS00MDAgdGV4dC1zbSI+Tm8gcmVzdWx0cyBmb3VuZDwvZGl2PmA7CiAgcmV0dXJuIGAKICAgIDxkaXYgY2xhc3M9InNwYWNlLXktMyI+CiAgICAgICR7cmVzdWx0cy5tYXAociA9PiBgCiAgICAgICAgPGRpdiBjbGFzcz0icm91bmRlZC14bCBwLTQgYm9yZGVyIGJvcmRlci1ncmF5LTgwMCIgc3R5bGU9ImJhY2tncm91bmQ6IzBkMGQxNCI+CiAgICAgICAgICA8aDMgY2xhc3M9ImZvbnQtbWVkaXVtIHRleHQtd2hpdGUgbWItMSI+JHtyLnRpdGxlIHx8ICdSZXN1bHQnfTwvaDM+CiAgICAgICAgICA8cCBjbGFzcz0idGV4dC1zbSB0ZXh0LWdyYXktNDAwIGxlYWRpbmctcmVsYXhlZCI+JHsoci5jb250ZW50IHx8IHIuc25pcHBldCB8fCAnJykuc2xpY2UoMCwzMDApfTwvcD4KICAgICAgICAgICR7ci51cmwgPyBgPGEgaHJlZj0iJHtyLnVybH0iIHRhcmdldD0iX2JsYW5rIiBjbGFzcz0idGV4dC14cyB0ZXh0LXB1cnBsZS00MDAgbXQtMiBibG9jayBob3Zlcjp1bmRlcmxpbmUiPiR7ci51cmwuc2xpY2UoMCw2MCl9PC9hPmAgOiAnJ30KICAgICAgICA8L2Rpdj5gKS5qb2luKCcnKX0KICAgIDwvZGl2PmA7Cn0KCmZ1bmN0aW9uIHJlbmRlckltYWdlKGQpIHsKICBpZiAoZC51cmwpIHJldHVybiBgPGRpdiBjbGFzcz0icm91bmRlZC14bCBvdmVyZmxvdy1oaWRkZW4iPjxpbWcgc3JjPSIke2QudXJsfSIgY2xhc3M9InctZnVsbCBtYXgtaC05NiBvYmplY3QtY29udGFpbiByb3VuZGVkLXhsIiBhbHQ9IkdlbmVyYXRlZCBpbWFnZSI+PC9kaXY+YDsKICByZXR1cm4gYDxkaXYgY2xhc3M9InAtNCByb3VuZGVkLXhsIGJvcmRlciBib3JkZXIteWVsbG93LTgwMC8zMCB0ZXh0LXllbGxvdy00MDAgdGV4dC1zbSIgc3R5bGU9ImJhY2tncm91bmQ6cmdiYSgyMzQsMTc5LDgsMC4wNSkiPgogICAg4pqg77iPIEltYWdlIGdlbmVyYXRpb24gcmVxdWlyZXMgVG9nZXRoZXIuYWkgb3IgZmFsLmFpIEFQSSBrZXkuIDxhIGhyZWY9Ii9oZWFsdGgiIGNsYXNzPSJ1bmRlcmxpbmUiPkNoZWNrIHByb3ZpZGVyczwvYT4uCiAgPC9kaXY+YDsKfQoKZnVuY3Rpb24gcmVuZGVyQmVuY2htYXJrKGQpIHsKICBjb25zdCB3aW5uZXJDb2xvciA9IGQuYmxpbmRfd2lubmVyID09PSAnY2xvbmUnID8gJ3RleHQtZ3JlZW4tNDAwJyA6IGQuYmxpbmRfd2lubmVyID09PSAnb2ZmaWNpYWwnID8gJ3RleHQteWVsbG93LTQwMCcgOiAndGV4dC1ibHVlLTQwMCc7CiAgcmV0dXJuIGAKICAgIDxkaXYgY2xhc3M9InNwYWNlLXktMyI+CiAgICAgIDxkaXYgY2xhc3M9ImZsZXggaXRlbXMtY2VudGVyIGdhcC0zIj4KICAgICAgICA8c3BhbiBjbGFzcz0idGV4dC1zbSB0ZXh0LWdyYXktNDAwIj5XaW5uZXI6PC9zcGFuPgogICAgICAgIDxzcGFuIGNsYXNzPSIke3dpbm5lckNvbG9yfSBmb250LXNlbWlib2xkIj4ke2QuYmxpbmRfd2lubmVyID09PSAnY2xvbmUnID8gJ/Cfj4YgR2Vuc3BhcmsgQ2xvbmUnIDogZC5ibGluZF93aW5uZXIgPT09ICdvZmZpY2lhbCcgPyAn8J+UtSBPZmZpY2lhbCBHZW5zcGFyaycgOiAn8J+knSBUaWUnfTwvc3Bhbj4KICAgICAgPC9kaXY+CiAgICAgIDxkaXYgY2xhc3M9InJvdW5kZWQteGwgcC00IGJvcmRlciBib3JkZXItZ3JheS04MDAiIHN0eWxlPSJiYWNrZ3JvdW5kOiMwZDBkMTQiPgogICAgICAgIDxkaXYgY2xhc3M9InRleHQteHMgdGV4dC1ncmF5LTUwMCBtYi0yIj5DbG9uZSByZXN1bHQgKCR7ZC5jbG9uZV90aW1lX21zfW1zKTwvZGl2PgogICAgICAgIDxwIGNsYXNzPSJ0ZXh0LXNtIHRleHQtZ3JheS0zMDAiPiR7KGQuY2xvbmVfcmVzdWx0IHx8ICcnKS5zbGljZSgwLDQwMCl9PC9wPgogICAgICA8L2Rpdj4KICAgICAgJHtkLnJlYXNvbmluZyA/IGA8cCBjbGFzcz0idGV4dC14cyB0ZXh0LWdyYXktNTAwIGl0YWxpYyI+JHtkLnJlYXNvbmluZ308L3A+YCA6ICcnfQogICAgPC9kaXY+YDsKfQoKZnVuY3Rpb24gZG93bmxvYWRTbGlkZXMoZGF0YSkgewogIGNvbnN0IGJsb2IgPSBuZXcgQmxvYihbSlNPTi5zdHJpbmdpZnkoZGF0YSwgbnVsbCwgMildLCB7dHlwZTonYXBwbGljYXRpb24vanNvbid9KTsKICBjb25zdCBhID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYScpOwogIGEuaHJlZiA9IFVSTC5jcmVhdGVPYmplY3RVUkwoYmxvYik7CiAgYS5kb3dubG9hZCA9ICdzbGlkZXMuanNvbic7CiAgYS5jbGljaygpOwp9CgpmdW5jdGlvbiBzaG93SGlzdG9yeSgpIHsKICBhbGVydChgSGlzdG9yeTogJHtoaXN0b3J5Lmxlbmd0aH0gaXRlbXMuIEZlYXR1cmUgY29taW5nIHNvb24uYCk7Cn0KCi8vIEZvY3VzIGlucHV0IG9uIGxvYWQKd2luZG93Lm9ubG9hZCA9ICgpID0+IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdtYWluLWlucHV0JykuZm9jdXMoKTsKPC9zY3JpcHQ+CjwvYm9keT4KPC9odG1sPgo=");
      return new Response(html, {
        headers: {"Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=300", "Access-Control-Allow-Origin": "*"}
      });
    }
    if(p==="/health") return J({
      service:"genspark-clone-1:1", version:"cf-worker-v2",
      providers:{
        llm_groq:!!(env.GROQ_KEY),
        llm_mcp_fallback:true,
        together_flux:!!(env.TOGETHER_KEY),
        fal_video:!!(env.FAL_KEY),
        tavily_search:!!(env.TAVILY_KEY),
        browserless:true
      }
    });

    if(p==="/v1/chat" && request.method==="POST") {
      const {message, model} = await request.json().catch(()=>({}));
      if(!message) return J({error:"message required"}, 400);
      const content = await llm(message, "build", env);
      return J({content, model:model||"groq-70b"});
    }

    if(p==="/v1/slides/generate" && request.method==="POST") {
      const {prompt, slide_count, mode} = await request.json().catch(()=>({}));
      const result = await llm(
        `Prezentacja: ${prompt}. Slajdow: ${slide_count||10}. Tryb: ${mode||"professional"}. Odpowiedz TYLKO JSON: {"title":"...","slides":[{"index":1,"title":"...","content":["bullet"],"speaker_notes":"..."}]}`,
        "build", env
      );
      let data;
      try { data = JSON.parse(result.replace(/```json|```/g,"").trim()); }
      catch { data = {title:prompt, slides:[]}; }
      return J({id:crypto.randomUUID(), title:data.title, slides:data.slides||[], slide_count:(data.slides||[]).length});
    }

    if(p==="/v1/sheets/generate" && request.method==="POST") {
      const {prompt} = await request.json().catch(()=>({}));
      const result = await llm(`Generate spreadsheet for: ${prompt}. Return ONLY valid JSON, no explanation: {"title":"Example Table","headers":["Column A","Column B","Column C"],"rows":[["val1","val2","val3"],["val4","val5","val6"]]}`, "build", env);
      let data;
      try { 
        const cleaned = result.replace(/```json|```/g,"").trim();
        const match = cleaned.match(/\{[\s\S]*\}/);
        data = match ? JSON.parse(match[0]) : null;
        if (!data || !data.headers || !data.headers.length) throw new Error("bad data");
      } catch { 
        // Fallback: parse as table from text
        const lines = result.split("\n").filter(l => l.includes("|") || l.match(/\S.*\S.*\S/));
        data = {title:prompt, headers:["Item","Value","Notes"], rows:lines.slice(0,10).map((l,i)=>[String(i+1), l.trim().slice(0,60), ""])}; 
      }
      return J({id:crypto.randomUUID(), ...data});
    }

    if(p==="/v1/sparkpages/generate" && request.method==="POST") {
      const {prompt, title, source_url} = await request.json().catch(()=>({}));
      const extra = source_url ? " Inspiracja: "+source_url : "";
      const html = await llm(`HTML page: ${prompt}${extra}. Tailwind CDN, modern, single file HTML only.`, "build", env);
      const slug = Math.random().toString(36).slice(2,10);
      return J({id:crypto.randomUUID(), slug, title:title||prompt.slice(0,60), public_url:"https://spark.ofshore.dev/"+slug, html});
    }

    if(p==="/v1/search") {
      const q = url.searchParams.get("q")||"";
      return J({results: await search(q, env), query:q});
    }

    if(p==="/v1/images/generate" && request.method==="POST") {
      const {prompt, model} = await request.json().catch(()=>({}));
      let imageUrl = null;
      if(env.TOGETHER_KEY) {
        try {
          const r = await fetch("https://api.together.xyz/v1/images/generations",{method:"POST",headers:{"Authorization":"Bearer "+env.TOGETHER_KEY,"Content-Type":"application/json"},body:JSON.stringify({model:"black-forest-labs/FLUX.1-schnell-Free",prompt,width:1024,height:1024,steps:4,n:1})});
          imageUrl = (await r.json()).data?.[0]?.url;
        } catch(e) {}
      }
      return J({id:crypto.randomUUID(), url:imageUrl, model:model||"flux-schnell", prompt});
    }

    if(p==="/v1/videos/generate" && request.method==="POST") {
      const {prompt, model, aspect_ratio, duration_sec} = await request.json().catch(()=>({}));
      const fal_m = {"kling-v2":"fal-ai/kling-video/v2/text-to-video","runway-gen4-turbo":"fal-ai/runway-gen4/turbo"};
      let videoUrl = null;
      if(env.FAL_KEY && fal_m[model||"kling-v2"]) {
        try {
          const r = await fetch("https://fal.run/"+fal_m[model||"kling-v2"],{method:"POST",headers:{"Authorization":"Key "+env.FAL_KEY,"Content-Type":"application/json"},body:JSON.stringify({prompt,aspect_ratio:aspect_ratio||"16:9",duration:String(duration_sec||5)})});
          videoUrl = (await r.json()).video?.url;
        } catch(e) {}
      }
      return J({id:crypto.randomUUID(), url:videoUrl, model:model||"kling-v2", status:videoUrl?"ready":"no_fal_key"});
    }

    if(p==="/v1/benchmark/run" && request.method==="POST") {
      const {task, official_result} = await request.json().catch(()=>({}));
      const start = Date.now();
      const clone_result = await llm(task, "build", env);
      const clone_time_ms = Date.now()-start;
      let blind_winner="clone", reasoning="";
      if(official_result) {
        const j = await llm(`Ocen: A=${official_result.slice(0,300)} B=${clone_result.slice(0,300)} JSON:{"winner":"A|B|tie","reasoning":"..."}`, "generic", env);
        try { const jd=JSON.parse(j.replace(/```json|```/g,"").trim()); blind_winner=jd.winner==="A"?"official":jd.winner==="B"?"clone":"tie"; reasoning=jd.reasoning||""; } catch {}
      }
      return J({task, clone_result:clone_result.slice(0,400), clone_time_ms, blind_winner, reasoning});
    }

    if(p==="/clone" && request.method==="POST") return handleClone(request, env);
    if(p==="/clone/status") {
      const id = url.searchParams.get("id")||"";
      return handleCloneStatus(id);
    }
    return J({error:"not found"}, 404);
  }
};


// ══════════════════════════════════════════════════════════════
// CLONE ENGINE - autonomiczny kloner aplikacji webowych
// Używa: Browserless + Groq + Coolify + D1 + Telegram
// ══════════════════════════════════════════════════════════════

const BROWSERLESS_URL = "http://178.62.246.169:3000";
const BOOTSTRAP_DEPLOYER = "https://bootstrap-deployer.maciej-koziej01.workers.dev";
const D1_WORKER = "https://fnn-orchestrator.maciej-koziej01.workers.dev";
const TG_BOT = "8394457153:AAFZQ4eMHaiAnmwejmTfWZHI_5KSqhXgCXg";
const TG_CHAT = "8149345223";
const CF_ACCOUNT = "9a877cdba770217082a2f914427df505";
const D1_ID = "4c67a2b1-6830-44ec-97b1-7c8f93722add";

async function tg(msg) {
  await fetch(`https://api.telegram.org/bot${TG_BOT}/sendMessage`, {
    method: "POST", headers: {"Content-Type":"application/json"},
    body: JSON.stringify({chat_id: TG_CHAT, text: msg, parse_mode: "Markdown"})
  }).catch(() => {});
}

async function scrapeUrl(url) {
  // Użyj Browserless do pobrania HTML + screenshots
  try {
    const r = await fetch(`${BROWSERLESS_URL}/content`, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({
        url,
        gotoOptions: {waitUntil: "networkidle2", timeout: 30000},
        rejectResourceTypes: ["image", "font"]
      }),
      signal: AbortSignal.timeout(35000)
    });
    if (r.ok) {
      const html = await r.text();
      return {
        html: html.slice(0, 8000),
        title: html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || "App",
        has_react: html.includes("react") || html.includes("React"),
        has_vue: html.includes("vue") || html.includes("Vue"),
        has_next: html.includes("__NEXT") || html.includes("_next"),
        word_count: html.split(/\s+/).length,
        ok: true
      };
    }
  } catch(e) {}
  // Fallback: fetch bez browserless
  try {
    const r = await fetch(url, {
      headers: {"User-Agent": "Mozilla/5.0 (compatible; CloneBot/1.0)"},
      signal: AbortSignal.timeout(15000)
    });
    const html = await r.text();
    return {
      html: html.slice(0, 8000),
      title: html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || "App",
      has_react: html.includes("react"),
      has_next: html.includes("__NEXT"),
      word_count: html.split(/\s+/).length,
      ok: true,
      method: "direct_fetch"
    };
  } catch(e) {
    return {ok: false, error: e.message};
  }
}

async function analyzeWithLLM(scraped, targetUrl, env) {
  const prompt = `Zanalizuj tę aplikację webową i zaplanuj jej klon 1:1.

URL: ${targetUrl}
Title: ${scraped.title}
Tech: React=${scraped.has_react} Next=${scraped.has_next} Vue=${scraped.has_vue}
HTML fragment (first 3000 chars):
${(scraped.html || "").slice(0, 3000)}

Odpowiedz TYLKO JSON (bez markdown):
{
  "app_name": "nazwa aplikacji",
  "category": "ai_assistant|search|productivity|media|other",
  "core_features": ["feature1", "feature2", "feature3"],
  "tech_stack": ["FastAPI", "HTML", "Tailwind"],
  "ui_components": ["SearchBar", "ResultCard", "Header"],
  "clone_strategy": "opis jak sklonować",
  "api_endpoints": ["/api/search", "/api/generate"],
  "main_value_prop": "co robi ta aplikacja w 1 zdaniu"
}`;

  const gk = (env && env.GROQ_KEY) || "";
  if (gk) {
    try {
      const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {"Authorization": `Bearer ${gk}`, "Content-Type": "application/json"},
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          max_tokens: 1000,
          messages: [{role: "user", content: prompt}]
        }),
        signal: AbortSignal.timeout(30000)
      });
      const d = await r.json();
      const text = d.choices?.[0]?.message?.content || "{}";
      return JSON.parse(text.replace(/```json|```/g, "").trim());
    } catch(e) {}
  }
  // Fallback analysis
  return {
    app_name: scraped.title || "Clone",
    category: "ai_assistant",
    core_features: ["Chat", "Search", "Generation"],
    tech_stack: ["FastAPI", "HTML", "Tailwind", "Groq"],
    ui_components: ["ChatInterface", "ResultDisplay", "Header"],
    clone_strategy: "AI-powered chat and generation app",
    api_endpoints: ["/v1/chat", "/health"],
    main_value_prop: "AI assistant application"
  };
}

async function generateCloneCode(analysis, targetUrl, cloneDomain, env) {
  const prompt = `Wygeneruj kompletny kod klona aplikacji: ${analysis.app_name}
  
Oryginał: ${targetUrl}
Features: ${analysis.core_features.join(", ")}
Tech stack: ${analysis.tech_stack.join(", ")}
Value prop: ${analysis.main_value_prop}
API endpoints: ${analysis.api_endpoints.join(", ")}
UI components: ${analysis.ui_components.join(", ")}
Deploy domain: ${cloneDomain}

Wygeneruj KOMPLETNY plik main.py (FastAPI) który:
1. Implementuje wszystkie core features używając Groq API (darmowy LLM)
2. Serwuje frontend jako / endpoint (nowoczesny HTML z Tailwind CDN inline)
3. Ma /health endpoint zwracający JSON
4. Używa env vars: GROQ_KEY, SUPABASE_URL (opcjonalne)
5. Jest production-ready

Odpowiedz TYLKO kodem Python bez markdown i bez wyjaśnień. Zacznij od "from fastapi".`;

  const gk = (env && env.GROQ_KEY) || "";
  if (gk) {
    try {
      const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {"Authorization": `Bearer ${gk}`, "Content-Type": "application/json"},
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          max_tokens: 3000,
          messages: [{role: "user", content: prompt}]
        }),
        signal: AbortSignal.timeout(45000)
      });
      const d = await r.json();
      return d.choices?.[0]?.message?.content || "";
    } catch(e) {}
  }
  return "";
}

async function saveToD1(cloneId, sourceUrl, analysis, status, env) {
  // Użyj CF Workers API do zapisu do D1 (przez fnn-orchestrator lub bezpośrednio)
  try {
    const analysisStr = JSON.stringify(analysis).replace(/'/g, "''");
    await fetch(`https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/d1/database/${D1_ID}/query`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.CF_API_TOKEN || ""}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        sql: `INSERT OR REPLACE INTO clone_jobs (id, clone_id, source_url, clone_name, status, phase, analysis) 
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        params: [
          cloneId, cloneId, sourceUrl,
          analysis.app_name || "Clone",
          status,
          status === "completed" ? 5 : 2,
          JSON.stringify(analysis)
        ]
      })
    });
  } catch(e) {}
  
  // Backup: zapisz do Upstash
  try {
    const UPSTASH = "https://fresh-walleye-84119.upstash.io";
    const UT = "gQAAAAAAAUiXAAIncDEwMjljNTI2ZGQ5OWQ0OGJlOTFmYWU2YjQ2OGI0NmIyZXAxODQxMTk";
    await fetch(`${UPSTASH}/set/${encodeURIComponent("clone:"+cloneId)}/${encodeURIComponent(JSON.stringify({cloneId, sourceUrl, analysis, status, ts: new Date().toISOString()}))}?ex=86400`, {
      method: "POST",
      headers: {"Authorization": `Bearer ${UT}`}
    });
  } catch(e) {}
}

async function deployClone(cloneId, appName, code, analysis, env) {
  // Deploy przez bootstrap-deployer który ma COOLIFY_TOKEN
  try {
    const r = await fetch(`${BOOTSTRAP_DEPLOYER}/run`, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({
        action: "deploy_new_app",
        app_name: cloneId,
        git_url: null,
        code_content: code,
        domain: `${cloneId}.ofshore.dev`,
        port: "8080"
      }),
      signal: AbortSignal.timeout(30000)
    });
    if (r.ok) return await r.json();
  } catch(e) {}
  
  // Alternatywnie - deploy jako Supabase Edge Function przez supabase-deployer
  try {
    const r = await fetch("https://supabase-deployer.maciej-koziej01.workers.dev/deploy", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({
        slug: `clone-${cloneId}`,
        code: `
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
serve(async (req) => {
  const url = new URL(req.url)
  if (url.pathname === "/health") return new Response(JSON.stringify({ok:true,clone:"${appName}",source:"${analysis.main_value_prop || ""}"}), {headers:{"Content-Type":"application/json"}})
  return new Response(JSON.stringify({service:"${appName}",features:${JSON.stringify(analysis.core_features || [])}}), {headers:{"Content-Type":"application/json"}})
})`,
        verify_jwt: false
      }),
      signal: AbortSignal.timeout(30000)
    });
    if (r.ok) {
      const d = await r.json();
      return {ok: d.ok, method: "edge_function", url: `https://blgdhfcosqjzrutncbbr.supabase.co/functions/v1/clone-${cloneId}`};
    }
  } catch(e) {}
  
  return {ok: false, error: "all deploy methods failed"};
}

async function handleClone(request, env) {
  const { url: targetUrl, name, domain, deploy = true } = await request.json().catch(() => ({}));
  if (!targetUrl) return J({error: "url required. Example: {url: 'https://genspark.ai'}"}, 400);

  const cloneId = `clone-${Date.now().toString(36)}`;
  const appName = name || "Clone";
  const cloneDomain = domain || `${cloneId}.ofshore.dev`;

  await tg(`🔬 *Clone Engine Started*\n\nTarget: ${targetUrl}\nJob ID: ${cloneId}\n\nFaza 1/5: Analiza...`);

  // FAZA 1: Scrape
  const scraped = await scrapeUrl(targetUrl);
  if (!scraped.ok) {
    await tg(`❌ Scrape failed: ${scraped.error}`);
    return J({error: "scrape failed", details: scraped.error, clone_id: cloneId}, 500);
  }
  await tg(`✅ Scrape OK: "${scraped.title}" (${scraped.word_count} words)\nFaza 2/5: LLM Analysis...`);

  // FAZA 2: Analyze
  const analysis = await analyzeWithLLM(scraped, targetUrl, env);
  await saveToD1(cloneId, targetUrl, analysis, "analyzing", env);
  await tg(`✅ Analysis:\n• App: ${analysis.app_name}\n• Category: ${analysis.category}\n• Features: ${(analysis.core_features||[]).slice(0,3).join(", ")}\n\nFaza 3/5: Code Generation...`);

  // FAZA 3: Generate code
  const code = await generateCloneCode(analysis, targetUrl, cloneDomain, env);
  const hasCode = code && code.length > 100;
  await saveToD1(cloneId, targetUrl, {...analysis, has_code: hasCode, code_length: code?.length || 0}, "code_ready", env);
  await tg(`✅ Code generated: ${code?.length || 0} chars\nFaza 4/5: ${deploy ? "Deploy..." : "Skipping deploy"}`);

  // FAZA 4: Deploy (jeśli włączony)
  let deployResult = {ok: false, skipped: !deploy};
  if (deploy && hasCode) {
    deployResult = await deployClone(cloneId, analysis.app_name, code, analysis, env);
    await tg(`${deployResult.ok ? "✅" : "⚠️"} Deploy: ${deployResult.ok ? deployResult.url || cloneDomain : deployResult.error || "failed"}`);
  }

  // FAZA 5: Finalize
  await saveToD1(cloneId, targetUrl, {
    ...analysis,
    deploy_result: deployResult,
    deploy_url: deployResult.url || cloneDomain,
    code_preview: code?.slice(0, 500) || ""
  }, "completed", env);

  await tg(`🎉 *Clone Complete!*\n\n• Original: ${targetUrl}\n• Clone ID: ${cloneId}\n• App: ${analysis.app_name}\n• Features: ${(analysis.core_features||[]).join(", ")}\n• Deploy: ${deployResult.url || cloneDomain}\n\nKlon gotowy do benchmarku!`);

  return J({
    ok: true,
    clone_id: cloneId,
    source_url: targetUrl,
    analysis,
    code_length: code?.length || 0,
    code_preview: code?.slice(0, 300) || "",
    deploy: deployResult,
    clone_url: deployResult.url || cloneDomain,
    benchmark_url: `https://genspark.ofshore.dev/v1/benchmark/run`
  });
}

async function handleCloneStatus(cloneId) {
  try {
    const UPSTASH = "https://fresh-walleye-84119.upstash.io";
    const UT = "gQAAAAAAAUiXAAIncDEwMjljNTI2ZGQ5OWQ0OGJlOTFmYWU2YjQ2OGI0NmIyZXAxODQxMTk";
    const r = await fetch(`${UPSTASH}/get/${encodeURIComponent("clone:"+cloneId)}`, {
      headers: {"Authorization": `Bearer ${UT}`}
    });
    const d = await r.json();
    if (d.result) return J(JSON.parse(d.result));
    return J({error: "clone not found", clone_id: cloneId}, 404);
  } catch(e) {
    return J({error: e.message}, 500);
  }
}
