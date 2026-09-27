const PROJECT_URL = 'https://nbwbqosofzwnxhzpsicj.supabase.co';
const PUBLISHABLE_KEY = 'sb_publishable_hXg97V6GpccCRV3zkuQvRQ_fT4UD4Wg';
const client = window.supabase.createClient(PROJECT_URL, PUBLISHABLE_KEY);
const $ = selector => document.querySelector(selector);
const sectionNames = {
  home: 'Home page introduction', index_extras: 'Home page sections',
  distribution: 'Leaflet distribution', distribution_extras: 'Distribution page sections',
  print: 'Design and print', print_extras: 'Design and print sections',
  branding: 'Branding and signage', branding_extras: 'Branding page sections',
  websites: 'Websites and marketing', websites_extras: 'Websites page sections',
  gps: 'GPS tracking', gps_extras: 'GPS page sections',
  shared: 'Contact details and footer', pricing: 'Prices shown on the website'
};
let content = null;
let savedVersion = null;
let recoveryInProgress = false;
let editVersion = 0;
let savedEditVersion = 0;
let saving = false;

function hasUnsavedChanges() { return editVersion !== savedEditVersion; }
$('#content-form').addEventListener('input', () => {
  editVersion += 1;
  status(saving ? 'Saving earlier changes… Your latest edits still need saving.' : 'You have unsaved changes.');
});
window.addEventListener('beforeunload', event => {
  if (!hasUnsavedChanges()) return;
  event.preventDefault();
  event.returnValue = '';
});

function status(message) { $('#editor-status').textContent = message; }
function panel(name) {
  for (const id of ['login-panel', 'reset-panel', 'new-password-panel', 'editor-panel']) {
    $(`#${id}`).classList.toggle('hidden', id !== name);
  }
}
function plainLabel(key) { return key.replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase()); }

async function isAdmin() {
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) return false;
  const result = await client.from('admin_users').select('user_id').eq('user_id', user.id).maybeSingle();
  return !result.error && Boolean(result.data);
}

async function showEditor() {
  if (recoveryInProgress) return;
  if (!(await isAdmin())) { panel('login-panel'); return; }
  const { data, error } = await client.from('site_content').select('content,updated_at').eq('id', 'main').single();
  if (error || !data || !data.content) {
    panel('login-panel');
    status('Website text could not be loaded. Please refresh the page.');
    return;
  }
  content = data.content;
  savedVersion = data.updated_at;
  editVersion = savedEditVersion = 0;
  renderFields();
  panel('editor-panel');
  $('#saved-at').textContent = `Last saved ${new Date(savedVersion).toLocaleString('en-GB')}`;
  status('');
}

function renderFields() {
  const sections = $('#sections');
  sections.replaceChildren();
  for (const [name, title] of Object.entries(sectionNames)) {
    const values = content[name];
    if (!values || typeof values !== 'object') continue;
    const details = document.createElement('details');
    details.className = 'editor-card editor-section';
    details.open = name === 'home' || name === 'shared';
    const summary = document.createElement('summary');
    summary.textContent = title;
    if (name === 'pricing') {
      const note = document.createElement('small');
      note.textContent = 'These are the prices printed on the website. Update matching booking prices in the business dashboard too.';
      summary.append(note);
    }
    details.append(summary);
    for (const [key, value] of Object.entries(values)) {
      if (typeof value !== 'string') continue;
      const label = document.createElement('label');
      label.textContent = plainLabel(key);
      const keyHint = document.createElement('span');
      keyHint.className = 'field-key';
      keyHint.textContent = ` · ${name}.${key}`;
      label.append(keyHint);
      const input = value.length > 100 || value.includes('\n') ? document.createElement('textarea') : document.createElement('input');
      if (input.tagName === 'INPUT') input.type = 'text';
      input.value = value;
      input.dataset.section = name;
      input.dataset.key = key;
      input.setAttribute('aria-label', `${title}: ${plainLabel(key)}`);
      label.append(input);
      details.append(label);
    }
    sections.append(details);
  }
}

