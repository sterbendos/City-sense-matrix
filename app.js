const $=s=>document.querySelector(s)
const ls=(k,v)=>v===undefined?localStorage.getItem(k):localStorage.setItem(k,v)
const enc=o=>new URLSearchParams(o).toString()
let base="",demo=false,autopoll=null,chartTimer=null,demHist=[]
const badge=s=>{$("#connBadge").textContent=s}
const hint=s=>{$("#hint").textContent=s||""}
const setSig=(el,v)=>{el.classList.remove("r","y","g");el.textContent=v||"—";if(v==="R")el.classList.add("r");if(v==="Y")el.classList.add("y");if(v==="G")el.classList.add("g")}
const now=()=>Date.now()

async function req(path,opts={}){
  if(demo) return null
  const url=(base||"").replace(/\/$/,"")+path
  const o={method:"GET",credentials:"include",mode:"cors",cache:"no-store",headers:{},...opts}
  if(o.body&&typeof o.body==="string"&&!o.headers["Content-Type"]) o.headers["Content-Type"]="application/x-www-form-urlencoded"
  const ctl=new AbortController()
  const t=setTimeout(()=>ctl.abort(),2500)
  o.signal=ctl.signal
  try{
    const r=await fetch(url,o)
    clearTimeout(t)
    return r
  }catch(e){
    clearTimeout(t)
    throw e
  }
}

function demoStep(){
  const last=demHist.length?demHist[demHist.length-1]:{ts:0,cars_in:0,cars_out:0,occ:0,mq:120}
  const ts=last.ts+400
  let ci=last.cars_in+(Math.random()<.35?1:0)
  let co=last.cars_out+(Math.random()<.28?1:0)
  let occ=ci-co
  let mq=Math.max(0,last.mq+(Math.random()-.48)*6)
  demHist.push({ts,cars_in:ci,cars_out:co,occ,mq})
  if(demHist.length>220) demHist.shift()
  const emActive=Math.random()<.02?1:0
  const tleft=emActive?15000:0
  return {ts,conn:{state:"ONLINE",pps:3.2,port:"DEMO",baud:0},ir:{cars_in:ci,cars_out:co,occupancy:occ,in_rate_pm:0,out_rate_pm:0},air:{mq135:mq,before:null,after:null},emergency:{active:emActive,tag:emActive?"DEMO":"",until:emActive?ts+tleft:0,since:0},lights:{mode:Math.random()<.2?"MANUAL":"AUTO",armed:Math.random()<.4?1:0,unlocked:1,intersection:{A:["R","Y","G"][Math.floor(Math.random()*3)],B:["R","Y","G"][Math.floor(Math.random()*3)],C:["R","Y","G"][Math.floor(Math.random()*3)],D:["R","Y","G"][Math.floor(Math.random()*3)]}},alerts:[],events:[{ts,type:"link",sev:"ok",msg:"Demo running"}],raw:`{"cars_in":${ci},"cars_out":${co},"mq135":${mq.toFixed(2)}}`}
}

function renderUI(d){
  $("#carsIn").textContent=d.ir?.cars_in??0
  $("#carsOut").textContent=d.ir?.cars_out??0
  $("#occ").textContent=d.ir?.occupancy??0
  $("#mq135").textContent=d.air?.mq135?.toFixed?d.air.mq135.toFixed(2):((d.air?.mq135??0)+"")
  $("#airBefore").textContent=(d.air?.before==null||Number.isNaN(d.air?.before))?"—":(+d.air.before).toFixed(2)
  $("#airAfter").textContent=(d.air?.after==null||Number.isNaN(d.air?.after))?"—":(+d.air.after).toFixed(2)
  const em=d.emergency||{}
  $("#emActive").textContent=em.active??0
  $("#emTag").textContent=em.tag||"—"
  const ts=d.ts||0
  const until=em.until||0
  const rem=Math.max(0,Math.round((until-ts)/1000))
  $("#emRem").textContent=rem+"s"
  $("#mode").textContent=d.lights?.mode||"—"
  $("#armed").textContent=d.lights?.armed??0
  $("#unlocked").textContent=d.lights?.unlocked??0
  setSig($("#laneA"),d.lights?.intersection?.A)
  setSig($("#laneB"),d.lights?.intersection?.B)
  setSig($("#laneC"),d.lights?.intersection?.C)
  setSig($("#laneD"),d.lights?.intersection?.D)
  const alerts=(d.alerts||[]).map(a=>`<div class="item"><div class="t">${(a.sev||"").toUpperCase()} • ${a.type||"alert"}</div><div class="m">${a.msg||""}</div></div>`).join("")||`<div class="sub">No alerts.</div>`
  const events=(d.events||[]).slice(0,12).map(e=>`<div class="item"><div class="t">${(e.sev||"").toUpperCase()} • ${e.type||"event"}</div><div class="m">${e.msg||""}</div></div>`).join("")||`<div class="sub">No events.</div>`
  $("#alerts").innerHTML=alerts
  $("#events").innerHTML=events
}

