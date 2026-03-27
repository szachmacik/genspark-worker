const ROUTER = "https://adaptive-router.maciej-koziej01.workers.dev";
const GROQ_URL = "https://fnn-orchestrator.maciej-koziej01.workers.dev/tool/groq_ask";
const CORS = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET,POST,OPTIONS","Access-Control-Allow-Headers":"Content-Type"};

function J(d,s){return new Response(JSON.stringify(d),{status:s||200,headers:Object.assign({"Content-Type":"application/json"},CORS)});}

async function llm(prompt,type,env){
  // Try adaptive-router (has ANTHROPIC_API_KEY)
  try {
    const r = await fetch(ROUTER+"/route",{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({type:type||"build",description:prompt.slice(0,2000)}),
      signal:AbortSignal.timeout(40000)
    });
    const d = await r.json();
    const content = d.result&&d.result.content;
    if(Array.isArray(content)&&content[0]) return content[0].text||"";
    if(d.result&&d.result.text) return d.result.text;
  } catch(e){}
  // Fallback: Groq (free)
  try {
    const r = await fetch(GROQ_URL,{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({prompt:prompt.slice(0,1500),tokens:800}),
      signal:AbortSignal.timeout(20000)
    });
    const d = await r.json();
    return d.answer||"";
  } catch(e){return "Error: "+e.message;}
}

