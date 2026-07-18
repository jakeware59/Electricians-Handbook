
const store={get:k=>JSON.parse(localStorage.getItem(k)||"[]"),set:(k,v)=>localStorage.setItem(k,JSON.stringify(v))};
let sessions=store.get("rh_sessions"),equipment=store.get("rh_equipment"),materials=store.get("rh_materials"),currentMaterial=null;
const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]));
const text=id=>($(id).value||"").trim();
function showScreen(name){document.querySelectorAll(".screen").forEach(s=>s.classList.toggle("active",s.dataset.screen===name));document.querySelectorAll("[data-nav]").forEach(b=>b.classList.toggle("active",b.dataset.nav===name));scrollTo({top:0,behavior:"smooth"})}
document.querySelectorAll("[data-nav]").forEach(b=>b.onclick=()=>showScreen(b.dataset.nav));
document.querySelectorAll("[data-open]").forEach(b=>b.onclick=()=>showScreen(b.dataset.open));

function migrateSessions(){sessions=sessions.map(s=>({...s,faultCode:s.faultCode||"",symptoms:s.symptoms||s.symptom||"",observations:s.observations||"",actions:s.actions||""}));store.set("rh_sessions",sessions)}
migrateSessions();

function render(){
 $("openSessionsCount").textContent=sessions.length;$("equipmentCount").textContent=equipment.length;$("materialCount").textContent=materials.length;
 $("activeWork").innerHTML=sessions.length?sessions.slice(0,3).map(x=>`<div class="record"><b>${esc(x.equipment||x.type)}</b><p>${esc(x.faultCode?x.faultCode+" — ":"")}${esc(x.symptoms)}</p><small>${esc(x.date)}</small></div>`).join(""):"No active troubleshooting sessions yet.";
 $("sessionList").innerHTML=sessions.length?sessions.map(x=>`<div class="record"><b>${esc(x.equipment||x.type)}</b><p>${esc(x.faultCode?x.faultCode+" — ":"")}${esc(x.symptoms)}</p><small>${esc(x.date)}</small><div class="tag">${esc(x.type)}</div></div>`).join(""):"No saved sessions.";
 $("equipmentList").innerHTML=equipment.length?equipment.map(x=>`<div class="record"><b>${esc(x.name)}</b><p>${esc(x.model||"Model not entered")}</p><small>${esc(x.location||"Location not entered")}</small>${x.notes?`<p>${esc(x.notes)}</p>`:""}</div>`).join(""):"No equipment saved.";
 $("materialList").innerHTML=materials.length?materials.map(x=>`<div class="record"><b>${esc(x.name)}</b><p>${esc(x.job)} · ${esc(x.size)} · ${esc(x.length)} ft</p><small>${esc(x.date)}</small></div>`).join(""):"No saved material lists.";
}