function drawChart(ir,air){
  const c=$("#chart"),g=c.getContext("2d"),w=c.width,h=c.height
  g.clearRect(0,0,w,h)
  const pad=26,grid=6
  g.globalAlpha=.35
  for(let i=0;i<=grid;i++){
    const y=pad+(h-2*pad)*(i/grid)
    g.beginPath();g.moveTo(pad,y);g.lineTo(w-pad,y);g.stroke()
  }
  g.globalAlpha=1
  const pts=ir?.length?ir:demHist.map(p=>({ts:p.ts,occupancy:p.occ,cars_in:p.cars_in,cars_out:p.cars_out}))
  const aps=air?.length?air:demHist.map(p=>({ts:p.ts,mq135:p.mq}))
  if(!pts.length||!aps.length) return
  const x0=Math.min(pts[0].ts,aps[0].ts),x1=Math.max(pts[pts.length-1].ts,aps[aps.length-1].ts)
  const occs=pts.map(p=>p.occupancy||0),mqs=aps.map(a=>a.mq135||0)
  const o0=Math.min(...occs),o1=Math.max(...occs),m0=Math.min(...mqs),m1=Math.max(...mqs)
  const x=t=>pad+(w-2*pad)*(x1===x0?0:(t-x0)/(x1-x0))
  const yOcc=v=>pad+(h-2*pad)*(o1===o0?.5:1-(v-o0)/(o1-o0))
  const yMq=v=>pad+(h-2*pad)*(m1===m0?.5:1-(v-m0)/(m1-m0))
  g.lineWidth=3
  g.beginPath()
  pts.forEach((p,i)=>{const X=x(p.ts),Y=yOcc(p.occupancy||0);if(!i)g.moveTo(X,Y);else g.lineTo(X,Y)})
  g.stroke()
  g.globalAlpha=.75
  g.lineWidth=2
  g.beginPath()
  aps.forEach((a,i)=>{const X=x(a.ts),Y=yMq(a.mq135||0);if(!i)g.moveTo(X,Y);else g.lineTo(X,Y)})
  g.stroke()
  g.globalAlpha=1
}

async function pullUI(){
  if(demo){
    const d=demoStep()
    renderUI(d)
    badge("DEMO ONLINE")
    hint("Demo mode (Vercel-safe). For device: run this page over HTTP on your laptop, or use an HTTPS proxy.")
    drawChart(null,null)
    return
  }
  try{
    const r=await req("/api/ui")
    if(r.status===401){badge("AUTH REQUIRED");hint("Login required (cookie). If hosted on HTTPS, use local run for HTTP device.");return}
    if(!r.ok){badge("ERROR "+r.status);hint(await r.text());return}
    const d=await r.json()
    renderUI(d)
    badge("ONLINE • "+(d.conn?.port||"DEVICE"))
    hint("")
  }catch(e){
    badge("OFFLINE")
    hint("Cannot reach device. If Vercel(HTTPS) → ESP32(HTTP), browser blocks it. Run locally over HTTP.")
  }
}

async function pullChart(){
  if(demo){drawChart(null,null);return}
  try{
    const r=await req("/api/chart")
    if(!r.ok) return
    const d=await r.json()
    drawChart(d.ir,d.air)
  }catch(e){}
}

async function post(path,body){
  const r=await req(path,{method:"POST",body:enc(body||{})})
  return r
}

function setConnected(on){
  if(autopoll) clearInterval(autopoll)
  if(chartTimer) clearInterval(chartTimer)
  if(on){
    autopoll=setInterval(pullUI,400)
    chartTimer=setInterval(pullChart,1200)
    pullUI();pullChart()
  }else{
    badge("DISCONNECTED")
    hint("")
  }
}

function setMode(isDemo){
  demo=isDemo
  if(demo){base="";ls("deviceUrl","DEMO");$("#deviceUrl").value="DEMO"}
  setConnected(true)
}

