const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const productDescriptions={'5 claves antes de competir':'guía digital para organizar categoría, presentación, logística y decisiones previas a una competencia','Posing intensivo':'minicurso en video sobre postura, transiciones, presencia y práctica por categoría','Diario de progreso':'workbook de 12 semanas para registrar entrenamiento, recuperación, tendencias y check-ins'};
const serviceDescriptions={
  'Coaching 1 a 1':'acompañamiento personalizado en modalidad online por $2,699 MXN o presencial por $10,000 MXN',
  'Bodybuilding Training System':'sistema online de entrenamiento por $3,000 MXN',
  'Posing Coaching | Aburto Team':'coaching de posing por categoría por $2,500 MXN',
  'Preparación para Competencia':'preparación y seguimiento competitivo por $4,000 MXN'
};
const leadRouting={email:'raiznoblemx@gmail.com',whatsapp:'522282780491',whatsappDisplay:'+52 228 278 0491'};
const emptyProfile=()=>({interest:'',experience:'',modality:'',timing:'',name:'',contact:''});
const state={step:0,profile:emptyProfile(),history:[]};
let lastCapturedLead='',lastCaptureResult=null;
const flow=[
  {key:'interest',question:'¿Qué servicio o producto quieres elegir?',options:['Coaching 1 a 1','Bodybuilding Training System','Posing Coaching | Aburto Team','Preparación para Competencia','Productos digitales']},
  {key:'experience',question:'¿Cómo describirías tu experiencia actual?',options:['Estoy empezando','Ya entreno con constancia','Ya he competido','Soy coach o atleta avanzado']},
  {key:'modality',question:'¿Qué modalidad te interesa explorar?',options:['En línea','Presencial','Producto digital','Quiero comparar opciones']},
  {key:'timing',question:'¿En qué momento te gustaría comenzar?',options:['Lo antes posible','Este mes','En 1 a 3 meses','Sólo estoy explorando']},
  {key:'name',question:'Perfecto. ¿Cómo te llamas?',options:[]},
  {key:'contact',question:'Último paso: escribe tu WhatsApp o correo para identificar tu solicitud. Si eliges coaching en línea o presencial, el equipo recibirá tu registro para atención directa. No compartas datos médicos sensibles aquí.',options:[]}
];
const chatLog=$('#chatLog'),quickReplies=$('#quickReplies'),chatForm=$('#chatForm'),chatInput=$('#chatInput');
function addMessage(text,who='bot',extraClass=''){const message=document.createElement('div');message.className=`message ${who} ${extraClass}`.trim();message.textContent=text;chatLog.appendChild(message);chatLog.scrollTop=chatLog.scrollHeight;if(!extraClass)state.history.push({role:who==='bot'?'assistant':'user',content:text});return message}
function setReplies(options=[]){quickReplies.replaceChildren();options.forEach(option=>{const button=document.createElement('button');button.type='button';button.textContent=option;button.addEventListener('click',()=>answer(option));quickReplies.appendChild(button)})}
function askCurrent(){if(state.step>=flow.length)return finishQualification();const current=flow[state.step];setTimeout(()=>{addMessage(current.question);setReplies(current.options);chatInput.placeholder=current.options.length?'O elige una respuesta…':'Escribe aquí…';chatInput.focus({preventScroll:true})},260)}
function answer(value){const clean=String(value).trim().slice(0,500);if(!clean)return;addMessage(clean,'user');setReplies([]);if(state.profile.interest==='Productos digitales'&&state.step===1&&productDescriptions[clean]){state.profile.interest=clean;addMessage(`Perfecto. ${clean} es ${productDescriptions[clean]}.`);askCurrent();return}const current=flow[state.step];state.profile[current.key]=clean;state.step+=1;if(current.key==='interest'&&clean==='Productos digitales'){addMessage('“5 Claves Antes de Competir” está disponible por $300 MXN. Posing Intensivo y Diario de Progreso se lanzan próximamente.');setReplies(Object.keys(productDescriptions));return}if(current.key==='interest'&&serviceDescriptions[clean])addMessage(`Perfecto. ${clean} es ${serviceDescriptions[clean]}.`);askCurrent()}
function recommendation(){const p=state.profile,target=`${p.interest} ${p.experience} ${p.modality}`.toLowerCase();if(target.includes('coaching 1 a 1'))return p.modality.toLowerCase().includes('presencial')?'Coaching 1 a 1 presencial — $10,000 MXN':p.modality.toLowerCase().includes('en línea')||p.modality.toLowerCase().includes('online')?'Coaching 1 a 1 online — $2,699 MXN':'Coaching 1 a 1 — online $2,699 MXN / presencial $10,000 MXN';if(target.includes('bodybuilding'))return'Bodybuilding Training System — $3,000 MXN';if(target.includes('posing coaching'))return'Posing Coaching | Aburto Team — $2,500 MXN';if(target.includes('preparación para competencia'))return'Preparación para Competencia — $4,000 MXN';if(target.includes('5 claves'))return'5 Claves Antes de Competir — $300 MXN';if(target.includes('posing intensivo'))return'Posing Intensivo — próximamente';if(target.includes('diario de progreso'))return'Diario de Progreso — próximamente';return'Conversación inicial para definir la mejor ruta'}
async function captureLead(){const fingerprint=JSON.stringify(state.profile);if(fingerprint===lastCapturedLead&&lastCaptureResult)return lastCaptureResult;lastCapturedLead=fingerprint;try{const response=await fetch('/api/lead',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(state.profile)});const data=await response.json().catch(()=>({}));lastCaptureResult={ok:response.ok,saved:data.saved===true,notifyEligible:data.notifyEligible===true,whatsappQueued:data.whatsappQueued===true,whatsappSent:data.whatsappSent===true,error:data.error||''};return lastCaptureResult}catch{lastCaptureResult={ok:false,saved:false,notifyEligible:false,whatsappQueued:false,whatsappSent:false,error:'No se pudo conectar con el servidor.'};return lastCaptureResult}}
function leadSummary(){const p=state.profile;return`Hola Andrés, soy ${p.name||'visitante del sitio'}.

Interés: ${p.interest||'Por definir'}
Experiencia: ${p.experience||'Por definir'}
Modalidad: ${p.modality||'Por definir'}
Momento para comenzar: ${p.timing||'Por definir'}
Contacto: ${p.contact||'Por confirmar'}
Ruta sugerida por el asistente: ${recommendation()}

Me gustaría conocer el alcance, disponibilidad y precio antes de comenzar.`}
async function finishQualification(){const delivery=await captureLead();const direct=delivery.notifyEligible===true;addMessage(`Gracias, ${state.profile.name||'listo'}. Por lo que me compartiste, el siguiente paso sugerido es: ${recommendation()}.\n\n${direct?'Tu solicitud de coaching quedó registrada para atención directa con Andrés.':'Tu interés quedó registrado correctamente.'}`);const box=document.createElement('div');box.className='summary';const title=document.createElement('strong');title.textContent='RESUMEN DE TU SOLICITUD';const pre=document.createElement('pre');pre.textContent=leadSummary();const deliveryStatus=document.createElement('p');deliveryStatus.className='delivery-status';if(direct){deliveryStatus.textContent=delivery.whatsappSent?'Listo: el equipo recibió automáticamente el aviso por WhatsApp.':delivery.whatsappQueued?'Tu solicitud quedó guardada y el aviso al equipo quedó en cola para WhatsApp.':'Tu solicitud quedó guardada para seguimiento directo con Andrés.'}else{deliveryStatus.textContent='Registro guardado. Los productos digitales y herramientas no generan avisos por WhatsApp.'}const actions=document.createElement('div');actions.className='summary-actions';const copy=document.createElement('button');copy.type='button';copy.textContent='Copiar resumen';copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(leadSummary());showToast('Resumen copiado')}catch{showToast('Selecciona y copia el resumen manualmente')}});actions.append(copy);box.append(title,pre,deliveryStatus,actions);chatLog.appendChild(box);chatLog.scrollTop=chatLog.scrollHeight;setReplies([]);const again=document.createElement('button');again.type='button';again.textContent='Hacer otra consulta';again.addEventListener('click',resetChat);quickReplies.appendChild(again);chatInput.placeholder='También puedes hacer una pregunta libre…'}
async function askAI(text){addMessage(text,'user');setReplies([]);const loading=addMessage('Analizando tu pregunta…','bot','loading');try{const response=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:state.history.slice(-10),profile:state.profile})});if(!response.ok)throw new Error('AI unavailable');const data=await response.json();loading.remove();addMessage(data.text||fallbackReply(text))}catch{loading.remove();addMessage(fallbackReply(text))}const button=document.createElement('button');button.type='button';button.textContent=state.step<flow.length?'Continuar con mi orientación':'Preparar mi solicitud';button.addEventListener('click',()=>state.step<flow.length?askCurrent():finishQualification());quickReplies.appendChild(button)}
function fallbackReply(text){const value=text.toLowerCase();if(value.includes('precio')||value.includes('cuánto')||value.includes('costo'))return'Los precios actuales son: Coaching 1 a 1 online $2,699 MXN o presencial $10,000 MXN; Bodybuilding Training System $3,000 MXN; Posing Coaching $2,500 MXN; Preparación para Competencia $4,000 MXN; y la guía 5 Claves $300 MXN.';if(value.includes('compet')||value.includes('tarima'))return'La Preparación para Competencia cuesta $4,000 MXN. Para orientarte necesitamos experiencia, división, federación y fecha aproximada.';if(value.includes('posing')||value.includes('pose'))return'Posing Coaching | Aburto Team está disponible por $2,500 MXN. El minicurso Posing Intensivo se lanza próximamente.';if(value.includes('nutri')||value.includes('dieta'))return'La orientación nutricional requiere contexto individual. No te daré dosis ni protocolos aquí, pero puedo preparar una solicitud clara para que Andrés valore tu caso.';return'Puedo registrar tu elección entre Coaching 1 a 1, Bodybuilding Training System, Posing Coaching, Preparación para Competencia o la guía 5 Claves Antes de Competir.'}
function resetChat(askFirst=true){state.step=0;state.profile=emptyProfile();state.history=[];lastCapturedLead='';lastCaptureResult=null;chatLog.replaceChildren();setReplies([]);addMessage('Hola. Soy el asistente de Aburto Pro Coach. Te ayudaré a encontrar el siguiente paso y a preparar tu solicitud en menos de dos minutos.');if(askFirst)askCurrent()}
function startWithInterest(interest){$('#asistente')?.scrollIntoView({behavior:'smooth'});resetChat(false);setTimeout(()=>{state.profile.interest=interest;state.step=1;addMessage(interest,'user');const description=productDescriptions[interest]||serviceDescriptions[interest];if(description)addMessage(`Perfecto. ${interest} es ${description}. Voy a hacerte unas preguntas breves para registrar tu elección.`);setReplies([]);askCurrent()},500)}
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

function initPaymentReturn(){
  const params=new URLSearchParams(location.search);
  if(params.get('pago')!=='exito')return;
  const store=$('#tienda');
  if(!store)return;
  const notice=document.createElement('div');
  notice.className='payment-return';
  notice.setAttribute('role','status');
  notice.innerHTML='<strong>Gracias por tu compra.</strong><span>Stripe terminó el proceso de pago. El equipo dará seguimiento con los datos registrados en el checkout.</span>';
  $('.wrap',store)?.prepend(notice);
}

initMobileExperience();
initReviewCarousel();
initPaymentReturn();
resetChat();