function normalizedInput(){
 return {
  type:$("tsType").value,equipment:text("tsEquipment"),faultCode:text("tsFaultCode"),
  symptoms:text("tsSymptoms"),changed:text("tsChanged"),measurements:text("tsMeasurements"),
  observations:text("tsObservations"),actions:text("tsActions")
 }
}
function includesAny(hay,arr){hay=hay.toLowerCase();return arr.some(x=>hay.includes(x))}
function analyze(data){
 const all=[data.faultCode,data.symptoms,data.changed,data.measurements,data.observations,data.actions].join(" ").toLowerCase();
 const findings=[];
 const add=(title,why,checks,confidence)=>findings.push({title,why,checks,confidence});

 if(data.type.includes("VFD")||data.type.includes("Servo")){
   if(includesAny(all,["overload","ale 06","ol fault","over current","overcurrent"])){
     if(includesAny(all,["low current","15%","20%","unloaded","no load","mechanical change","forming head","setup changed","alignment"])){
       add("Mechanical drag, misalignment or brake release issue","The overload is occurring despite low average current or after a mechanical setup change.",["Inspect the driven load for binding","Verify brake fully releases","Check couplings, bearings and alignment","Review peak torque/current in fault history, not only live current"],"High");
     }
     add("Short-duration torque spike","Average current can look normal while brief peaks trigger the overload model.",["Monitor peak current or torque","Identify whether the trip occurs during acceleration, deceleration or steady speed","Inspect for product jams or cyclic binding"],"Medium");
     add("Incorrect motor/overload parameters","A wrong motor FLA, thermal model or torque limit can create nuisance trips.",["Compare motor nameplate data to drive parameters","Check overload class and torque limit","Verify acceleration/deceleration times"],"Medium");
   }
   if(includesAny(all,["won't reach speed","not full speed","drops to base","setpoint","potentiometer","analog"])){
     add("Analog reference or control wiring fault","The speed command may be collapsing because of a bad wiper, loose terminal or unstable reference.",["Measure reference voltage and wiper voltage at the drive","Check terminal tightness and cable resistance while flexing","Confirm analog-input scaling and minimum/maximum frequency"],"High");
   }
   if(includesAny(all,["overvoltage","high voltage","260","263","dc bus"])){
     add("Supply or regenerative overvoltage","High incoming voltage or deceleration energy can raise the DC bus.",["Measure input voltage under load","Check transformer taps","Increase deceleration time","Verify braking resistor/chopper operation if fitted"],"High");
   }
 }

 if(data.type==="Motor"){
   if(includesAny(all,["hot","overheat","overheating","burning smell"])){
     add("Overload, cooling or voltage imbalance","Motor heating commonly points to excess load, blocked cooling or phase imbalance.",["Compare phase currents","Check voltage imbalance","Inspect fan and airflow","Verify mechanical load and bearings"],"High");
   }
   if(includesAny(all,["hums","won't start","not start","trips instantly"])){
     add("Missing phase, seized load or starting-circuit fault","A motor that hums without accelerating is often electrically single-phased or mechanically locked.",["Check all three phase voltages at the motor","Verify contactor poles and fuses","Attempt safe uncoupled rotation under lockout","Check starting components if single-phase"],"High");
   }
 }

 if(data.type==="Control Circuit"){
   if(includesAny(all,["intermittent","drops out","flicker","loose","vibration"])){
     add("Loose connection or unstable control supply","Intermittent behavior that changes with movement strongly suggests a connection or wiring fault.",["Measure control voltage during the failure","Perform a careful wiggle test where safe","Inspect terminal tension and conductor damage","Check relay and contactor coils"],"High");
   }
 }

 if(data.type==="PLC Input / Output"){
   if(includesAny(all,["reversed","opposite","backwards","high level","float"])){
     add("Incorrect contact selection or logic inversion","The field contact may be correct electrically but interpreted opposite in the PLC/SCADA logic.",["Identify common, NO and NC leads","Verify input state with the device actuated","Check PLC logic inversion and alarm fail-safe philosophy"],"High");
   }
 }

 if(data.type==="Transformer"){
   if(includesAny(all,["high voltage","260","263","overvoltage"])){
     add("Primary voltage or tap mismatch","A high secondary usually follows high primary voltage or an incorrect tap connection.",["Measure primary and secondary at the same load condition","Check available tap positions","Confirm nameplate ratio and frequency","Verify the load is connected to the intended secondary terminals"],"High");
   }
 }

 if(data.type==="Sensor / Switch"){
   if(includesAny(all,["intermittent","false alarm","chatter","reversed","backwards"])){
     add("Contact selection, wiring or mechanical actuation issue","Switch faults are often caused by using the wrong contact, poor adjustment or unstable wiring.",["Identify NO/NC/common","Check continuity through full travel","Inspect mounting and actuation","Verify PLC interpretation"],"High");
   }
 }

 if(!findings.length){
   add("Insufficient pattern match","The local rules did not find a strong equipment-specific match yet.",["Confirm when the fault occurs","Record supply and control voltages under load","Separate electrical from mechanical causes","Note what changed immediately before the issue started"],"Low");
 }

 findings.sort((a,b)=>({High:3,Medium:2,Low:1}[b.confidence]-({High:3,Medium:2,Low:1}[a.confidence])));
 return findings.slice(0,4);
}

