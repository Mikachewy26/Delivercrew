(() => {
  const API_URL = 'https://nbwbqosofzwnxhzpsicj.supabase.co/rest/v1/rpc';
  const API_KEY = 'sb_publishable_hXg97V6GpccCRV3zkuQvRQ_fT4UD4Wg';
  const form = document.querySelector('#campaign-form');
  if (!form) return;
  const state = { prices: [] };
  const money = value => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(Number(value || 0));
  const api = async (method, body = {}) => {
    const response = await fetch(`${API_URL}/${method}`, { method: 'POST', headers: { apikey: API_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.message || 'We could not complete that request. Please try again.');
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
  const today = new Date().toISOString().slice(0, 10);
  document.querySelector('#start-date').min = today; document.querySelector('#end-date').min = today;
  document.querySelector('#start-date').addEventListener('change', event => { document.querySelector('#end-date').min = event.target.value || today; });
  api('get_campaign_prices').then(renderPrices).catch(() => { document.querySelector('#artwork-options').innerHTML = '<p class="form-error">Prices could not be loaded. Please refresh the page or contact us.</p>'; form.querySelector('button[type="submit"]').disabled = true; });
  form.addEventListener('submit', async event => {
    event.preventDefault(); const message = document.querySelector('#form-message'); if (!form.reportValidity()) return;
    const button = form.querySelector('button[type="submit"]'); button.disabled = true; button.textContent = 'Submitting…'; message.className = 'form-message'; message.textContent = '';
    const fields = new FormData(form); const artworkMap = { 'Supply own artwork': 'own_artwork', 'Canva / AI design': 'canva_ai_design', 'Bespoke design': 'bespoke_design' };
    const includePrint = document.querySelector('#include-print').checked;
    const payload = { p_first_name: fields.get('first_name'), p_last_name: fields.get('last_name') || null, p_business_name: fields.get('business_name') || null, p_email: fields.get('email'), p_phone: fields.get('phone') || null, p_address: fields.get('address') || null, p_postcode: fields.get('postcode') || null, p_artwork_option: artworkMap[fields.get('artwork_label')], p_print_product: includePrint ? fields.get('print_product') : null, p_print_quantity: includePrint ? Number(fields.get('print_quantity')) : null, p_distribution_type: fields.get('distribution_type'), p_distribution_quantity: Number(fields.get('distribution_quantity')), p_delivery_area: fields.get('delivery_area'), p_delivery_postcodes: fields.get('delivery_postcodes') || null, p_preferred_start_date: fields.get('preferred_start_date') || null, p_preferred_end_date: fields.get('preferred_end_date') || null, p_notes: fields.get('notes') || null, p_terms_accepted: fields.get('terms_accepted') === 'on', p_website: fields.get('website') || null };
    try { const [result] = await api('submit_campaign', payload); form.innerHTML = `<div class="success-panel"><p class="eyebrow">REQUEST RECEIVED</p><h2>Thank you — your campaign request is in.</h2><p>Your reference is <strong>DC-${result.campaign_number}</strong> and the current guide price is <strong>${money(result.total)}</strong>.</p><p>We will review the delivery area and dates, then contact you before anything is confirmed or charged.</p><a class="button" href="index.html">Return to the home page</a></div>`; document.querySelector('.price-summary').hidden = true; window.scrollTo({ top: document.querySelector('#main').offsetTop, behavior: 'smooth' }); }
    catch (error) { message.className = 'form-message form-error'; message.textContent = error.message; button.disabled = false; button.textContent = 'Submit campaign request'; }
  });
})();
