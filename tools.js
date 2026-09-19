const root = document.querySelector('#freeTools');
root.innerHTML = `
<div class="tool-nav" aria-label="Herramientas"><button data-tool="macros" class="btn">Calculadora de macros</button><button data-tool="timer" class="btn alt">Temporizador de posing</button></div>
<p id="accessStatus" role="status">Comprobando tu acceso…</p>
<div class="tool-panel" id="panel-macros"><h3>CALCULA TU PUNTO DE PARTIDA.</h3><p>Compara tres ecuaciones de gasto en reposo y aplica un factor total de actividad para estimar tus calorías diarias.</p>
<form id="macroForm" class="tool-form">
<label class="tool-wide">Ecuación principal<select name="formula"><option value="mifflin">Mifflin–St Jeor</option><option value="tinsley">Tinsley para atletas de físico</option><option value="harris">Harris–Benedict revisada</option></select></label>
<label>Edad (años)<input name="age" type="number" min="18" max="80" required></label>
<label>Peso (kg)<input name="weight" type="number" min="40" max="200" step="0.1" required></label>
<label>Estatura (cm)<input name="height" type="number" min="140" max="220" required></label>
<label>Sexo usado por Mifflin y Harris<select name="sex"><option value="male">Masculino</option><option value="female">Femenino</option></select></label>
<label class="tool-wide">Grasa corporal estimada — opcional para Tinsley (%)<input name="bodyFat" type="number" min="3" max="60" step="0.1" placeholder="Ej. 15"><small>Si la dejas vacía, Tinsley usa su ecuación basada en peso corporal.</small></label>
<label class="tool-wide">Contexto de actividad cotidiana<select name="activityPreset" id="activityPreset">
<option value="1.20">Sedentario · escritorio y casi sin ejercicio — 1.20</option>
<option value="1.375">Oficinista con caminatas o entrenamiento ligero — 1.375</option>
<option value="1.55">Oficinista activo o entrenamiento moderado 3–5 días — 1.55</option>
<option value="1.725">Trabajo activo o entrenamiento intenso 5–6 días — 1.725</option>
<option value="1.90">Trabajo físico o entrenamiento duro diario — 1.90</option>
<option value="2.20">Atleta con alto volumen de entrenamiento — 2.20</option>
<option value="2.40">Carga diaria excepcionalmente alta — 2.40</option>
<option value="2.60">Factor extremo personalizado — 2.60</option>
<option value="custom">Introducir mi propio factor</option>
</select></label>
<label>Factor total de actividad<input id="activityFactor" name="activity" type="number" min="1.20" max="2.60" step="0.025" value="1.20" inputmode="decimal" required></label>
<label>Intensidad de entrenamiento<select name="trainingIntensity"><option value="Sin entrenamiento estructurado">Sin entrenamiento estructurado</option><option value="Ligera · RPE 3–4">Ligera · RPE 3–4</option><option value="Moderada · RPE 5–6">Moderada · RPE 5–6</option><option value="Alta · RPE 7–8">Alta · RPE 7–8</option><option value="Muy alta · RPE 9–10">Muy alta · RPE 9–10</option><option value="Doble sesión o alto volumen">Doble sesión o alto volumen</option></select></label>
<div class="tool-wide factor-box"><span>FACTOR APLICADO</span><output id="factorPreview">1.20</output><p id="factorGuidance">El factor representa toda tu actividad diaria. La intensidad se muestra como contexto y no se vuelve a multiplicar.</p></div>
<label>Objetivo<select name="goal"><option value="1">Mantener peso</option><option value="0.9">Pérdida gradual · −10%</option><option value="1.05">Ganancia gradual · +5%</option></select></label>
<label class="tool-wide"><input type="checkbox" required> Soy adulto y no usaré esta estimación durante embarazo, lactancia, tratamiento de un trastorno alimentario o una condición que requiera dieta supervisada.</label>
<button class="btn tool-wide">Comparar y calcular</button>
</form>
<div class="estimate-banner"><strong>SIEMPRE ES UNA ESTIMACIÓN.</strong><span>El resultado aproxima calorías por día; no mide tu metabolismo ni sustituye calorimetría indirecta o valoración profesional.</span></div>
<div id="macroResult" class="tool-result" role="status" hidden></div>
<details><summary>Fórmulas, factor y referencias</summary><p><b>Mifflin–St Jeor:</b> usa peso, estatura, edad y sexo. <b>Harris–Benedict revisada:</b> versión Roza–Shizgal de 1984. <b>Tinsley:</b> usa 24.8 × peso + 10; si proporcionas grasa corporal, usa 25.9 × masa libre de grasa + 284. Tinsley se desarrolló con atletas de físico musculados y no debe generalizarse sin cautela.</p><p>El factor total multiplica el gasto en reposo para aproximar el gasto diario. Los valores altos, especialmente 2.40–2.60, representan cargas excepcionales y deben validarse con seguimiento real.</p><p><a href="https://pubmed.ncbi.nlm.nih.gov/2305711/" target="_blank" rel="noopener">Mifflin–St Jeor ↗</a> · <a href="https://pubmed.ncbi.nlm.nih.gov/30240568/" target="_blank" rel="noopener">Tinsley ↗</a> · <a href="https://pubmed.ncbi.nlm.nih.gov/6741850/" target="_blank" rel="noopener">Harris–Benedict revisada ↗</a></p></details></div>
<div class="tool-panel" id="panel-timer" hidden><h3>PRACTICA CON INTENCIÓN.</h3><p>Configura tus intervalos de práctica y descanso. Elige tiempos cómodos y mantén una respiración normal.</p><form id="timerForm" class="tool-form"><label>Práctica (segundos)<input name="work" type="number" min="5" max="300" value="30" required></label><label>Descanso (segundos)<input name="rest" type="number" min="5" max="300" value="30" required></label><label>Rondas<input name="rounds" type="number" min="1" max="30" value="5" required></label><button class="btn">Comenzar práctica</button></form><div class="timer-face"><span id="timerPhase">LISTO PARA COMENZAR</span><output id="timerClock" aria-label="Tiempo restante">00:30</output><span id="timerRound">Personaliza tus intervalos</span></div><div class="tool-nav"><button id="pauseTimer" class="btn alt" disabled>Pausar</button><button id="resetTimer" class="btn alt" disabled>Reiniciar</button></div><p id="timerNotice" role="status"></p></div>
<dialog id="accessDialog" aria-labelledby="accessTitle"><button type="button" id="closeAccess" class="restart" aria-label="Cerrar registro">×</button><h3 id="accessTitle">UN REGISTRO.<br>DOS HERRAMIENTAS.</h3><p>Registro temporalmente desactivado durante la revisión de resultados.</p><form id="accessForm" class="tool-form"><label class="tool-wide" id="nameLabel">Nombre<input name="name" autocomplete="name" minlength="2" maxlength="100" required></label><label class="tool-wide">Correo<input name="email" type="email" autocomplete="email" maxlength="254" required></label><label class="tool-wide">Teléfono con código de país<input name="phone" type="tel" autocomplete="tel" placeholder="+52 228 123 4567" maxlength="24" required></label><label class="tool-wide" id="consentLabel"><input name="consent" type="checkbox" required> Autorizo guardar estos datos para habilitar y recuperar mi acceso.</label><p class="tool-wide">Los datos se guardan en la base privada de Aburto Pro Coach. Enviaremos una copia operativa a Raíz Noble y una confirmación al correo que registres. Ninguno de los correos incluye edad, peso, estatura ni resultados de macros; tampoco autoriza publicidad. Puedes solicitar eliminación por <a href="https://www.instagram.com/andrsaburto/" target="_blank" rel="noopener">Instagram @andrsaburto</a>.</p><button class="btn tool-wide" id="saveAccess">Registrarme y continuar</button><button type="button" class="text-link tool-wide" id="returningAccess">Ya me registré</button><p id="accessError" class="tool-wide" role="alert"></p></form></dialog>`;

