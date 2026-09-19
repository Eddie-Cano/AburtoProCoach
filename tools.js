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
<div class="tool-panel" id="panel-timer" hidden>
  <div class="pose-intro"><div><span class="result-eyebrow">ABURTO POSING LAB</span><h3>ENTRENA LA POSE,<br>NO SÓLO EL TIEMPO.</h3></div><p>Elige categoría y rutina. La silueta, las claves técnicas y la transición cambian automáticamente durante la práctica.</p></div>
  <section class="pose-lead-card" id="poseLeadCard" aria-labelledby="poseLeadTitle">
    <div><span class="result-eyebrow">ACCESO GRATUITO</span><h4 id="poseLeadTitle">Activa tu rutina</h4><p>Nombre y al menos un medio de contacto. Si agregas correo, recibirás una copia de confirmación.</p></div>
    <form id="poseLeadForm" class="pose-lead-form">
      <label>Nombre<input name="name" autocomplete="name" minlength="2" maxlength="100" required></label>
      <label>Correo — opcional<input name="email" type="email" autocomplete="email" maxlength="254" placeholder="tu@correo.com"></label>
      <label>WhatsApp — opcional<input name="phone" type="tel" autocomplete="tel" maxlength="24" placeholder="+52 228 123 4567"></label>
      <label class="pose-consent"><input name="consent" type="checkbox" required> Autorizo el uso de estos datos para habilitar la herramienta y dar seguimiento a mi solicitud.</label>
      <button class="btn" id="poseLeadSubmit">Entrar al Posing Lab</button>
      <p id="poseLeadError" role="alert"></p>
    </form>
  </section>
  <div id="poseWorkspace" hidden>
    <form id="timerForm" class="pose-settings">
      <label>Categoría<select name="category" id="poseCategory"><option value="classic">Classic Physique · 7 poses</option><option value="bodybuilding">Bodybuilding · 8 poses</option><option value="foundation">Presentación base · 4 posiciones</option></select></label>
      <label>Rutina<select name="routine" id="poseRoutine"><option value="express">Express · 1 vuelta</option><option value="technique" selected>Técnica · 2 vueltas</option><option value="stage">Tarima · 3 vueltas</option></select></label>
      <div class="pose-plan" id="posePlan" aria-live="polite"></div>
      <button class="btn" id="startPoseTimer">Comenzar rutina</button>
    </form>
    <div class="pose-player">
      <div class="pose-visual-wrap"><div id="poseVisual" class="pose-visual" role="img" aria-label="Silueta de la pose actual"></div><span id="poseCounter">POSE 1 / 7</span></div>
      <div class="pose-coaching">
        <span class="result-eyebrow" id="timerPhase">LISTO PARA COMENZAR</span>
        <h4 id="poseName">Doble bíceps de frente</h4>
        <output id="timerClock" aria-label="Tiempo restante">00:25</output>
        <p id="timerRound">Rutina Técnica · 2 vueltas</p>
        <ul id="poseCues"></ul>
        <div class="pose-controls"><button type="button" id="pauseTimer" class="btn alt" disabled>Pausar</button><button type="button" id="skipPose" class="btn alt" disabled>Siguiente</button><button type="button" id="resetTimer" class="btn alt" disabled>Reiniciar</button></div>
        <p id="timerNotice" role="status"></p>
      </div>
    </div>
    <div class="pose-disclaimer"><strong>Guía de práctica, no criterio universal.</strong><span>Las poses y llamados cambian entre federaciones, categorías y eventos. Andrés puede ajustar la ejecución a tu estructura, reglamento y nivel. Detén la práctica si sientes dolor o mareo.</span></div>
    <details><summary>Base de la rutina y reglamentos</summary><p>Classic Physique sigue las siete poses obligatorias IFBB; Bodybuilding reúne las siete obligatorias IFBB y añade “most muscular” como práctica común en NPC; Presentación base trabaja frente, lateral y espalda con las referencias de Aburto Team.</p><p><a href="https://ifbb.com/wp-content/uploads/2024/02/Mens-Classic-Physique-2024.pdf" target="_blank" rel="noopener">Reglamento IFBB Classic Physique ↗</a> · <a href="https://ifbb.com/wp-content/uploads/2025/07/Mens-Bodybuilding-Rules-2026-1.pdf" target="_blank" rel="noopener">Reglamento IFBB Bodybuilding ↗</a></p></details>
  </div>
