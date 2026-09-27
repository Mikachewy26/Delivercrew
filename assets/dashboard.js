const SB_URL = 'https://nbwbqosofzwnxhzpsicj.supabase.co';
const SB_KEY = 'sb_publishable_hXg97V6GpccCRV3zkuQvRQ_fT4UD4Wg';
const sb = window.supabase.createClient(SB_URL, SB_KEY);
const $ = selector => document.querySelector(selector);
const money = value => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(Number(value || 0));
const statuses = ['new_enquiry', 'awaiting_artwork', 'design', 'awaiting_payment', 'print', 'scheduled', 'distribution_in_progress', 'completed', 'cancelled'];
let campaigns = [];

function esc(value) {
  return String(value ?? '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
}

function label(value) {
  return String(value || '—').replaceAll('_', ' ');
}

async function authorised() {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return false;
  const { data, error } = await sb.from('admin_users').select('user_id').eq('user_id', user.id).maybeSingle();
  return !error && Boolean(data);
}

async function show() {
  if (await authorised()) {
    $('#login').classList.add('hidden');
    $('#app').classList.remove('hidden');
    await loadAll();
  } else {
    $('#app').classList.add('hidden');
    $('#login').classList.remove('hidden');
  }
}

$('#login-form').addEventListener('submit', async event => {
  event.preventDefault();
  $('#login-status').textContent = 'Signing in…';
  const { error } = await sb.auth.signInWithPassword({ email: $('#email').value, password: $('#password').value });
  if (error) {
    $('#login-status').textContent = 'Sign-in failed. Check your email and password.';
    return;
  }
  if (!(await authorised())) {
    await sb.auth.signOut();
    $('#login-status').textContent = 'This account is not authorised for the DeliverCrew dashboard.';
    return;
  }
  $('#login-status').textContent = '';
  await show();
});

$('#signout').addEventListener('click', async () => {
  await sb.auth.signOut();
  await show();
});

document.querySelectorAll('[data-tab]').forEach(button => {
  button.addEventListener('click', () => {
    document.querySelectorAll('[data-tab]').forEach(item => item.classList.remove('active'));
    button.classList.add('active');
    document.querySelectorAll('.tab').forEach(item => item.classList.add('hidden'));
    $(`#${button.dataset.tab}`).classList.remove('hidden');
  });
});

async function loadAll() {
  $('#dash-status').textContent = 'Loading…';
  const [campaignResult, customerResult, priceResult] = await Promise.all([
    sb.from('campaigns').select('*,customers(*)').order('created_at', { ascending: false }),
    sb.from('customers').select('*').order('created_at', { ascending: false }),
    sb.from('pricing').select('*').order('category').order('product').order('sort_order')
  ]);
  if (campaignResult.error || customerResult.error || priceResult.error) {
    $('#dash-status').textContent = 'Unable to load dashboard data.';
    return;
  }
  campaigns = campaignResult.data || [];
  renderCampaigns(campaigns);
  renderCustomers(customerResult.data || []);
  renderPrices(priceResult.data || []);
  $('#dash-status').textContent = '';
}

function renderCampaigns(rows) {
  $('#s-total').textContent = rows.length;
  $('#s-new').textContent = rows.filter(item => item.status === 'new_enquiry').length;
  $('#s-progress').textContent = rows.filter(item => !['new_enquiry', 'completed', 'cancelled'].includes(item.status)).length;
  $('#s-complete').textContent = rows.filter(item => item.status === 'completed').length;
  $('#campaign-rows').innerHTML = rows.length ? rows.map(item => `<tr>
    <td><b>DC-${esc(item.campaign_number)}</b></td>
    <td>${new Date(item.created_at).toLocaleDateString('en-GB')}</td>
    <td>${esc([item.customers?.first_name, item.customers?.last_name].filter(Boolean).join(' '))}<br><small>${esc(item.customers?.business_name || item.customers?.email || '')}</small></td>
    <td>${esc(item.print_product || 'No print')} ${item.print_quantity ? `<br>${Number(item.print_quantity).toLocaleString('en-GB')}` : ''}<br><small>${esc(label(item.distribution_type))}</small></td>
    <td>${money(item.total)}</td>
    <td>${esc(label(item.payment_status))}</td>
    <td><select class="status-select" data-status="${item.id}">${statuses.map(status => `<option value="${status}" ${status === item.status ? 'selected' : ''}>${esc(label(status))}</option>`).join('')}</select></td>
    <td><button class="button outline" type="button" data-view="${item.id}">View</button></td>
  </tr>`).join('') : '<tr><td colspan="8">No campaign requests yet.</td></tr>';

  document.querySelectorAll('[data-status]').forEach(select => {
    select.addEventListener('change', async () => {
      select.disabled = true;
      const { error } = await sb.from('campaigns').update({ status: select.value }).eq('id', select.dataset.status);
      select.disabled = false;
      $('#dash-status').textContent = error ? 'Status could not be updated.' : 'Campaign status updated.';
      if (!error) campaigns.find(item => String(item.id) === select.dataset.status).status = select.value;
    });
  });
  document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => renderCampaignDetail(button.dataset.view)));
}

