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
    form.addEventListener('change', () => {
      const value = Number(new FormData(form).get('rating'));
      form.querySelectorAll('.local-review-rating label').forEach((label,i)=>label.classList.toggle('selected',i<value));
    });
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const button = form.querySelector('button'), status = form.querySelector('.local-review-status'), data = new FormData(form);
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
      } catch(error) {status.textContent=error.message;} finally {button.disabled=false;}
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
    widgets.forEach(widget=>widget.querySelector('button').disabled=false);
    render();
  }
  if (document.getElementById('reviewsTrack')) {
    fetch('/data/bts-reviews.json').then(r=>r.json()).then(data=>{archive=data.reviews;render();}).catch(()=>{});
  }
  load().catch(error => {
    widgets.forEach(widget=>{
      widget.querySelector('.local-review-count').textContent='Las reseñas del sitio no están disponibles en este momento.';
      widget.querySelector('.local-review-status').textContent=error.message;
      widget.querySelector('button').disabled=false;
    });
  });
})();
