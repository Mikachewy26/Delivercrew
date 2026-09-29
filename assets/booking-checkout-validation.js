(() => {
  const form = document.querySelector('#campaign-form');
  const payButton = document.querySelector('#continue-payment');
  const message = document.querySelector('#form-message');
  if (!form || !payButton || !message) return;

  const labelFor = field => {
    const label = field.closest('label');
    if (label) return label.childNodes[0]?.textContent?.trim() || 'required field';
    if (field.name === 'terms_accepted') return 'agreement checkbox';
    return field.name?.replaceAll('_', ' ') || 'required field';
  };

  const showMissing = () => {
    const invalid = [...form.querySelectorAll(':invalid')].filter(field => !field.disabled && field.type !== 'hidden');
    if (!invalid.length) return true;
    const first = invalid[0];
    const names = [...new Set(invalid.slice(0, 4).map(labelFor))];
    message.className = 'form-message form-error';
    message.textContent = `Please complete ${names.join(', ')} before continuing to payment.`;
    first.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => { try { first.focus({ preventScroll: true }); first.reportValidity(); } catch {} }, 350);
    return false;
  };

  payButton.addEventListener('click', event => {
    if (!showMissing()) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);

  form.addEventListener('input', () => {
    if (message.classList.contains('form-error') && form.checkValidity()) {
      message.className = 'form-message';
      message.textContent = '';
    }
  });
})();
