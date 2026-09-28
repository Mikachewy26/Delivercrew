(() => {
  const API_URL = 'https://nbwbqosofzwnxhzpsicj.supabase.co';
  const API_KEY = 'sb_publishable_hXg97V6GpccCRV3zkuQvRQ_fT4UD4Wg';
  const form = document.querySelector('#campaign-form');
  if (!form) return;
  const state = { prices: [] };
  const money = value => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(Number(value || 0));
  const api = async (method, body = {}) => {
    const response = await fetch(`${API_URL}/rest/v1/rpc/${method}`, { method: 'POST', headers: { apikey: API_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.message || 'We could not complete that request. Please try again.');
    return data;
  };
  const loadPrices = async () => {
    const query = 'active=eq.true&price=not.is.null&category=in.(artwork,print,distribution)&select=category,product,option_name,quantity,price,sort_order&order=sort_order.asc';
    const response = await fetch(`${API_URL}/rest/v1/pricing?${query}`, { headers: { apikey: API_KEY } });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error('Prices could not be loaded.');
    return data;
  };
  const optionPrice = (category, product, quantity) => state.prices.find(item => item.category === category && (!product || item.product === product) && (quantity == null || Number(item.quantity) === Number(quantity)));
  const selectedArtwork = () => state.prices.find(item => item.category === 'artwork' && item.option_name === form.elements.artwork_label?.value);
  const updateSummary = () => {
    const artwork = selectedArtwork()?.price || 0;
    const print = document.querySelector('#include-print').checked ? optionPrice('print', document.querySelector('#print-product').value, document.querySelector('#print-quantity').value)?.price || 0 : 0;
    const type = document.querySelector('#distribution-type').value;
    const typeLabel = type === 'shared' ? 'Shared delivery' : type === 'solus' ? 'Solus delivery' : '';
    const distribution = optionPrice('distribution', typeLabel, document.querySelector('#distribution-quantity').value)?.price || 0;
    document.querySelector('#artwork-total').textContent = selectedArtwork() ? money(artwork) : '—';
    document.querySelector('#print-total').textContent = document.querySelector('#include-print').checked ? (print ? money(print) : 'Choose options') : 'Not added';
    document.querySelector('#distribution-total').textContent = distribution ? money(distribution) : '—';
    document.querySelector('#campaign-total').textContent = money(Number(artwork) + Number(print) + Number(distribution));
  };
  const renderPrices = prices => {
    state.prices = prices;
    const artwork = prices.filter(item => item.category === 'artwork');
    document.querySelector('#artwork-options').innerHTML = artwork.map((item, index) => `<label class="choice-card"><input type="radio" name="artwork_label" value="${item.option_name}" ${index === 0 ? 'required' : ''}><span><strong>${item.option_name}</strong><small>${money(item.price)}</small></span></label>`).join('');
    const printProducts = [...new Set(prices.filter(item => item.category === 'print').map(item => item.product))];
    document.querySelector('#print-product').insertAdjacentHTML('beforeend', printProducts.map(product => `<option value="${product}">${product.replace(' 350gsm Silk Finish', '')}</option>`).join(''));
    const quantities = [...new Set(prices.filter(item => item.category === 'distribution').map(item => Number(item.quantity)))].sort((a, b) => a - b);
    document.querySelector('#distribution-quantity').insertAdjacentHTML('beforeend', quantities.map(quantity => `<option value="${quantity}">${quantity.toLocaleString('en-GB')} leaflets</option>`).join(''));
  };
  const updatePrintQuantities = () => {
    const product = document.querySelector('#print-product').value;
    const quantitySelect = document.querySelector('#print-quantity');
    const options = state.prices.filter(item => item.category === 'print' && item.product === product);
    quantitySelect.innerHTML = '<option value="">Choose a quantity</option>' + options.map(item => `<option value="${item.quantity}">${Number(item.quantity).toLocaleString('en-GB')} — ${money(item.price)}</option>`).join('');
    document.querySelector('#print-availability').textContent = product && !options.length ? 'Online pricing for this size is coming soon. Please contact us for a tailored quote.' : '';
    quantitySelect.disabled = !options.length;
    updateSummary();
  };
  document.querySelector('#include-print').addEventListener('change', event => { document.querySelector('#print-fields').hidden = !event.target.checked; document.querySelector('#print-product').required = event.target.checked; document.querySelector('#print-quantity').required = event.target.checked; updateSummary(); });
  document.querySelector('#print-product').addEventListener('change', updatePrintQuantities);
  form.addEventListener('change', updateSummary);
  const today = new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  for(const input of form.querySelectorAll('input[type="date"]')) input.min=today;
  const switchDates=()=>{const flexible=form.elements.date_choice.value==='flexible';document.querySelector('#three-dates').hidden=flexible;document.querySelector('#flexible-dates').hidden=!flexible;document.querySelector('#date-1').required=!flexible;document.querySelector('#ideal-date').required=flexible};
  form.querySelectorAll('[name="date_choice"]').forEach(radio=>radio.addEventListener('change',switchDates));
  const addDays=(iso,days)=>{const d=new Date(`${iso}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10)};
  const dateValues=fields=>{if(fields.get('date_choice')==='flexible'){const ideal=fields.get('ideal_date');const days=Number(fields.get('flex_days'));return{start:addDays(ideal,-days)<today?today:addDays(ideal,-days),end:addDays(ideal,days),description:`Ideal delivery date: ${ideal} ± ${days} days`}}const dates=[fields.get('date_1'),fields.get('date_2'),fields.get('date_3')].filter(Boolean);if(new Set(dates).size!==dates.length)throw new Error('Please choose different preferred dates.');return{start:dates[0],end:dates[0],description:`Preferred delivery dates (in order): ${dates.join(', ')}`}};
  const saved=sessionStorage.getItem('delivercrew-reorder');if(saved){try{const order=JSON.parse(saved);sessionStorage.removeItem('delivercrew-reorder');for(const [key,value] of Object.entries(order)){const field=form.elements[key];if(field&&value&&key!=='print_product'&&key!=='print_quantity')field.value=value}if(order.include_print)document.querySelector('#include-print').click();loadPrices().then(prices=>{renderPrices(prices);if(order.artwork_label){const option=[...form.elements.artwork_label].find(x=>x.value===order.artwork_label);if(option)option.checked=true}if(order.print_product){form.elements.print_product.value=order.print_product;updatePrintQuantities();form.elements.print_quantity.value=order.print_quantity}updateSummary()}).catch(()=>{});form.elements.notes.value=order.notes||''}catch(e){sessionStorage.removeItem('delivercrew-reorder')}}
  if(!saved)loadPrices().then(renderPrices).catch(() => { document.querySelector('#artwork-options').innerHTML = '<p class="form-error">Prices could not be loaded. Please refresh the page or contact us.</p>'; form.querySelector('button[type="submit"]').disabled = true; });
  form.addEventListener('submit', async event => {
    event.preventDefault(); const message = document.querySelector('#form-message'); if (!form.reportValidity()) return;
    const button = form.querySelector('button[type="submit"]'); button.disabled = true; button.textContent = 'Submitting…'; message.className = 'form-message'; message.textContent = '';
    const fields = new FormData(form); const artworkMap = { 'Supply own artwork': 'own_artwork', 'Canva / AI design': 'canva_ai_design', 'Bespoke design': 'bespoke_design' };
    const includePrint = document.querySelector('#include-print').checked;
    let dates;try{dates=dateValues(fields)}catch(error){message.className='form-message form-error';message.textContent=error.message;button.disabled=false;button.textContent='Discuss your order / request quote';return}
    const notes=[dates.description,fields.get('notes')||''].filter(Boolean).join('\n\n');if(notes.length>1500){message.className='form-message form-error';message.textContent='Please shorten your notes to allow room for the delivery dates.';button.disabled=false;button.textContent='Discuss your order / request quote';return}
    const payload = { p_first_name: fields.get('first_name'), p_last_name: fields.get('last_name') || null, p_business_name: fields.get('business_name') || null, p_email: fields.get('email'), p_phone: fields.get('phone') || null, p_address: fields.get('address') || null, p_postcode: fields.get('postcode') || null, p_artwork_option: artworkMap[fields.get('artwork_label')], p_print_product: includePrint ? fields.get('print_product') : null, p_print_quantity: includePrint ? Number(fields.get('print_quantity')) : null, p_distribution_type: fields.get('distribution_type'), p_distribution_quantity: Number(fields.get('distribution_quantity')), p_delivery_area: fields.get('delivery_area'), p_delivery_postcodes: fields.get('delivery_postcodes') || null, p_preferred_start_date: dates.start, p_preferred_end_date: dates.end, p_notes: notes, p_terms_accepted: fields.get('terms_accepted') === 'on', p_website: fields.get('website') || null };
    try { const [result] = await api('submit_campaign', payload); form.innerHTML = `<div class="success-panel"><p class="eyebrow">REQUEST RECEIVED</p><h2>Thank you — your campaign request is in.</h2><p>Your reference is <strong>DC-${result.campaign_number}</strong> and the current guide price is <strong>${money(result.total)}</strong>.</p><p>We will review the delivery area and dates, then contact you before anything is confirmed or charged.</p><a class="button" href="account.html">View my orders</a></div>`; window.scrollTo({ top: document.querySelector('#main').offsetTop, behavior: 'smooth' }); }
    catch (error) { message.className = 'form-message form-error'; message.textContent = error.message; button.disabled = false; button.textContent = 'Discuss your order / request quote'; }
  });
})();
