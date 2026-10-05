(() => {
  'use strict';
  const targets = {services:'Servicios de Andrés Aburto','5-habitos':'El Día 29','romantizar-la-prep':'Romantizar la Prep','5-claves':'5 Claves Antes de Competir','starter-pack':'Starter Pack'};
  const widgets = [...document.querySelectorAll('[data-review-target]')];
  if (!widgets.length) return;
  const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let ticket, saved = [], archive = [];
  const date = value => new Date(value).toLocaleDateString('es-MX',{month:'long',year:'numeric',timeZone:'UTC'});
  function card(r) {
    return `<article class="review-card" data-review><div class="review-stars" aria-label="${r.rating} de 5 estrellas">${'★'.repeat(r.rating)}${'☆'.repeat(5-r.rating)}</div><blockquote>${esc(r.comment)}</blockquote><div class="review-meta"><strong>${esc(r.name)}</strong><span>${esc(date(r.createdAt))} · ${esc(r.source || 'Sitio de Andrés')}</span></div></article>`;
  }
  widgets.forEach((widget,index) => {
    const target = widget.dataset.reviewTarget, id = `local-review-${index}`;
    widget.innerHTML = `<div class="local-review-heading"><span class="review-type">${target === 'services' ? 'Coaching · Entrenamiento · Nutrición · Posing' : 'Producto digital'}</span><h3>${targets[target]}</h3><p class="local-review-count">Cargando opiniones…</p></div><div class="local-review-list" aria-label="Reseñas de ${targets[target]}"></div><form class="local-review-form"><h4>${target === 'services' ? 'Cuéntanos cómo fue tu proceso' : '¿Qué te pareció este producto?'}</h4><label for="${id}-name">Tu nombre</label><input id="${id}-name" name="name" autocomplete="name" minlength="2" maxlength="100" required placeholder="Como quieres aparecer en tu reseña"><fieldset><legend>Tu calificación</legend><div class="local-review-rating">${[1,2,3,4,5].map(n=>`<label><input type="radio" name="rating" value="${n}" required><span aria-hidden="true">★</span><span class="rating-label">${n} ${n===1?'estrella':'estrellas'}</span></label>`).join('')}</div></fieldset><label for="${id}-comment">Tu experiencia</label><textarea id="${id}-comment" name="comment" rows="4" minlength="10" maxlength="2000" required placeholder="Comparte qué te ayudó y qué podríamos mejorar."></textarea><div class="review-honeypot" aria-hidden="true"><label>Deja este campo vacío<input name="website" tabindex="-1" autocomplete="off"></label></div><label class="local-review-consent"><input type="checkbox" name="consent" required><span>Autorizo publicar mi nombre y opinión. He leído el <a href="/aviso-de-privacidad.html" target="_blank" rel="noopener">Aviso de Privacidad</a>.</span></label><button class="btn" type="submit" disabled>Enviar mi reseña <span>↗</span></button><p class="local-review-status" role="status" aria-live="polite">Las opiniones se revisan antes de publicarse. No necesitas correo ni teléfono.</p></form>`;
    const form = widget.querySelector('form');
    if (target !== 'services') {
      const heading = widget.querySelector('.local-review-heading h3'), menuId = `${id}-products`;
      heading.innerHTML = `<button class="review-product-toggle" type="button" aria-expanded="false" aria-controls="${menuId}" aria-label="Elegir producto para reseñar: ${targets[target]}"><span class="review-product-title">${targets[target]}</span><span class="review-menu-icon" aria-hidden="true"><span></span><span></span><span></span></span></button>`;
      const toggle = heading.querySelector('button'), menu = document.createElement('div');
      menu.id = menuId; menu.className = 'review-product-menu'; menu.hidden = true;
      menu.setAttribute('role','menu'); menu.setAttribute('aria-label','Producto para reseñar');
      menu.innerHTML = Object.entries(targets).filter(([key])=>key!=='services').map(([key,title])=>`<button type="button" role="menuitemradio" aria-checked="${key===target}" tabindex="-1" data-product="${key}">${title}</button>`).join('');
      heading.after(menu);
      form.querySelector('h4').remove();
      const options = [...menu.querySelectorAll('button')];
      const close = () => {menu.hidden=true;toggle.setAttribute('aria-expanded','false');};
      const open = () => {menu.hidden=false;toggle.setAttribute('aria-expanded','true');options.find(option=>option.dataset.product===widget.dataset.reviewTarget).focus();};
      toggle.addEventListener('click',()=>menu.hidden?open():close());
      toggle.addEventListener('keydown',event=>{if(['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();open();}});
      options.forEach(option=>option.addEventListener('click',()=>{
        if(toggle.disabled)return;
        widget.dataset.reviewTarget=option.dataset.product;
        toggle.querySelector('.review-product-title').textContent=targets[option.dataset.product];
        toggle.setAttribute('aria-label',`Elegir producto para reseñar: ${targets[option.dataset.product]}`);
        options.forEach(item=>item.setAttribute('aria-checked',String(item===option)));
        widget.querySelector('.local-review-list').setAttribute('aria-label',`Reseñas de ${targets[option.dataset.product]}`);
        form.querySelector('.local-review-status').textContent='Las opiniones se revisan antes de publicarse. No necesitas correo ni teléfono.';
        close();render();toggle.focus();
      }));
      menu.addEventListener('keydown',event=>{
        const index=options.indexOf(document.activeElement);
        if(event.key==='Escape'){event.preventDefault();close();toggle.focus();}
        if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){
          event.preventDefault();
          options[event.key==='Home'?0:event.key==='End'?options.length-1:(index+(event.key==='ArrowDown'?1:-1)+options.length)%options.length].focus();
        }
      });
      document.addEventListener('click',event=>{if(!widget.contains(event.target))close();});
      widget.addEventListener('focusout',event=>{if(!widget.contains(event.relatedTarget))close();});
    }
    form.addEventListener('change', () => {
      const value = Number(new FormData(form).get('rating'));
      form.querySelectorAll('.local-review-rating label').forEach((label,i)=>label.classList.toggle('selected',i<value));
    });
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const button = form.querySelector('button'), status = form.querySelector('.local-review-status'), data = new FormData(form);
      const target = widget.dataset.reviewTarget, productToggle=widget.querySelector('.review-product-toggle');
      if(productToggle){productToggle.disabled=true;productToggle.setAttribute('aria-expanded','false');widget.querySelector('.review-product-menu').hidden=true;}
      button.disabled = true; status.textContent = 'Enviando tu reseña…';
      try {
        if (!ticket) await load();
        const response = await fetch('/api/reviews',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({target,name:data.get('name'),comment:data.get('comment'),rating:Number(data.get('rating')),consent:data.get('consent')==='on',website:data.get('website'),ticket})});
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'No se pudo enviar. Intenta de nuevo.');
        form.reset();form.querySelectorAll('.selected').forEach(label=>label.classList.remove('selected'));
        status.textContent = '¡Gracias! Recibimos tu reseña. Aparecerá aquí después de la revisión del equipo.';
        ticket = null;
        await load().catch(()=>{});
      } catch(error) {status.textContent=error.message;} finally {button.disabled=false;if(productToggle)productToggle.disabled=false;}
    });
  });
  function render() {
    widgets.forEach(widget => {
      const rows = saved.filter(r=>r.target===widget.dataset.reviewTarget);
      const count = widget.querySelector('.local-review-count');
      count.textContent = rows.length ? `${(rows.reduce((n,r)=>n+r.rating,0)/rows.length).toFixed(1)} / 5 · ${rows.length} ${rows.length===1?'reseña':'reseñas'} en este sitio` : 'Sé la primera persona en compartir tu experiencia aquí.';
      widget.querySelector('.local-review-list').innerHTML = rows.length ? rows.slice().reverse().map(card).join('') : '';
    });
    const track = document.getElementById('reviewsTrack');
    if (track && archive.length) {
      const serviceReviews = saved.filter(r=>r.target==='services');
      track.innerHTML = [...serviceReviews.slice().reverse(),...archive].map(card).join('');
      const all = [...serviceReviews,...archive], score=document.querySelector('.reviews-score');
      score.querySelector('strong').textContent=(all.reduce((sum,r)=>sum+r.rating,0)/all.length).toFixed(1);
      score.querySelector('small').textContent=`${archive.length} en BTS · ${serviceReviews.length} en este sitio`;
      score.setAttribute('aria-label',`${all.length} reseñas de servicios, promedio ${(all.reduce((sum,r)=>sum+r.rating,0)/all.length).toFixed(1)} de 5`);
    }
  }
  async function load() {
    const response = await fetch('/api/reviews',{cache:'no-store'});
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'No se pudieron cargar las reseñas.');
    saved = result.reviews; ticket = result.ticket;
    widgets.forEach(widget=>widget.querySelector('.local-review-form button').disabled=false);
    render();
  }
  if (document.getElementById('reviewsTrack')) {
    fetch('/data/bts-reviews.json').then(r=>r.json()).then(data=>{archive=data.reviews;render();}).catch(()=>{});
  }
  load().catch(error => {
    widgets.forEach(widget=>{
      widget.querySelector('.local-review-count').textContent='Las reseñas del sitio no están disponibles en este momento.';
      widget.querySelector('.local-review-status').textContent=error.message;
      widget.querySelector('.local-review-form button').disabled=false;
    });
  });
})();
