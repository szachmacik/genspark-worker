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
