(() => {
  const input=document.querySelector('#discount-code'),button=document.querySelector('#apply-discount'),message=document.querySelector('#discount-message'),row=document.querySelector('#discount-row'),discountTotal=document.querySelector('#discount-total'),total=document.querySelector('#campaign-total');
  if(!input||!button||!total)return;
  let applied=false,base=0,updating=false;
  const money=v=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}).format(v);
  const readTotal=()=>Number(String(total.textContent).replace(/[^0-9.]/g,''))||0;
  const render=()=>{if(updating)return;updating=true;if(!applied){base=readTotal();row.hidden=true}else{const current=readTotal();if(Math.abs(current-base*.9)>0.02)base=current;const discount=base*.1;row.hidden=false;discountTotal.textContent=`−${money(discount)}`;total.textContent=money(base-discount)}updating=false};
  button.addEventListener('click',()=>{const code=input.value.trim().toUpperCase();if(code==='WELCOME10'){applied=true;base=readTotal();input.value='WELCOME10';input.readOnly=true;button.textContent='Applied';button.disabled=true;message.textContent='WELCOME10 applied — 10% off your order.';render()}else{message.textContent='That discount code is not valid.'}});
  input.addEventListener('input',()=>{message.textContent=''});
  new MutationObserver(()=>render()).observe(total,{childList:true,characterData:true,subtree:true});
  const originalFetch=window.fetch.bind(window);
  window.fetch=(resource,options={})=>{const url=typeof resource==='string'?resource:resource?.url||'';if(applied&&url==='/api/payments/checkout'&&options?.body){try{const body=JSON.parse(options.body);body.discount_code='WELCOME10';options={...options,body:JSON.stringify(body)}}catch{}}return originalFetch(resource,options)};
})();