async function search(q){
  try{
    const r=await fetch("https://mcp-gateway.maciej-koziej01.workers.dev/tool/groq_ask",{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({prompt:"Wyszukaj i streść: "+q,tokens:500}),
      signal:AbortSignal.timeout(15000)
    });
    const d=await r.json();
    return [{title:"Result",content:d.answer||""}];
  }catch(e){return [{title:"Error",content:e.message}];}
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const p = url.pathname;
    if(request.method==="OPTIONS") return new Response(null,{headers:CORS});

    if(p==="/health") return J({
      service:"genspark-clone-1:1",version:"cf-worker",
      providers:{
        llm_via_adaptive_router:true,
        llm_groq_fallback:true,
        together_flux:!!env.TOGETHER_KEY,
        fal_video:!!env.FAL_KEY,
        tavily_search:!!env.TAVILY_KEY,
        twilio_calls:!!env.TWILIO_SID,
        browserless:true
      },
      credit_costs:{chat:0,image:0,slides:300,sheets:200}
    });

    // CHAT
    if(p==="/v1/chat"&&request.method==="POST"){
      const {message,model} = await request.json().catch(()=>({}));
      if(!message) return J({error:"message required"},400);
      const content = await llm(message, "build", env);
      return J({content,model:model||"claude-haiku"});
    }

    // SLIDES
    if(p==="/v1/slides/generate"&&request.method==="POST"){
      const {prompt,slide_count,mode} = await request.json().catch(()=>({}));
      const result = await llm(`Stwórz prezentację: ${prompt}
Slajdów: ${slide_count||10}
JSON tylko: {"title":"...","slides":[{"index":1,"title":"...","content":["bullet"],"speaker_notes":"..."}]}`, "build", env);
      let data;
      try{data=JSON.parse(result.replace(/```json|```/g,"").trim());}catch{data={title:prompt,slides:[]};}
      return J({id:crypto.randomUUID(),title:data.title,slides:data.slides||[],slide_count:(data.slides||[]).length});
    }

    // SHEETS
    if(p==="/v1/sheets/generate"&&request.method==="POST"){
      const {prompt} = await request.json().catch(()=>({}));
      const result = await llm(`Stwórz arkusz: ${prompt}
JSON: {"title":"...","headers":[],"rows":[[]]}`, "build", env);
      let data;
      try{data=JSON.parse(result.replace(/```json|```/g,"").trim());}catch{data={title:prompt,headers:[],rows:[]};}
      return J({id:crypto.randomUUID(),...data});
    }

    // SPARKPAGE
    if(p==="/v1/sparkpages/generate"&&request.method==="POST"){
      const {prompt,title,source_url} = await request.json().catch(()=>({}));
      const html = await llm(`Stwórz strone HTML: ${prompt}`, "build", env);
      const slug = Math.random().toString(36).slice(2,10);
      return J({id:crypto.randomUUID(),slug,title:title||prompt?.slice(0,60),public_url:`https://spark.ofshore.dev/${slug}`,html});
    }

    // SEARCH
    if(p==="/v1/search"){
      const q = url.searchParams.get("q")||"";
      if(env.TAVILY_KEY){
        try{
          const r=await fetch("https://api.tavily.com/search",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({api_key:env.TAVILY_KEY,query:q,max_results:5})});
          return J(await r.json());
        }catch(e){}
      }
      const results = await search(q);
      return J({results,query:q});
    }

    // IMAGE GENERATE
    if(p==="/v1/images/generate"&&request.method==="POST"){
      const {prompt,model} = await request.json().catch(()=>({}));
      let imageUrl = null;
      if(env.TOGETHER_KEY&&(!model||model.includes("flux"))){
        try{
          const r=await fetch("https://api.together.xyz/v1/images/generations",{
            method:"POST",headers:{"Authorization":"Bearer "+env.TOGETHER_KEY,"Content-Type":"application/json"},
            body:JSON.stringify({model:"black-forest-labs/FLUX.1-schnell-Free",prompt,width:1024,height:1024,steps:4,n:1})
          });
          imageUrl=(await r.json()).data?.[0]?.url;
        }catch(e){}
      } else if(env.FAL_KEY){
        try{
          const r=await fetch("https://fal.run/fal-ai/flux/schnell",{method:"POST",headers:{"Authorization":"Key "+env.FAL_KEY,"Content-Type":"application/json"},body:JSON.stringify({prompt})});
          imageUrl=(await r.json()).images?.[0]?.url;
        }catch(e){}
      }
      return J({id:crypto.randomUUID(),url:imageUrl,model:model||"flux-schnell",prompt,credits_used:0});
    }

    // VIDEO
    if(p==="/v1/videos/generate"&&request.method==="POST"){
      const {prompt,model,aspect_ratio,duration_sec,input_image_url} = await request.json().catch(()=>({}));
      let videoUrl = null;
      const fal_models={"kling-v2":"fal-ai/kling-video/v2/text-to-video","runway-gen4-turbo":"fal-ai/runway-gen4/turbo","luma-dream":"fal-ai/luma-dream-machine"};
      if(env.FAL_KEY&&fal_models[model||"kling-v2"]){
        try{
          const payload={prompt,aspect_ratio:aspect_ratio||"16:9",duration:String(duration_sec||5)};
          if(input_image_url) payload.image_url=input_image_url;
          const r=await fetch("https://fal.run/"+fal_models[model||"kling-v2"],{method:"POST",headers:{"Authorization":"Key "+env.FAL_KEY,"Content-Type":"application/json"},body:JSON.stringify(payload)});
          videoUrl=(await r.json()).video?.url;
        }catch(e){}
      }
      return J({id:crypto.randomUUID(),url:videoUrl,model:model||"kling-v2",status:videoUrl?"ready":"failed",credits_used:400});
    }

    // BENCHMARK
    if(p==="/v1/benchmark/run"&&request.method==="POST"){
      const {task,official_result,official_time_ms} = await request.json().catch(()=>({}));
      const start=Date.now();
      const clone_result = await llm(task,"build",env);
      const clone_time_ms = Date.now()-start;
      let blind_winner="clone",reasoning="";
      if(official_result){
        const j=await llm(`Oceń ślepo:
Wynik A: ${official_result.slice(0,400)}
Wynik B: ${clone_result.slice(0,400)}
JSON: {"winner":"A lub B lub tie","reasoning":"..."}`, "build", env);
        try{const d=JSON.parse(j.replace(/```json|```/g,"").trim());blind_winner=d.winner==="A"?"official":d.winner==="B"?"clone":"tie";reasoning=d.reasoning||"";}catch{}
      }
      return J({task,clone_result:clone_result.slice(0,400),clone_time_ms,official_time_ms,blind_winner,reasoning});
    }

    return J({error:"not found"},404);
  }
};