let registered = false, ready = false, pending = null, returning = false;
const status = document.querySelector('#accessStatus'), dialog = document.querySelector('#accessDialog');
async function checkAccess() {
  registered = true;
  ready = true;
  status.textContent = 'Acceso de prueba abierto · Calcula y usa las herramientas sin registro.';
}
await checkAccess();
function gate(action) {
  return action();
}
document.querySelector('#closeAccess').onclick = () => { dialog.close(); pending = null; };
dialog.addEventListener('cancel', () => { pending = null; });
document.querySelector('#returningAccess').onclick = () => {
  returning = !returning;
  document.querySelector('#nameLabel').hidden = returning;
  document.querySelector('#consentLabel').hidden = returning;
  document.querySelector('[name="name"]').required = !returning;
  document.querySelector('[name="consent"]').required = !returning;
  document.querySelector('#saveAccess').textContent = returning ? 'Recuperar acceso' : 'Registrarme y continuar';
  document.querySelector('#returningAccess').textContent = returning ? 'Crear mi registro' : 'Ya me registré';
};
document.querySelector('#accessForm').onsubmit = async e => {
  e.preventDefault(); const submit = document.querySelector('#saveAccess'); submit.disabled = true;
  try {
    const f = new FormData(e.currentTarget);
    const r = await fetch('/api/access', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: f.get('name'), email: f.get('email'), phone: f.get('phone'), consent: f.get('consent') === 'on', returning }) });
    const data = await r.json(); if (!r.ok || !data.registered) throw new Error(data.error || 'No se pudo confirmar el registro.');
    registered = true; status.textContent = returning ? 'Acceso recuperado · Tus dos herramientas están desbloqueadas.' : data.emailCopySent ? 'Acceso activo · Enviamos una confirmación a tu correo.' : 'Acceso activo · Tus herramientas están desbloqueadas; no pudimos confirmar el correo.'; dialog.close(); e.target.reset(); const action = pending; pending = null; action?.();
  } catch (err) { document.querySelector('#accessError').textContent = err.message; }
  finally { submit.disabled = !ready; }
};
root.querySelectorAll('[data-tool]').forEach(button => button.onclick = () => {
  root.querySelectorAll('.tool-panel').forEach(panel => { panel.hidden = panel.id !== `panel-${button.dataset.tool}`; });
  root.querySelectorAll('[data-tool]').forEach(b => b.classList.toggle('alt', b !== button));
});
function cta(out,interest) { const button=document.createElement('button'); button.className='btn'; button.textContent='Quiero ayuda de Andrés ↗'; button.onclick=()=>{ if(typeof window.startWithInterest==='function') window.startWithInterest(interest); else location.hash='asistente'; }; out.append(button); }
const activityPreset=document.querySelector('#activityPreset'),activityFactor=document.querySelector('#activityFactor'),factorPreview=document.querySelector('#factorPreview'),factorGuidance=document.querySelector('#factorGuidance');
function updateFactorPreview(){
  const factor=Number(activityFactor.value);
  factorPreview.textContent=Number.isFinite(factor)?factor.toFixed(3).replace(/0+$/,'').replace(/\.$/,''):'—';
  factorGuidance.textContent=factor>=2.4?'Factor excepcional: úsalo sólo si refleja una carga diaria real y validada con seguimiento.':'El factor representa toda tu actividad diaria. La intensidad se muestra como contexto y no se vuelve a multiplicar.';
}
activityPreset.onchange=()=>{
  if(activityPreset.value!=='custom')activityFactor.value=activityPreset.value;
  updateFactorPreview();
};
activityFactor.oninput=()=>{
  activityPreset.value='custom';
  updateFactorPreview();
};
updateFactorPreview();

