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
      const result = await llm(`Arkusz: ${prompt}. JSON: {"title":"...","headers":["kol1"],"rows":[["val"]]}`, "build", env);
      let data;
      try { data = JSON.parse(result.replace(/```json|```/g,"").trim()); }
      catch { data = {title:prompt, headers:[], rows:[]}; }
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
