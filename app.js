
const store = {
  get(key){ return JSON.parse(localStorage.getItem(key) || "[]"); },
  set(key,val){ localStorage.setItem(key,JSON.stringify(val)); }
};
let sessions = store.get("rh_sessions");
let equipment = store.get("rh_equipment");
let materials = store.get("rh_materials");
let currentMaterial = null;

const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]));

function showScreen(name){
  document.querySelectorAll(".screen").forEach(s=>s.classList.toggle("active",s.dataset.screen===name));
  document.querySelectorAll("[data-nav]").forEach(b=>b.classList.toggle("active",b.dataset.nav===name));
  scrollTo({top:0,behavior:"smooth"});
}
document.querySelectorAll("[data-nav]").forEach(b=>b.onclick=()=>showScreen(b.dataset.nav));
document.querySelectorAll("[data-open]").forEach(b=>b.onclick=()=>showScreen(b.dataset.open));

function render(){
  $("openSessionsCount").textContent=sessions.length;
  $("equipmentCount").textContent=equipment.length;
  $("materialCount").textContent=materials.length;

  $("activeWork").innerHTML=sessions.length?sessions.slice(0,3).map(x=>`<div class="record"><b>${esc(x.equipment||x.type)}</b><p>${esc(x.symptom)}</p><small>${esc(x.date)}</small></div>`).join(""):"No active troubleshooting sessions yet.";
  $("sessionList").innerHTML=sessions.length?sessions.map(x=>`<div class="record"><b>${esc(x.equipment||x.type)}</b><p>${esc(x.symptom)}</p><small>${esc(x.date)}</small><div class="tag">${esc(x.type)}</div></div>`).join(""):"No saved sessions.";
  $("equipmentList").innerHTML=equipment.length?equipment.map(x=>`<div class="record"><b>${esc(x.name)}</b><p>${esc(x.model||"Model not entered")}</p><small>${esc(x.location||"Location not entered")}</small>${x.notes?`<p>${esc(x.notes)}</p>`:""}</div>`).join(""):"No equipment saved.";
  $("materialList").innerHTML=materials.length?materials.map(x=>`<div class="record"><b>${esc(x.name)}</b><p>${esc(x.job)} · ${esc(x.size)} · ${esc(x.length)} ft</p><small>${esc(x.date)}</small></div>`).join(""):"No saved material lists.";
}

$("saveSessionBtn").onclick=()=>{
  const item={type:$("tsType").value,equipment:$("tsEquipment").value.trim(),symptom:$("tsSymptom").value.trim(),changed:$("tsChanged").value.trim(),measurements:$("tsMeasurements").value.trim(),date:new Date().toLocaleString()};
  if(!item.symptom){alert("Enter a fault code or symptom.");return}
  sessions.unshift(item); store.set("rh_sessions",sessions); render();
};
$("generateStepsBtn").onclick=()=>{
  const type=$("tsType").value, symptom=$("tsSymptom").value.trim()||"the reported issue";
  const steps=[
    "Confirm the exact fault history, operating state and nameplate data.",
    "Apply lockout/tagout before resistance, wiring or mechanical checks.",
    "Verify supply and control voltages under load, not only at idle.",
    "Record current, temperature and any torque/load indication.",
    "Review the most recent mechanical or setup change before changing parameters."
  ];
  if(type.includes("VFD")||type.includes("Servo")) steps.push("Check torque limit, overload model, acceleration/deceleration, brake operation and feedback.");
  $("diagnosticResult").innerHTML=`<b>Suggested next checks for ${esc(symptom)}</b><ol>${steps.map(x=>`<li>${esc(x)}</li>`).join("")}</ol>`;
  $("diagnosticResult").classList.remove("hidden");
};
$("newSessionBtn").onclick=()=>{["tsEquipment","tsSymptom","tsChanged","tsMeasurements"].forEach(id=>$(id).value="");$("diagnosticResult").classList.add("hidden")};

$("saveEquipmentBtn").onclick=()=>{
  const item={name:$("eqName").value.trim(),model:$("eqModel").value.trim(),location:$("eqLocation").value.trim(),notes:$("eqNotes").value.trim()};
  if(!item.name){alert("Enter an equipment name.");return}
  equipment.unshift(item); store.set("rh_equipment",equipment); ["eqName","eqModel","eqLocation","eqNotes"].forEach(id=>$(id).value=""); render();
};

function generateMaterial(){
  const length=Number($("matLength").value||0), sticks=Math.ceil(length/10), supports=Math.max(2,Math.ceil(length/8)+1);
  currentMaterial={name:$("matName").value.trim()||$("matJob").value,job:$("matJob").value,size:$("matSize").value,length,mount:$("matMount").value,date:new Date().toLocaleString()};
  const items=[`${sticks} × 10 ft sticks of ${currentMaterial.size} EMT`,`${Math.max(0,sticks-1)} × couplings`,`2 × connectors`,`${supports} × supports for ${currentMaterial.mount.toLowerCase()}`,"Fasteners, labels, pull string and allowance for bends/waste"];
  $("materialPreview").innerHTML=`<b>${esc(currentMaterial.name)}</b><ul>${items.map(x=>`<li>${esc(x)}</li>`).join("")}</ul><small>Field-check conductor count, environment, bonding and support spacing before ordering.</small>`;
  $("materialPreview").classList.remove("hidden");
}
$("generateMaterialsBtn").onclick=generateMaterial;
$("saveMaterialsBtn").onclick=()=>{ if(!currentMaterial)generateMaterial(); materials.unshift(currentMaterial);store.set("rh_materials",materials);render(); };

$("calcTransformerBtn").onclick=()=>{
  const kva=+$("calcKva").value,v=+$("calcVolts").value,p=+$("calcPhase").value;
  const a=p===3?kva*1000/(Math.sqrt(3)*v):kva*1000/v;
  $("transformerResult").innerHTML=`<b>${a.toFixed(1)} A</b><br><small>Calculated full-load current. Apply the applicable code rules before selecting conductors or overcurrent protection.</small>`;
  $("transformerResult").classList.remove("hidden");
};
$("calcVdBtn").onclick=()=>{
  const drop=+$("vdAmps").value*(2*+$("vdFeet").value/1000)*+$("vdResistance").value;
  $("vdResult").innerHTML=`<b>${drop.toFixed(2)} V estimated drop</b><br><small>Basic single-phase loop estimate; reactance, temperature and actual conductor data are not included.</small>`;
  $("vdResult").classList.remove("hidden");
};
$("searchCodeBtn").onclick=()=>{
  const q=$("codeQuery").value.trim(); if(!q){alert("Enter a search question.");return}
  const refs=["Section 4 — Conductors","Section 10 — Grounding and bonding","Section 12 — Wiring methods","Section 26 — Installation of electrical equipment","Section 28 — Motors and generators"];
  $("codeResult").innerHTML=`<b>Search plan for “${esc(q)}”</b><ul>${refs.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>`;
  $("codeResult").classList.remove("hidden");
};

if("serviceWorker" in navigator) window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js"));
render();