</div>
<dialog id="accessDialog" aria-labelledby="accessTitle"><button type="button" id="closeAccess" class="restart" aria-label="Cerrar registro">×</button><h3 id="accessTitle">UN REGISTRO.<br>DOS HERRAMIENTAS.</h3><p>Registro temporalmente desactivado durante la revisión de resultados.</p><form id="accessForm" class="tool-form"><label class="tool-wide" id="nameLabel">Nombre<input name="name" autocomplete="name" minlength="2" maxlength="100" required></label><label class="tool-wide">Correo<input name="email" type="email" autocomplete="email" maxlength="254" required></label><label class="tool-wide">Teléfono con código de país<input name="phone" type="tel" autocomplete="tel" placeholder="+52 228 123 4567" maxlength="24" required></label><label class="tool-wide" id="consentLabel"><input name="consent" type="checkbox" required> Autorizo guardar estos datos para habilitar y recuperar mi acceso.</label><p class="tool-wide">Los datos se guardan en la base privada de Aburto Pro Coach. Enviaremos una copia operativa a Raíz Noble y una confirmación al correo que registres. Ninguno de los correos incluye edad, peso, estatura ni resultados de macros; tampoco autoriza publicidad. Puedes solicitar eliminación por <a href="https://www.instagram.com/andrsaburto/" target="_blank" rel="noopener">Instagram @andrsaburto</a>.</p><button class="btn tool-wide" id="saveAccess">Registrarme y continuar</button><button type="button" class="text-link tool-wide" id="returningAccess">Ya me registré</button><p id="accessError" class="tool-wide" role="alert"></p></form></dialog>`;

let registered = false, ready = false, pending = null, returning = false;
const status = document.querySelector('#accessStatus'), dialog = document.querySelector('#accessDialog');
async function checkAccess() {
  registered = true;
  ready = true;
  status.textContent = 'Calculadora abierta · El Posing Lab solicita nombre y al menos un contacto.';
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
const poseLibraries={
  classic:{name:'Classic Physique',poses:[
    {name:'Doble bíceps de frente',pos:'0% 0%',cues:['Pierna adelantada 40–50 cm y abierta','Codos altos; puños cerrados hacia abajo','Expande dorsal y contrae piernas completas']},
    {name:'Pecho de lado',pos:'33.333% 0%',cues:['Presenta tu mejor lado','Pecho alto y hombro posterior abierto','Aprieta bíceps, femoral y pantorrilla']},
    {name:'Doble bíceps de espalda',pos:'66.667% 0%',cues:['Un pie atrás apoyado en la punta','Abre la espalda antes de cerrar brazos','Contrae glúteos, femorales y pantorrillas']},
    {name:'Tríceps de lado',pos:'100% 0%',cues:['Une manos detrás y fija el brazo','Pecho arriba; abdomen firme','Pierna cercana plana y posterior en punta']},
    {name:'Vacuum',pos:'0% 100%',cues:['Manos detrás de la cabeza','Exhala y lleva el ombligo hacia la columna','Mantén torso alto y piernas activas']},
    {name:'Abdominales y muslo',pos:'33.333% 100%',cues:['Manos detrás de la cabeza','Adelanta una pierna y marca cuádriceps','Cierra costillas sin colapsar la postura']},
    {name:'Pose clásica favorita',pos:'66.667% 100%',cues:['Elige tu línea más estética','Conecta pies, cadera, torso y mirada','Sostén sin perder respiración ni elegancia']}
  ]},
  bodybuilding:{name:'Bodybuilding',poses:[
    {name:'Doble bíceps de frente',pos:'0% 0%',cues:['Pies firmes y cuádriceps activos','Codos altos y simétricos','Cintura controlada; dorsal abierto']},
    {name:'Expansión dorsal de frente',pos:'33.333% 0%',cues:['Puños a la cintura','Lleva codos al frente y expande dorsales','Mantén pecho alto y piernas contraídas']},
    {name:'Pecho de lado',pos:'66.667% 0%',cues:['Talón cercano elevado','Eleva caja torácica','Contrae pecho, brazo y pierna a la vez']},
    {name:'Doble bíceps de espalda',pos:'100% 0%',cues:['Muestra pantorrilla con pie atrás','Abre dorsales y fija cintura','Contrae cadena posterior completa']},
    {name:'Expansión dorsal de espalda',pos:'0% 100%',cues:['Puños a la cintura','Codos al frente para ganar amplitud','Glúteos y femorales siempre activos']},
    {name:'Tríceps de lado',pos:'33.333% 100%',cues:['Bloquea la mano posterior','Empuja el brazo cercano contra el torso','Pecho alto; pierna y abdomen firmes']},
    {name:'Abdominales y muslo',pos:'66.667% 100%',cues:['Adelanta y flexiona el cuádriceps','Exhala sin perder control','Marca abdomen sin cerrar hombros']},
    {name:'Más musculoso',pos:'100% 100%',cues:['Acerca brazos sin ocultar el torso','Contrae pecho, hombros y trapecio','Piernas firmes; expresión bajo control']}
  ]},
  foundation:{name:'Presentación base',poses:[
    {name:'Pose de frente',image:'assets/posing/front-pose.png',cues:['Hombros alineados y pecho elevado','Dorsal abierto con ligero giro de torso','Mano a la cintura y cadera proyectada']},
    {name:'Lado izquierdo',image:'assets/posing/side-pose.png',cues:['Torso erguido y pecho abierto','Rota hacia jueces; presenta glúteo','Pierna posterior en punta']},
    {name:'Pose de espalda',image:'assets/posing/back-pose.png',cues:['Torso erguido y ligera extensión lumbar','Cadera atrás y glúteo proyectado','Rodillas hacia afuera; pies estables']},
    {name:'Lado derecho',image:'assets/posing/side-pose.png',mirror:true,cues:['Repite la línea del lado opuesto','Abre pecho y orienta el torso','Controla mano, glúteo y pie posterior']}
  ]}
};
const routinePresets={express:{name:'Express',hold:15,transition:8,rounds:1},technique:{name:'Técnica',hold:25,transition:10,rounds:2},stage:{name:'Tarima',hold:30,transition:8,rounds:3}};
let timer=null,segments=[],index=0,deadline=0,remaining=0,paused=false;
const clock=document.querySelector('#timerClock'),phase=document.querySelector('#timerPhase'),round=document.querySelector('#timerRound'),pause=document.querySelector('#pauseTimer'),reset=document.querySelector('#resetTimer'),skip=document.querySelector('#skipPose'),poseVisual=document.querySelector('#poseVisual'),poseName=document.querySelector('#poseName'),poseCues=document.querySelector('#poseCues'),poseCounter=document.querySelector('#poseCounter'),categorySelect=document.querySelector('#poseCategory'),routineSelect=document.querySelector('#poseRoutine'),posePlan=document.querySelector('#posePlan'),startPose=document.querySelector('#startPoseTimer');
function selectedPoseData(){return {library:poseLibraries[categorySelect.value],preset:routinePresets[routineSelect.value]};}
function setPoseVisual(pose,library,position=0){
  poseVisual.className='pose-visual';poseVisual.style.backgroundImage='';poseVisual.style.backgroundPosition='';
  if(pose.image){poseVisual.classList.add('pose-photo');poseVisual.style.backgroundImage=`url('${pose.image}')`;if(pose.mirror)poseVisual.classList.add('mirror');}
  else{poseVisual.classList.add(categorySelect.value==='classic'?'classic-sprite':'bodybuilding-sprite');poseVisual.style.backgroundPosition=pose.pos;}
  poseVisual.setAttribute('aria-label',`Referencia visual: ${pose.name}`);poseName.textContent=pose.name;poseCues.replaceChildren(...pose.cues.map(cue=>{const li=document.createElement('li');li.textContent=cue;return li;}));poseCounter.textContent=`POSE ${position+1} / ${library.poses.length}`;
}
function secondsToLabel(total){const min=Math.floor(total/60),sec=total%60;return `${min}:${String(sec).padStart(2,'0')} min`;}
function updatePosePlan(){const {library,preset}=selectedPoseData(),perRound=library.poses.length*preset.hold+(library.poses.length-1)*preset.transition,total=perRound*preset.rounds+(preset.rounds-1)*preset.transition;posePlan.innerHTML=`<strong>${library.name} · ${preset.name}</strong><span>${library.poses.length} poses · ${preset.hold}s por pose · ${preset.rounds} ${preset.rounds===1?'vuelta':'vueltas'} · ${secondsToLabel(total)}</span>`;setPoseVisual(library.poses[0],library,0);clock.textContent=`00:${String(preset.hold).padStart(2,'0')}`;round.textContent=`Rutina ${preset.name} · ${preset.rounds} ${preset.rounds===1?'vuelta':'vueltas'}`;}
categorySelect.onchange=updatePosePlan;routineSelect.onchange=updatePosePlan;updatePosePlan();
function unlockPoseLab(message='Acceso activo · Tu rutina está lista.') {document.querySelector('#poseLeadCard').hidden=true;document.querySelector('#poseWorkspace').hidden=false;document.querySelector('#timerNotice').textContent=message;updatePosePlan();}
try{if(localStorage.getItem('aburto_pose_access')==='1')unlockPoseLab();}catch{}
document.querySelector('#poseLeadForm').onsubmit=async e=>{e.preventDefault();const submit=document.querySelector('#poseLeadSubmit'),error=document.querySelector('#poseLeadError'),f=new FormData(e.currentTarget),email=String(f.get('email')||'').trim(),phone=String(f.get('phone')||'').trim();error.textContent='';if(!email&&!phone){error.textContent='Escribe un correo o un número de WhatsApp.';return;}submit.disabled=true;submit.textContent='Activando…';try{const response=await fetch('/api/lead',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:f.get('name'),contact:[email,phone].filter(Boolean).join(' · '),interest:'Temporizador de posing',experience:`Categoría inicial: ${categorySelect.value}`,modality:'Herramienta digital gratuita',timing:'Uso inmediato'})}),data=await response.json();if(!response.ok)throw new Error(data.error||'No pudimos activar la herramienta.');try{localStorage.setItem('aburto_pose_access','1');}catch{}unlockPoseLab(email?(data.userCopySent?'Acceso activo · Enviamos una copia a tu correo.':'Acceso activo · Tu rutina está lista; la copia por correo quedó pendiente.'):'Acceso activo · Tu rutina está lista.');}catch(err){error.textContent=err.message;}finally{submit.disabled=false;submit.textContent='Entrar al Posing Lab';}};
function draw(){const sec=Math.max(0,Math.ceil(remaining/1000));clock.textContent=`${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`;}
function renderSegment(){const segment=segments[index],{library}=selectedPoseData();setPoseVisual(segment.pose,library,segment.poseIndex);phase.textContent=segment.kind==='pose'?'SOSTÉN Y RESPIRA':`TRANSICIÓN → ${segment.pose.name.toUpperCase()}`;round.textContent=`Vuelta ${segment.round} de ${segments.at(-1).round} · ${segment.kind==='pose'?'Pose':'Prepara la siguiente pose'}`;}
function finishPoseTimer(){clearInterval(timer);timer=null;remaining=0;draw();phase.textContent='RUTINA COMPLETADA';round.textContent='Revisa el video, anota una corrección y repite con intención.';pause.disabled=true;skip.disabled=true;startPose.disabled=false;categorySelect.disabled=false;routineSelect.disabled=false;document.querySelector('#timerNotice').textContent='Completaste la rutina. La calidad de cada transición cuenta tanto como la pose.';}
function tick(){remaining=deadline-Date.now();while(remaining<=0&&index<segments.length-1){index++;deadline+=segments[index].seconds*1000;remaining=deadline-Date.now();renderSegment();}if(remaining<=0)finishPoseTimer();else draw();}
document.querySelector('#timerForm').onsubmit=e=>{e.preventDefault();gate(()=>{const {library,preset}=selectedPoseData();clearInterval(timer);segments=[];for(let r=1;r<=preset.rounds;r++){library.poses.forEach((pose,i)=>{segments.push({kind:'pose',pose,poseIndex:i,round:r,seconds:preset.hold});if(i<library.poses.length-1)segments.push({kind:'transition',pose:library.poses[i+1],poseIndex:i+1,round:r,seconds:preset.transition});});if(r<preset.rounds)segments.push({kind:'transition',pose:library.poses[0],poseIndex:0,round:r+1,seconds:preset.transition});}index=0;paused=false;pause.textContent='Pausar';pause.disabled=false;skip.disabled=false;reset.disabled=false;startPose.disabled=true;categorySelect.disabled=true;routineSelect.disabled=true;remaining=segments[0].seconds*1000;deadline=Date.now()+remaining;renderSegment();draw();timer=setInterval(tick,200);document.querySelector('#timerNotice').textContent='';});};
pause.onclick=()=>{if(!paused){remaining=Math.max(0,deadline-Date.now());clearInterval(timer);timer=null;paused=true;pause.textContent='Continuar';phase.textContent='PAUSA';}else{deadline=Date.now()+remaining;paused=false;pause.textContent='Pausar';renderSegment();timer=setInterval(tick,200);tick();}};
skip.onclick=()=>{if(index>=segments.length-1){finishPoseTimer();return;}index++;remaining=segments[index].seconds*1000;deadline=Date.now()+remaining;renderSegment();draw();};
reset.onclick=()=>{clearInterval(timer);timer=null;paused=false;const {library,preset}=selectedPoseData();remaining=preset.hold*1000;draw();phase.textContent='LISTO PARA COMENZAR';round.textContent=`Rutina ${preset.name} · ${preset.rounds} ${preset.rounds===1?'vuelta':'vueltas'}`;setPoseVisual(library.poses[0],library,0);pause.disabled=true;skip.disabled=true;pause.textContent='Pausar';reset.disabled=true;startPose.disabled=false;categorySelect.disabled=false;routineSelect.disabled=false;document.querySelector('#timerNotice').textContent='';};
document.addEventListener('visibilitychange',()=>{if(document.hidden&&timer&&!paused){pause.click();document.querySelector('#timerNotice').textContent='Práctica pausada al salir de la página. Pulsa Continuar cuando estés listo.';}});
