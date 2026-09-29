(() => {
  const quantity = document.querySelector('#print-quantity');
  const sides = document.querySelector('#print-sides');
  if (!quantity || !sides) return;

  // booking.js determines the exact print product inside its print-option refresh.
  // When quantity was changed directly, that refresh was not being called, so
  // print_product stayed blank and fixed-price combinations could not checkout.
  quantity.addEventListener('change', () => {
    if (!quantity.value || !sides.value) return;
    sides.dispatchEvent(new Event('change', { bubbles: true }));
  });
})();