function renderCampaignDetail(id) {
  const item = campaigns.find(campaign => String(campaign.id) === id);
  if (!item) return;
  const customer = item.customers || {};
  const panel = $('#campaign-detail');
  panel.classList.remove('hidden');
  panel.innerHTML = `<div class="dashbar"><h3>Campaign DC-${esc(item.campaign_number)}</h3><button class="button outline" type="button" id="close-detail">Close</button></div>
    <p><strong>Customer:</strong> ${esc([customer.first_name, customer.last_name].filter(Boolean).join(' ') || '—')} · ${esc(customer.business_name || 'No business name')}</p>
    <p><strong>Contact:</strong> ${esc(customer.email || '—')} · ${esc(customer.phone || '—')}</p>
    <p><strong>Address:</strong> ${esc(customer.address || '—')} · ${esc(customer.postcode || '—')}</p>
    <p><strong>Campaign:</strong> ${esc(item.artwork_option || '—')} · ${esc(item.print_product || 'No print')} ${item.print_quantity ? `(${Number(item.print_quantity).toLocaleString('en-GB')})` : ''} · ${esc(label(item.distribution_type))} ${item.distribution_quantity ? `(${Number(item.distribution_quantity).toLocaleString('en-GB')})` : ''}</p>
    <p><strong>Delivery:</strong> ${esc(item.delivery_area || '—')} · ${esc(item.delivery_postcodes || 'No postcodes supplied')} · ${esc(item.preferred_start_date || 'No start date')} to ${esc(item.preferred_end_date || 'No end date')}</p>
    <p><strong>Customer notes:</strong> ${esc(item.notes || 'None')}</p>
    <p><strong>Guide total:</strong> ${money(item.total)}</p>
    <label>Internal notes<textarea id="internal-notes" rows="4">${esc(item.internal_notes || '')}</textarea></label>
    <label>GPS report link<input id="gps-report-url" type="url" value="${esc(item.gps_report_url || '')}" placeholder="https://…"></label>
    <label>Completion report link<input id="completion-report-url" type="url" value="${esc(item.completion_report_url || '')}" placeholder="https://…"></label>
    <button class="button" type="button" id="save-detail">Save campaign details</button>`;
  $('#close-detail').addEventListener('click', () => panel.classList.add('hidden'));
  $('#save-detail').addEventListener('click', async event => {
    const button = event.currentTarget;
    button.disabled = true;
    const updates = {
      internal_notes: $('#internal-notes').value || null,
      gps_report_url: $('#gps-report-url').value || null,
      completion_report_url: $('#completion-report-url').value || null
    };
    const { error } = await sb.from('campaigns').update(updates).eq('id', item.id);
    button.disabled = false;
    $('#dash-status').textContent = error ? 'Campaign details could not be saved.' : 'Campaign details saved.';
    if (!error) Object.assign(item, updates);
  });
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderCustomers(rows) {
  $('#customer-rows').innerHTML = rows.length ? rows.map(item => `<tr><td>${esc(`${item.first_name} ${item.last_name || ''}`)}</td><td>${esc(item.business_name || '—')}</td><td>${esc(item.email)}</td><td>${esc(item.phone || '—')}</td><td>${esc(item.postcode || '—')}</td></tr>`).join('') : '<tr><td colspan="5">No customers yet.</td></tr>';
}

function renderPrices(rows) {
  $('#pricing-rows').innerHTML = rows.map(item => `<tr>
    <td>${esc(item.category)}</td><td>${esc(item.product)}</td><td>${esc(item.option_name)}</td>
    <td>${item.quantity ? Number(item.quantity).toLocaleString('en-GB') : '—'}</td>
    <td><input class="price-input" type="number" min="0" step="0.01" data-price="${item.id}" value="${item.price ?? ''}" placeholder="Not set"></td>
    <td><input type="checkbox" data-active="${item.id}" ${item.active ? 'checked' : ''} aria-label="Active"></td>
    <td><button class="button" type="button" data-save="${item.id}">Save</button></td>
  </tr>`).join('');
  document.querySelectorAll('[data-save]').forEach(button => {
    button.addEventListener('click', async () => {
      const input = document.querySelector(`[data-price="${button.dataset.save}"]`);
      const active = document.querySelector(`[data-active="${button.dataset.save}"]`);
      const price = input.value === '' ? null : Number(input.value);
      if (price !== null && (!Number.isFinite(price) || price < 0)) {
        $('#dash-status').textContent = 'Enter a valid price of zero or more.';
        return;
      }
      button.disabled = true;
      const { error } = await sb.from('pricing').update({ price, active: active.checked, updated_at: new Date().toISOString() }).eq('id', button.dataset.save);
      button.disabled = false;
      $('#dash-status').textContent = error ? 'Pricing could not be saved.' : 'Pricing saved and the booking calculator will use the change.';
    });
  });
}

show();