$("#btnConnect").onclick=()=>{
  const v=($("#deviceUrl").value||"").trim()
  if(!v||v.toUpperCase()==="DEMO"){setMode(true);return}
  demo=false;base=v;ls("deviceUrl",v)
  if(location.protocol==="https:"&&/^http:\/\//i.test(base)) hint("HTTPS page → HTTP device is blocked by browsers. Run locally over HTTP.")
  setConnected(true)
}
$("#btnDemo").onclick=()=>setMode(true)

$("#btnLogin").onclick=async()=>{
  if(demo){$("#loginMsg").textContent="Demo mode: no login.";return}
  const pw=$("#pw").value||""
  $("#loginMsg").textContent=""
  try{
    const r=await post("/api/login",{pw})
    $("#loginMsg").textContent=r.ok?"Login OK":"Login failed"
    pullUI();pullChart()
  }catch(e){$("#loginMsg").textContent="Login error"}
}

$("#btnReset").onclick=async()=>{if(demo){demHist=[];return}try{await post("/api/reset",{})}catch(e){}}
$("#btnMock").onclick=async()=>{if(demo){demoStep();return}try{await post("/api/mock",{})}catch(e){}}
$("#btnAirBefore").onclick=async()=>{if(demo)return;try{await post("/api/air/before",{})}catch(e){}}
$("#btnAirAfter").onclick=async()=>{if(demo)return;try{await post("/api/air/after",{})}catch(e){}}
$("#btnUnlock").onclick=async()=>{if(demo)return;try{await post("/api/unlock",{pin:$("#pin").value||""})}catch(e){}}
$("#btnLock").onclick=async()=>{if(demo)return;try{await post("/api/lock",{})}catch(e){}}
$("#btnAuto").onclick=async()=>{if(demo)return;try{await post("/api/lights/mode",{mode:"AUTO"})}catch(e){}}
$("#btnManual").onclick=async()=>{if(demo)return;try{await post("/api/lights/mode",{mode:"MANUAL"})}catch(e){}}
$("#btnArmOn").onclick=async()=>{if(demo)return;try{await post("/api/lights/arm",{on:"1"})}catch(e){}}
$("#btnArmOff").onclick=async()=>{if(demo)return;try{await post("/api/lights/arm",{on:"0"})}catch(e){}}
$("#btnSetLane").onclick=async()=>{if(demo)return;try{await post("/api/lights/set",{lane:$("#laneSel").value,state:$("#stateSel").value})}catch(e){}}
$("#btnPreempt").onclick=async()=>{if(demo)return;const ms=($("#preemptMs").value||"").trim()||"15000";try{await post("/api/preempt",{ms})}catch(e){}}

/* QR */
let qr=null
function qrEnsure(){
  if(qr) return qr
  qr=new QRious({element:$("#qrCanvas"),size:260,level:"H",value:""})
  return qr
}
function qrSetValue(v){
  v=(v||"").trim()
  if(!v){$("#qrMsg").textContent="Enter something to encode.";return}
  qrEnsure().value=v
  $("#qrText").value=v
  $("#qrMsg").textContent="QR ready."
  const a=$("#btnQRSave")
  a.href=$("#qrCanvas").toDataURL("image/png")
}
function wifiEsc(s){return (s||"").replace(/([\\;,:"])/g,"\\$1")}
function wifiQR(ssid,pass,type){
  ssid=wifiEsc(ssid)
  pass=wifiEsc(pass)
  type=type||"WPA"
  if(type==="nopass") return `WIFI:T:nopass;S:${ssid};;`
  return `WIFI:T:${type};S:${ssid};P:${pass};;`
}
$("#btnQRMake").onclick=()=>qrSetValue($("#qrText").value||"")
$("#btnQRDevice").onclick=()=>{
  const v=(($("#deviceUrl").value||"").trim())
  if(!v||v.toUpperCase()==="DEMO"){qrSetValue("DEMO");return}
  qrSetValue(v)
}
$("#btnQRThis").onclick=()=>qrSetValue(location.href)
$("#btnQRWiFi").onclick=()=>{
  const ssid=$("#wifiSsid").value||""
  const pass=$("#wifiPass").value||""
  const type=$("#wifiType").value||"WPA"
  if(!ssid.trim()){$("#qrMsg").textContent="WiFi SSID required.";return}
  qrSetValue(wifiQR(ssid,pass,type))
}

;(function init(){
  const v=ls("deviceUrl")||"DEMO"
  $("#deviceUrl").value=v
  $("#qrText").value=(v&&v.toUpperCase()!=="DEMO")?v:location.href
  qrSetValue($("#qrText").value)
  if(v.toUpperCase()==="DEMO"){setMode(true);return}
  base=v;demo=false;setConnected(true)
})()
