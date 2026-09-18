const root = document.querySelector('#freeTools');
root.innerHTML = `
<div class="tool-nav" aria-label="Herramientas"><button data-tool="macros" class="btn">Calculadora de macros</button><button data-tool="timer" class="btn alt">Temporizador de posing</button></div>
<p id="accessStatus" role="status">Comprobando tu acceso…</p>
<div class="tool-panel" id="panel-macros"><h3>CALCULA TU PUNTO DE PARTIDA.</h3><p>Estimación educativa para adultos sanos. No es una dieta ni una preparación competitiva personalizada.</p>
<form id="macroForm" class="tool-form"><label>Edad (años)<input name="age" type="number" min="18" max="80" required></label><label>Peso (kg)<input name="weight" type="number" min="40" max="200" step="0.1" required></label><label>Estatura (cm)<input name="height" type="number" min="140" max="220" required></label><label>Sexo usado por la fórmula<select name="sex"><option value="5">Masculino</option><option value="-161">Femenino</option></select></label><label>Actividad cotidiana<select name="activity"><option value="1.2">Baja: mayormente sentado</option><option value="1.375">Ligera: movimiento y ejercicio ligero</option><option value="1.55">Moderada: actividad regular</option><option value="1.725">Alta: trabajo activo y entrenamiento</option></select></label><label>Objetivo<select name="goal"><option value="1">Mantener peso</option><option value="0.9">Perder grasa gradualmente</option><option value="1.05">Ganar masa gradualmente</option></select></label><label class="tool-wide"><input type="checkbox" required> Soy adulto y no usaré esta estimación durante embarazo, lactancia, tratamiento de un trastorno alimentario o una condición que requiera dieta supervisada.</label><button class="btn tool-wide">Ver mi resultado</button></form><div id="macroResult" class="tool-result" role="status" hidden></div><details><summary>Cómo se calcula</summary><p>Mifflin–St Jeor: 10 × peso + 6.25 × estatura − 5 × edad + constante por sexo. Se aplica un factor orientativo de actividad; ajuste de −10% o +5% según objetivo. Proteína: 1.6 g/kg; grasas: 30% de las calorías; carbohidratos: calorías restantes. Estas decisiones son orientativas y requieren revisión individual.</p><p><a href="https://pubmed.ncbi.nlm.nih.gov/2305711/" target="_blank" rel="noopener">Ecuación de referencia ↗</a> · <a href="https://pmc.ncbi.nlm.nih.gov/articles/PMC5477153/" target="_blank" rel="noopener">Proteína y ejercicio (ISSN) ↗</a></p></details></div>
<div class="tool-panel" id="panel-timer" hidden><h3>PRACTICA CON INTENCIÓN.</h3><p>Configura tus intervalos de práctica y descanso. Elige tiempos cómodos y mantén una respiración normal.</p><form id="timerForm" class="tool-form"><label>Práctica (segundos)<input name="work" type="number" min="5" max="300" value="30" required></label><label>Descanso (segundos)<input name="rest" type="number" min="5" max="300" value="30" required></label><label>Rondas<input name="rounds" type="number" min="1" max="30" value="5" required></label><button class="btn">Comenzar práctica</button></form><div class="timer-face"><span id="timerPhase">LISTO PARA COMENZAR</span><output id="timerClock" aria-label="Tiempo restante">00:30</output><span id="timerRound">Personaliza tus intervalos</span></div><div class="tool-nav"><button id="pauseTimer" class="btn alt" disabled>Pausar</button><button id="resetTimer" class="btn alt" disabled>Reiniciar</button></div><p id="timerNotice" role="status"></p></div>
<dialog id="accessDialog" aria-labelledby="accessTitle"><button type="button" id="closeAccess" class="restart" aria-label="Cerrar registro">×</button><h3 id="accessTitle">UN REGISTRO.<br>DOS HERRAMIENTAS.</h3><p>Regístrate gratis para ver tus resultados y usar el temporizador.</p><form id="accessForm" class="tool-form"><label class="tool-wide" id="nameLabel">Nombre<input name="name" autocomplete="name" minlength="2" maxlength="100" required></label><label class="tool-wide">Correo<input name="email" type="email" autocomplete="email" maxlength="254" required></label><label class="tool-wide">Teléfono con código de país<input name="phone" type="tel" autocomplete="tel" placeholder="+52 228 123 4567" maxlength="24" required></label><label class="tool-wide" id="consentLabel"><input name="consent" type="checkbox" required> Autorizo guardar estos datos para habilitar y recuperar mi acceso.</label><p class="tool-wide">Los datos se guardan en la base privada de Aburto Pro Coach. Durante esta etapa de pruebas, una copia operativa del registro se envía al correo de Raíz Noble. No se incluyen los datos corporales de la calculadora ni se autoriza publicidad. Puedes solicitar eliminación por <a href="https://www.instagram.com/andrsaburto/" target="_blank" rel="noopener">Instagram @andrsaburto</a>.</p><button class="btn tool-wide" id="saveAccess">Registrarme y continuar</button><button type="button" class="text-link tool-wide" id="returningAccess">Ya me registré</button><p id="accessError" class="tool-wide" role="alert"></p></form></dialog>`;