function restingEstimates({weight,height,age,sex,bodyFat}){
  const mifflin=10*weight+6.25*height-5*age+(sex==='male'?5:-161);
  const harris=sex==='male'
    ?88.362+13.397*weight+4.799*height-5.677*age
    :447.593+9.247*weight+3.098*height-4.330*age;
  const hasBodyFat=Number.isFinite(bodyFat)&&bodyFat>=3&&bodyFat<=60;
  const fatFreeMass=hasBodyFat?weight*(1-bodyFat/100):null;
  const tinsley=hasBodyFat?25.9*fatFreeMass+284:24.8*weight+10;
  return {
    mifflin:{name:'Mifflin–St Jeor',resting:mifflin,detail:'Peso + estatura + edad + sexo'},
    tinsley:{name:hasBodyFat?'Tinsley · masa libre de grasa':'Tinsley · peso corporal',resting:tinsley,detail:hasBodyFat?`MLG estimada: ${fatFreeMass.toFixed(1)} kg`:'Variante basada en peso'},
    harris:{name:'Harris–Benedict revisada',resting:harris,detail:'Roza–Shizgal, 1984'}
  };
}

document.querySelector('#macroForm').onsubmit=e=>{
  e.preventDefault();
  const f=new FormData(e.currentTarget),weight=Number(f.get('weight')),height=Number(f.get('height')),age=Number(f.get('age')),bodyFatRaw=String(f.get('bodyFat')||'').trim();
  const factor=Number(f.get('activity')),goal=Number(f.get('goal')),formula=String(f.get('formula')),intensity=String(f.get('trainingIntensity'));
  const estimates=restingEstimates({weight,height,age,sex:String(f.get('sex')),bodyFat:bodyFatRaw===''?NaN:Number(bodyFatRaw)});
  const selected=estimates[formula]||estimates.mifflin;
  const resting=Math.round(selected.resting),maintenance=Math.round(selected.resting*factor/10)*10,target=Math.round(maintenance*goal/10)*10;
  const protein=Math.round(weight*1.6),fat=Math.round(target*.3/9),carbs=Math.round((target-protein*4-fat*9)/4);

  gate(()=>{
    const out=document.querySelector('#macroResult');
    out.hidden=false;
    out.replaceChildren();

    const eyebrow=document.createElement('div');eyebrow.className='result-eyebrow';eyebrow.textContent='ESTIMACIÓN DIARIA · NO ES UNA MEDICIÓN';
    const heading=document.createElement('h3');heading.textContent=`≈ ${target.toLocaleString('es-MX')} KCAL / DÍA`;
    const summary=document.createElement('p');summary.textContent=`${selected.name} · Reposo: ${resting.toLocaleString('es-MX')} kcal · Mantenimiento: ${maintenance.toLocaleString('es-MX')} kcal · Factor: ${factor.toFixed(3).replace(/0+$/,'').replace(/\.$/,'')}`;
    const training=document.createElement('p');training.textContent=`Entrenamiento declarado: ${intensity}. La intensidad no se multiplicó nuevamente para evitar contar dos veces la misma actividad.`;
    out.append(eyebrow,heading,summary,training);

    const comparison=document.createElement('div');comparison.className='formula-comparison';
    Object.values(estimates).forEach(item=>{
      const daily=Math.round(item.resting*factor/10)*10;
      const card=document.createElement('article');card.className=item===selected?'formula-card selected':'formula-card';
      const name=document.createElement('span');name.textContent=item.name;
      const rest=document.createElement('strong');rest.textContent=`${Math.round(item.resting).toLocaleString('es-MX')} kcal reposo`;
      const total=document.createElement('small');total.textContent=`≈ ${daily.toLocaleString('es-MX')} kcal/día con factor ${factor.toFixed(2)}`;
      const detail=document.createElement('small');detail.textContent=item.detail;
      card.append(name,rest,total,detail);comparison.append(card);
    });
    out.append(comparison);

    if(carbs<0||target<resting){
      const caution=document.createElement('p');caution.className='estimate-caution';caution.textContent='Esta combinación produce un objetivo incompatible con el gasto estimado en reposo o macros negativos. Requiere valoración individual; no uses estas cifras como plan.';
      out.append(caution);cta(out,'Nutrición deportiva');return;
    }

    const macros=document.createElement('p');macros.className='macro-line';macros.textContent=`Referencia de macros: proteína ${protein} g · carbohidratos ${carbs} g · grasas ${fat} g`;
    const note=document.createElement('p');note.className='estimate-caution';note.textContent='Son calorías calculadas por día, no calorías medidas. Úsalas como punto de partida y compáralas con 2–3 semanas de evolución, apetito, rendimiento y cambios corporales junto con un profesional.';
    out.append(macros,note);cta(out,'Nutrición deportiva');
  });
};
let timer=null, segments=[], index=0, deadline=0, remaining=0, paused=false;
const clock=document.querySelector('#timerClock'), phase=document.querySelector('#timerPhase'), round=document.querySelector('#timerRound'), pause=document.querySelector('#pauseTimer'), reset=document.querySelector('#resetTimer');
function draw() { const sec=Math.max(0,Math.ceil(remaining/1000)); clock.textContent=`${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`; }
function tick() { remaining=deadline-Date.now(); while(remaining<=0 && index<segments.length-1) { index++; deadline+=segments[index].seconds*1000; remaining=deadline-Date.now(); }
  if(remaining<=0) { clearInterval(timer); timer=null; remaining=0; phase.textContent='PRÁCTICA COMPLETADA'; round.textContent='Buen trabajo. Revisa tu técnica y tus sensaciones.'; pause.disabled=true; document.querySelector('#timerForm button').disabled=false; }
  else { phase.textContent=segments[index].label; round.textContent=`Ronda ${segments[index].round} de ${segments.at(-1).round}`; } draw(); }
