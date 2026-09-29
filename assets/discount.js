(() => {
  const input=document.querySelector('#discount-code'),button=document.querySelector('#apply-discount'),message=document.querySelector('#discount-message'),row=document.querySelector('#discount-row'),discountTotal=document.querySelector('#discount-total'),total=document.querySelector('#campaign-total');
  if(!input||!button||!total)return;
  let applied=false,base=0;
  const money=v=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}).format(Number(v||0));
  const readTotal=()=>Number(String(total.textContent).replace(/[^0-9.]/g,''))||0;
  const showDiscount=()=>{if(!applied)return;const discount=Math.round(base*10)/100;row.hidden=false;discountTotal.textContent=`−${money(discount)}`;total.textContent=money(base-discount)};
  button.addEventListener('click',()=>{const code=input.value.trim().toUpperCase();if(code!=='WELCOME10'){message.textContent='That discount code is not valid.';return}base=readTotal();applied=true;input.value='WELCOME10';input.readOnly=true;button.textContent='Applied';button.disabled=true;message.textContent='WELCOME10 applied — 10% off your order.';showDiscount()});
  input.addEventListener('input',()=>{message.textContent=''});
  document.querySelector('#campaign-form')?.addEventListener('change',()=>{if(!applied)return;requestAnimationFrame(()=>{const shown=readTotal(),expected=base*.9;if(Math.abs(shown-expected)>0.02){base=shown;showDiscount()}})});
  const originalFetch=window.fetch.bind(window);
  window.fetch=(resource,options={})=>{const url=typeof resource==='string'?resource:resource?.url||'';if(applied&&url==='/api/payments/checkout'&&options?.body){try{const body=JSON.parse(options.body);body.discount_code='WELCOME10';options={...options,body:JSON.stringify(body)}}catch{}}return originalFetch(resource,options)};
})();