$('#login-form').addEventListener('submit', async event => {
  event.preventDefault();
  const button = event.currentTarget.querySelector('button');
  button.disabled = true;
  status('Signing in…');
  const { error } = await client.auth.signInWithPassword({ email: $('#email').value, password: $('#password').value });
  button.disabled = false;
  $('#password').value = '';
  if (error) { status('Sign in failed. Check your email and password.'); return; }
  if (!(await isAdmin())) {
    await client.auth.signOut();
    status('This account is not authorised to edit the DeliverCrew website.');
    return;
  }
  await showEditor();
});

$('#signout').addEventListener('click', async () => {
  if (saving) { status('Please wait for the save to finish before signing out.'); return; }
  if (hasUnsavedChanges() && !window.confirm('Discard your unsaved website changes and sign out?')) return;
  const { error } = await client.auth.signOut();
  if (error) { status('Sign out failed. Please try again.'); return; }
  content = null;
  savedVersion = null;
  editVersion = savedEditVersion = 0;
  $('#sections').replaceChildren();
  panel('login-panel');
  status('Signed out.');
});

$('#show-reset').addEventListener('click', () => {
  $('#reset-email').value = $('#email').value;
  panel('reset-panel');
  status('');
});
$('#back-to-login').addEventListener('click', () => { panel('login-panel'); status(''); });

$('#reset-form').addEventListener('submit', async event => {
  event.preventDefault();
  const button = event.currentTarget.querySelector('button');
  button.disabled = true;
  status('Requesting reset email…');
  const { error } = await client.auth.resetPasswordForEmail($('#reset-email').value, {
    redirectTo: `${window.location.origin}/admin/`
  });
  button.disabled = false;
  status(error ? `Reset email could not be sent: ${error.message}` : 'If the email matches an account, a password reset link will arrive shortly. Check your spam folder too.');
});

client.auth.onAuthStateChange(event => {
  if (event === 'PASSWORD_RECOVERY') {
    recoveryInProgress = true;
    panel('new-password-panel');
    status('Enter a new password of at least 12 characters.');
  }
});

$('#new-password-form').addEventListener('submit', async event => {
  event.preventDefault();
  const button = event.currentTarget.querySelector('button');
  button.disabled = true;
  const { error } = await client.auth.updateUser({ password: $('#new-password').value });
  button.disabled = false;
  $('#new-password').value = '';
  if (error) { status(`Password could not be changed: ${error.message}`); return; }
  recoveryInProgress = false;
  status('Password updated. You can now use it for the website editor and business dashboard.');
  await showEditor();
});

$('#content-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (!content || !savedVersion || saving) return;
  const submittedVersion = editVersion;
  const draft = JSON.parse(JSON.stringify(content));
  for (const input of $('#sections').querySelectorAll('[data-section][data-key]')) {
    draft[input.dataset.section][input.dataset.key] = input.value;
  }
  const button = $('#save-content');
  saving = true;
  button.disabled = true;
  status('Saving changes…');
  try {
  const { data, error } = await client.from('site_content')
    .update({ content: draft, updated_at: new Date().toISOString() })
    .eq('id', 'main').eq('updated_at', savedVersion)
    .select('updated_at').maybeSingle();
  if (error || !data) {
    status('Changes were not saved. If another editor changed the page, refresh and try again.');
    return;
  }
  content = draft;
  savedVersion = data.updated_at;
  savedEditVersion = submittedVersion;
  $('#saved-at').textContent = `Last saved ${new Date(savedVersion).toLocaleString('en-GB')}`;
  status(hasUnsavedChanges() ? 'Earlier changes saved. Your latest edits are not saved yet; select Save changes again.' : 'Saved. Your website text is live.');
  } catch (error) {
    status('The save could not be confirmed. Your edits are still here. Check your connection and try again.');
  } finally {
    saving = false;
    button.disabled = false;
  }
});

showEditor();