document.querySelector('#timerForm').onsubmit=e=>{ e.preventDefault(); const f=new FormData(e.currentTarget), work=+f.get('work'), rest=+f.get('rest'), rounds=+f.get('rounds'); gate(()=>{
  clearInterval(timer); segments=[]; for(let r=1;r<=rounds;r++){ segments.push({label:'PRÁCTICA',round:r,seconds:work}); if(r<rounds) segments.push({label:'DESCANSO',round:r,seconds:rest}); }
  index=0; paused=false; pause.textContent='Pausar'; pause.disabled=false; reset.disabled=false; document.querySelector('#timerForm button').disabled=true; remaining=work*1000; deadline=Date.now()+remaining; tick(); timer=setInterval(tick,200);
}); };
pause.onclick=()=>{ if(!paused){ remaining=Math.max(0,deadline-Date.now()); clearInterval(timer); timer=null; paused=true; pause.textContent='Continuar'; }else{ deadline=Date.now()+remaining; paused=false; pause.textContent='Pausar'; timer=setInterval(tick,200); tick(); } };
reset.onclick=()=>{ clearInterval(timer); timer=null; paused=false; remaining=Number(document.querySelector('[name="work"]').value)*1000; draw(); phase.textContent='LISTO PARA COMENZAR'; round.textContent='Personaliza tus intervalos'; pause.disabled=true; pause.textContent='Pausar'; reset.disabled=true; document.querySelector('#timerForm button').disabled=false; };
document.addEventListener('visibilitychange',()=>{ if(document.hidden && timer && !paused){ pause.click(); document.querySelector('#timerNotice').textContent='Práctica pausada al salir de la página. Pulsa Continuar cuando estés listo.'; } });
