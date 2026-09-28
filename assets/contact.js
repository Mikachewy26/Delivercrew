(() => {
  const form = document.querySelector('#contact-form');
  const status = document.querySelector('#enquiry-status');
  const button = document.querySelector('#send-enquiry');
  let sending = false;
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (sending || !form.reportValidity()) return;
    const fields = new FormData(form);
    const payload = {};
    for (const name of ['first_name','last_name','email','phone','company_name','company_location','message','website']) payload[name] = String(fields.get(name) || '').trim();
    payload.consent = fields.get('consent') === 'on';
    if (payload.website) { status.textContent = 'Please leave the website field blank.'; return; }
    if (!payload.first_name || !payload.last_name || !payload.message) { status.textContent = 'Please enter your name and message.'; return; }
    sending = true;
    button.disabled = true;
    form.querySelectorAll('input, textarea').forEach(field => field.disabled = true);
    status.textContent = 'Sending your enquiry…';
    try {
      const response = await fetch('https://nbwbqosofzwnxhzpsicj.supabase.co/rest/v1/contact_enquiries', {
        method: 'POST',
        headers: {'Content-Type':'application/json', 'Prefer':'return=minimal', 'apikey':'sb_publishable_hXg97V6GpccCRV3zkuQvRQ_fT4UD4Wg'},
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(20000)
      });
      if (!response.ok) throw new Error('Submission failed');
      form.reset();
      status.textContent = 'Thank you. Your enquiry has been received by DeliverCrew.';
    } catch {
      status.textContent = 'We could not confirm your enquiry was received. Your message is still here. Please try again or email info@delivercrewdistribution.co.uk.';
    } finally {
      sending = false;
      button.disabled = false;
      form.querySelectorAll('input, textarea').forEach(field => field.disabled = false);
    }
  });
})();
