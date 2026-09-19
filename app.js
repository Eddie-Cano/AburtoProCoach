const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const productDescriptions={'5 claves antes de competir':'guía digital para organizar categoría, presentación, logística y decisiones previas a una competencia','Posing intensivo':'minicurso en video sobre postura, transiciones, presencia y práctica por categoría','Diario de progreso':'workbook de 12 semanas para registrar entrenamiento, recuperación, tendencias y check-ins'};
const leadRouting={email:'raiznoblemx@gmail.com',whatsapp:'522282780491',whatsappDisplay:'+52 228 278 0491'};
const emptyProfile=()=>({interest:'',experience:'',modality:'',timing:'',name:'',contact:''});
const state={step:0,profile:emptyProfile(),history:[]};
let lastCapturedLead='',lastCaptureResult=null;
const flow=[
  {key:'interest',question:'Para orientarte bien, ¿qué te interesa trabajar primero?',options:['Entrenamiento personalizado','Nutrición deportiva','Preparación competitiva','Productos digitales','No estoy seguro']},
  {key:'experience',question:'¿Cómo describirías tu experiencia actual?',options:['Estoy empezando','Ya entreno con constancia','Ya he competido','Soy coach o atleta avanzado']},
  {key:'modality',question:'¿Qué modalidad te interesa explorar?',options:['En línea','Presencial','Producto digital','Quiero comparar opciones']},
  {key:'timing',question:'¿En qué momento te gustaría comenzar?',options:['Lo antes posible','Este mes','En 1 a 3 meses','Sólo estoy explorando']},
  {key:'name',question:'Perfecto. ¿Cómo te llamas?',options:[]},
  {key:'contact',question:'Último paso: escribe tu WhatsApp o correo para identificar tu solicitud. Al terminar, enviaremos una copia a Raíz Noble por correo y podrás mandar el mismo resumen por WhatsApp. No compartas datos médicos sensibles aquí.',options:[]}
];
const chatLog=$('#chatLog'),quickReplies=$('#quickReplies'),chatForm=$('#chatForm'),chatInput=$('#chatInput');
function addMessage(text,who='bot',extraClass=''){const message=document.createElement('div');message.className=`message ${who} ${extraClass}`.trim();message.textContent=text;chatLog.appendChild(message);chatLog.scrollTop=chatLog.scrollHeight;if(!extraClass)state.history.push({role:who==='bot'?'assistant':'user',content:text});return message}
function setReplies(options=[]){quickReplies.replaceChildren();options.forEach(option=>{const button=document.createElement('button');button.type='button';button.textContent=option;button.addEventListener('click',()=>answer(option));quickReplies.appendChild(button)})}
function askCurrent(){if(state.step>=flow.length)return finishQualification();const current=flow[state.step];setTimeout(()=>{addMessage(current.question);setReplies(current.options);chatInput.placeholder=current.options.length?'O elige una respuesta…':'Escribe aquí…';chatInput.focus({preventScroll:true})},260)}
function answer(value){const clean=String(value).trim().slice(0,500);if(!clean)return;addMessage(clean,'user');setReplies([]);if(state.profile.interest==='Productos digitales'&&state.step===1&&productDescriptions[clean]){state.profile.interest=clean;addMessage(`Perfecto. ${clean} es ${productDescriptions[clean]}.`);askCurrent();return}const current=flow[state.step];state.profile[current.key]=clean;state.step+=1;if(current.key==='interest'&&clean==='Productos digitales'){addMessage('Tenemos tres productos en desarrollo. Elige el que te interesa o continúa para que te recomiende uno.');setReplies(Object.keys(productDescriptions));return}askCurrent()}
function recommendation(){const p=state.profile,target=`${p.interest} ${p.experience} ${p.modality}`.toLowerCase();if(target.includes('posing'))return'Posing intensivo';if(target.includes('compet'))return'Preparación competitiva + 5 claves antes de competir';if(target.includes('producto digital'))return p.experience.includes('competido')?'Posing intensivo':'Diario de progreso';if(target.includes('nutric'))return'Solicitud de orientación en nutrición deportiva';if(target.includes('entrenamiento'))return'Solicitud de entrenamiento personalizado';return'Conversación inicial para definir la mejor ruta'}
async function captureLead(){const fingerprint=JSON.stringify(state.profile);if(fingerprint===lastCapturedLead&&lastCaptureResult)return lastCaptureResult;lastCapturedLead=fingerprint;try{const response=await fetch('/api/lead',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(state.profile)});const data=await response.json().catch(()=>({}));lastCaptureResult={ok:response.ok,saved:data.saved===true,notified:data.notified===true,error:data.error||''};return lastCaptureResult}catch{lastCaptureResult={ok:false,saved:false,notified:false,error:'No se pudo conectar con el servidor.'};return lastCaptureResult}}
function leadSummary(){const p=state.profile;return`Hola Andrés, soy ${p.name||'visitante del sitio'}.

Interés: ${p.interest||'Por definir'}
Experiencia: ${p.experience||'Por definir'}
Modalidad: ${p.modality||'Por definir'}
Momento para comenzar: ${p.timing||'Por definir'}
Contacto: ${p.contact||'Por confirmar'}
Ruta sugerida por el asistente: ${recommendation()}

Me gustaría conocer el alcance, disponibilidad y precio antes de comenzar.`}
async function finishQualification(){const delivery=await captureLead();addMessage(`Gracias, ${state.profile.name||'listo'}. Por lo que me compartiste, el siguiente paso sugerido es: ${recommendation()}.

Preparé un resumen para que el equipo entienda tu objetivo sin hacerte repetir todo.`);const box=document.createElement('div');box.className='summary';const title=document.createElement('strong');title.textContent='RESUMEN DE TU SOLICITUD';const pre=document.createElement('pre');pre.textContent=leadSummary();const deliveryStatus=document.createElement('p');deliveryStatus.className='delivery-status';deliveryStatus.textContent=delivery.notified?`Copia enviada automáticamente a ${leadRouting.email}. Para que también llegue por WhatsApp, toca el botón y confirma Enviar al ${leadRouting.whatsappDisplay}.`:delivery.saved?`La solicitud quedó guardada. Para enviarla por WhatsApp, toca el botón y confirma Enviar al ${leadRouting.whatsappDisplay}.`:'No pudimos confirmar el envío automático por correo. Usa los botones siguientes; en WhatsApp deberás confirmar Enviar.';const actions=document.createElement('div');actions.className='summary-actions';const whatsapp=document.createElement('a');whatsapp.className='primary';whatsapp.href=`https://wa.me/${leadRouting.whatsapp}?text=${encodeURIComponent(leadSummary())}`;whatsapp.textContent='Enviar ahora por WhatsApp ↗';whatsapp.setAttribute('aria-label',`Abrir WhatsApp y enviar el resumen al ${leadRouting.whatsappDisplay}`);whatsapp.addEventListener('click',()=>showToast('En WhatsApp, pulsa Enviar para completar el registro'));const email=document.createElement('a');email.href=`mailto:${leadRouting.email}?subject=${encodeURIComponent('Nueva solicitud — Aburto Pro Coach')}&body=${encodeURIComponent(leadSummary())}`;email.textContent=delivery.notified?'Reenviar por correo ↗':'Enviar por correo ↗';const copy=document.createElement('button');copy.type='button';copy.textContent='Copiar resumen';copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(leadSummary());showToast('Resumen copiado')}catch{showToast('Selecciona y copia el resumen manualmente')}});actions.append(whatsapp,email,copy);box.append(title,pre,deliveryStatus,actions);chatLog.appendChild(box);chatLog.scrollTop=chatLog.scrollHeight;setReplies([]);const again=document.createElement('button');again.type='button';again.textContent='Hacer otra consulta';again.addEventListener('click',resetChat);quickReplies.appendChild(again);chatInput.placeholder='También puedes hacer una pregunta libre…'}
async function askAI(text){addMessage(text,'user');setReplies([]);const loading=addMessage('Analizando tu pregunta…','bot','loading');try{const response=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:state.history.slice(-10),profile:state.profile})});if(!response.ok)throw new Error('AI unavailable');const data=await response.json();loading.remove();addMessage(data.text||fallbackReply(text))}catch{loading.remove();addMessage(fallbackReply(text))}const button=document.createElement('button');button.type='button';button.textContent=state.step<flow.length?'Continuar con mi orientación':'Preparar mi solicitud';button.addEventListener('click',()=>state.step<flow.length?askCurrent():finishQualification());quickReplies.appendChild(button)}
function fallbackReply(text){const value=text.toLowerCase();if(value.includes('precio')||value.includes('cuánto')||value.includes('costo'))return'Los precios y el alcance todavía deben confirmarse directamente con Andrés. Puedo ayudarte a preparar tu solicitud según tu objetivo y modalidad.';if(value.includes('compet')||value.includes('tarima'))return'Para una preparación competitiva primero necesitamos saber tu experiencia, división, federación y fecha aproximada. El asistente puede organizar esos datos antes de contactar al equipo.';if(value.includes('posing')||value.includes('pose'))return'El Posing intensivo está planteado por categoría e incluye postura, transiciones, presencia y práctica. Está en desarrollo; puedo registrarlo como tu principal interés.';if(value.includes('nutri')||value.includes('dieta'))return'La orientación nutricional requiere contexto individual. No te daré dosis ni protocolos aquí, pero puedo preparar una solicitud clara para que Andrés valore tu caso.';return'Puedo orientarte sobre entrenamiento, nutrición deportiva, preparación competitiva y los tres productos digitales. Cuéntame qué quieres lograr y qué experiencia tienes.'}
function resetChat(askFirst=true){state.step=0;state.profile=emptyProfile();state.history=[];lastCapturedLead='';lastCaptureResult=null;chatLog.replaceChildren();setReplies([]);addMessage('Hola. Soy el asistente de Aburto Pro Coach. Te ayudaré a encontrar el siguiente paso y a preparar tu solicitud en menos de dos minutos.');if(askFirst)askCurrent()}
function startWithInterest(interest){$('#asistente')?.scrollIntoView({behavior:'smooth'});resetChat(false);setTimeout(()=>{state.profile.interest=interest;state.step=1;addMessage(interest,'user');if(productDescriptions[interest])addMessage(`Perfecto. ${interest} es ${productDescriptions[interest]}. Voy a hacerte unas preguntas breves para registrar tu interés.`);setReplies([]);askCurrent()},500)}
chatForm.addEventListener('submit',event=>{event.preventDefault();const value=chatInput.value.trim();if(!value)return;chatInput.value='';if(state.step<flow.length)answer(value);else askAI(value)});$('#restartChat').addEventListener('click',resetChat);$$('[data-start]').forEach(button=>button.addEventListener('click',()=>startWithInterest(button.dataset.start)));
$$('[data-img]').forEach(button=>button.addEventListener('click',()=>{$$('[data-img]').forEach(item=>{item.classList.remove('active');item.setAttribute('aria-selected','false')});button.classList.add('active');button.setAttribute('aria-selected','true');$('#storyImg').src=button.dataset.img;$('#storyTitle').textContent=button.dataset.title;$('#storyCopy').textContent=button.dataset.copy}));
const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('visible');observer.unobserve(entry.target)}}),{threshold:.12});$$('.reveal').forEach(node=>observer.observe(node));
window.addEventListener('scroll',()=>{const max=document.documentElement.scrollHeight-innerHeight;$('#scrollProgress').style.width=`${max>0?(scrollY/max)*100:0}%`;if(!matchMedia('(prefers-reduced-motion: reduce)').matches&&innerWidth>760){$$('[data-depth]').forEach(node=>{const rect=node.getBoundingClientRect(),offset=(rect.top-innerHeight/2)*Number(node.dataset.depth||0);node.style.transform=`translate3d(0,${offset}px,0)`})}},{passive:true});
function showToast(text){const toast=$('#toast');toast.textContent=text;toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),2200)}
function initMobileExperience(){
  const toggle=$('#menuToggle'),menu=$('#mobileMenu');
  if(toggle&&menu){
    const closeMenu=()=>{toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-label','Abrir menú');document.body.classList.remove('menu-open')};
    toggle.addEventListener('click',()=>{
      const open=toggle.getAttribute('aria-expanded')!=='true';
      toggle.setAttribute('aria-expanded',String(open));
      toggle.setAttribute('aria-label',open?'Cerrar menú':'Abrir menú');
      document.body.classList.toggle('menu-open',open);
    });
    $$('a',menu).forEach(link=>link.addEventListener('click',closeMenu));
    document.addEventListener('keydown',event=>{if(event.key==='Escape')closeMenu()});
    matchMedia('(min-width: 1051px)').addEventListener?.('change',event=>{if(event.matches)closeMenu()});
  }

  const video=$('#heroVideo'),playButton=$('#heroVideoPlay');
  if(video&&playButton){
    const showPlay=()=>document.body.classList.add('video-needs-play');
    const hidePlay=()=>document.body.classList.remove('video-needs-play');
    const tryPlay=()=>{
      video.muted=true;
      video.defaultMuted=true;
      video.setAttribute('muted','');
      const attempt=video.play();
      if(attempt&&typeof attempt.then==='function')attempt.then(hidePlay).catch(showPlay);
    };
    video.addEventListener('playing',hidePlay);
    video.addEventListener('canplay',tryPlay,{once:true});
    video.addEventListener('error',showPlay);
    playButton.addEventListener('click',tryPlay);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden&&video.paused)tryPlay()});
    tryPlay();
  }
}

function initReviewCarousel(){
  const track=$('#reviewsTrack'),previous=$('#reviewPrev'),next=$('#reviewNext');
  if(!track||!previous||!next)return;
  const move=direction=>{
    const distance=Math.max(track.clientWidth*.82,280);
    const atStart=track.scrollLeft<4;
    const atEnd=track.scrollLeft+track.clientWidth>=track.scrollWidth-4;
    if(direction<0&&atStart)track.scrollTo({left:track.scrollWidth,behavior:'smooth'});
    else if(direction>0&&atEnd)track.scrollTo({left:0,behavior:'smooth'});
    else track.scrollBy({left:distance*direction,behavior:'smooth'});
  };
  previous.addEventListener('click',()=>move(-1));
  next.addEventListener('click',()=>move(1));
  track.addEventListener('keydown',event=>{
    if(event.key==='ArrowLeft'){event.preventDefault();move(-1)}
    if(event.key==='ArrowRight'){event.preventDefault();move(1)}
  });
}

initMobileExperience();
initReviewCarousel();
resetChat();
