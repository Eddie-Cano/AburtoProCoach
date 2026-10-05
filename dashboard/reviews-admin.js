async function loadReviews() {
  const container = document.getElementById('reviewModeration');
  const titles = {services:'Servicios','5-habitos':'El Día 29','romantizar-la-prep':'Romantizar la Prep','5-claves':'5 Claves Antes de Competir','starter-pack':'Starter Pack'};
  try {
    const data = await api('/api/reviews?admin=1');
    container.replaceChildren();
    if (!data.reviews.length) {container.textContent='Todavía no hay reseñas recibidas en el sitio.';return;}
    for (const review of data.reviews) {
      const row = document.createElement('div');row.style.flexWrap='wrap';
      const content = document.createElement('div');content.style.flex='1 1 500px';
      const title = document.createElement('strong');title.textContent=`${review.name} · ${titles[review.target]} · ${review.rating}/5 · ${review.status}`;
      const comment = document.createElement('p');comment.style.whiteSpace='pre-wrap';comment.style.overflowWrap='anywhere';comment.textContent=review.comment;
      content.append(title,comment);row.append(content);
      const actions = document.createElement('div');
      for (const [label,status] of [['Publicar','Publicada'],['Ocultar','Oculta']]) {
        const button=document.createElement('button');button.type='button';button.textContent=label;button.className='secondary';button.style.margin='4px';button.disabled=review.status===status;
        button.addEventListener('click',async()=>{
          button.disabled=true;
          try {await api('/api/reviews',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:review.id,status})});await loadReviews();}
          catch(error){button.disabled=false;alert(error.message);}
        });
        actions.append(button);
      }
      row.append(actions);container.append(row);
    }
  } catch(error) {container.textContent=error.message;}
}