let registered = false, ready = false, pending = null, returning = false;
const status = document.querySelector('#accessStatus'), dialog = document.querySelector('#accessDialog');
async function checkAccess() {
  try { const r = await fetch('/api/access'); const data = await r.json(); ready = data.ready === true; registered = data.registered === true; }
  catch { ready = false; }
  status.textContent = registered ? 'Acceso activo · Tus dos herramientas están desbloqueadas.' : ready ? 'Regístrate una vez. Recordaremos tu acceso en este navegador.' : 'Las herramientas están preparadas. El registro abrirá próximamente.';
}
await checkAccess();
function gate(action) {
  if (registered) return action();
  pending = action;
  document.querySelector('#accessError').textContent = ready ? '' : 'El registro aún no está disponible. No enviaremos tus datos hasta que se active.';
  document.querySelector('#saveAccess').disabled = !ready;
  dialog.showModal();
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
    registered = true; status.textContent = 'Acceso activo · Tus dos herramientas están desbloqueadas.'; dialog.close(); e.target.reset(); const action = pending; pending = null; action?.();
  } catch (err) { document.querySelector('#accessError').textContent = err.message; }
  finally { submit.disabled = !ready; }
};
root.querySelectorAll('[data-tool]').forEach(button => button.onclick = () => {
  root.querySelectorAll('.tool-panel').forEach(panel => { panel.hidden = panel.id !== `panel-${button.dataset.tool}`; });
  root.querySelectorAll('[data-tool]').forEach(b => b.classList.toggle('alt', b !== button));
});
function cta(out,interest) { const button=document.createElement('button'); button.className='btn'; button.textContent='Quiero ayuda de Andrés ↗'; button.onclick=()=>{ if(typeof window.startWithInterest==='function') window.startWithInterest(interest); else location.hash='asistente'; }; out.append(button); }
document.querySelector('#macroForm').onsubmit = e => {
  e.preventDefault(); const f=new FormData(e.currentTarget); const w=+f.get('weight'), h=+f.get('height'), age=+f.get('age');
  const resting=10*w+6.25*h-5*age+Number(f.get('sex')); const calories=Math.round(resting*Number(f.get('activity'))*Number(f.get('goal'))/10)*10;
  const protein=Math.round(w*1.6), fat=Math.round(calories*.3/9), carbs=Math.round((calories-protein*4-fat*9)/4);
  gate(()=>{ const out=document.querySelector('#macroResult'); out.hidden=false; out.replaceChildren(); const p=document.createElement('p');
    if(carbs<0 || calories<resting) { p.textContent='Esta combinación requiere valoración individual. Habla con Andrés para definir un punto de partida adecuado.'; out.append(p); cta(out,'Nutrición deportiva'); return; }
    const heading=document.createElement('h3'); heading.textContent=`≈ ${calories.toLocaleString('es-MX')} KCAL / DÍA`; out.append(heading);
    p.textContent=`Proteína: ${protein} g · Carbohidratos: ${carbs} g · Grasas: ${fat} g`; out.append(p); const note=document.createElement('p'); note.textContent='Punto de partida estimado, no una prescripción. El gasto real varía; revisa tu evolución con un profesional. Las cifras están redondeadas.'; out.append(note); cta(out,'Nutrición deportiva');
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