$("analyzeBtn").onclick=()=>{
 const data=normalizedInput();
 if(!data.symptoms&&!data.faultCode){alert("Enter a fault code or symptoms.");return}
 const findings=analyze(data);
 $("diagnosticResult").innerHTML=`<b>Ratchet's offline analysis</b><p>Likely causes are ranked from strongest to weakest based on the information entered.</p>${findings.map((f,i)=>`<div class="rank"><strong>${i+1}. ${esc(f.title)}</strong><div class="confidence">${esc(f.confidence)} confidence</div><p>${esc(f.why)}</p><ul>${f.checks.map(c=>`<li>${esc(c)}</li>`).join("")}</ul></div>`).join("")}<div class="notice">This is troubleshooting guidance, not a substitute for safe isolation, manufacturer documentation or qualified judgment.</div>`;
 $("diagnosticResult").classList.remove("hidden");
};

$("saveSessionBtn").onclick=()=>{
 const item={...normalizedInput(),date:new Date().toLocaleString()};
 if(!item.symptoms&&!item.faultCode){alert("Enter a fault code or symptoms.");return}
 sessions.unshift(item);store.set("rh_sessions",sessions);render();
};
$("newSessionBtn").onclick=()=>{["tsEquipment","tsFaultCode","tsSymptoms","tsChanged","tsMeasurements","tsObservations","tsActions"].forEach(id=>$(id).value="");$("diagnosticResult").classList.add("hidden")};

$("saveEquipmentBtn").onclick=()=>{const item={name:text("eqName"),model:text("eqModel"),location:text("eqLocation"),notes:text("eqNotes")};if(!item.name){alert("Enter an equipment name.");return}equipment.unshift(item);store.set("rh_equipment",equipment);["eqName","eqModel","eqLocation","eqNotes"].forEach(id=>$(id).value="");render()};

function generateMaterial(){const length=Number($("matLength").value||0),sticks=Math.ceil(length/10),supports=Math.max(2,Math.ceil(length/8)+1);currentMaterial={name:text("matName")||$("matJob").value,job:$("matJob").value,size:$("matSize").value,length,mount:$("matMount").value,date:new Date().toLocaleString()};const items=[`${sticks} × 10 ft sticks of ${currentMaterial.size} EMT`,`${Math.max(0,sticks-1)} × couplings`,`2 × connectors`,`${supports} × supports for ${currentMaterial.mount.toLowerCase()}`,"Fasteners, labels, pull string and allowance for bends/waste"];$("materialPreview").innerHTML=`<b>${esc(currentMaterial.name)}</b><ul>${items.map(x=>`<li>${esc(x)}</li>`).join("")}</ul><small>Field-check conductor count, environment, bonding and support spacing before ordering.</small>`;$("materialPreview").classList.remove("hidden")}
$("generateMaterialsBtn").onclick=generateMaterial;$("saveMaterialsBtn").onclick=()=>{if(!currentMaterial)generateMaterial();materials.unshift(currentMaterial);store.set("rh_materials",materials);render()};

$("calcTransformerBtn").onclick=()=>{const kva=+$("calcKva").value,v=+$("calcVolts").value,p=+$("calcPhase").value,a=p===3?kva*1000/(Math.sqrt(3)*v):kva*1000/v;$("transformerResult").innerHTML=`<b>${a.toFixed(1)} A</b><br><small>Calculated full-load current. Apply the applicable code rules before selecting conductors or overcurrent protection.</small>`;$("transformerResult").classList.remove("hidden")};
$("calcVdBtn").onclick=()=>{const drop=+$("vdAmps").value*(2*+$("vdFeet").value/1000)*+$("vdResistance").value;$("vdResult").innerHTML=`<b>${drop.toFixed(2)} V estimated drop</b><br><small>Basic single-phase loop estimate; reactance, temperature and actual conductor data are not included.</small>`;$("vdResult").classList.remove("hidden")};
$("searchCodeBtn").onclick=()=>{const q=text("codeQuery");if(!q){alert("Enter a search question.");return}const refs=["Section 4 — Conductors","Section 10 — Grounding and bonding","Section 12 — Wiring methods","Section 26 — Installation of electrical equipment","Section 28 — Motors and generators"];$("codeResult").innerHTML=`<b>Search plan for “${esc(q)}”</b><ul>${refs.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>`;$("codeResult").classList.remove("hidden")};

if("serviceWorker" in navigator){window.addEventListener("load",async()=>{try{const regs=await navigator.serviceWorker.getRegistrations();for(const r of regs)await r.unregister();await navigator.serviceWorker.register("./sw.js?v=2")}catch(e){console.warn(e)}})}
render();
