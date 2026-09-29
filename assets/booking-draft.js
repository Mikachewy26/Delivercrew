(() => {
  const form=document.querySelector('#campaign-form');if(!form)return;
  const KEY='delivercrew_campaign_draft_v1';
  const save=()=>{try{const data={};for(const el of form.elements){if(!el.name||el.type==='file'||el.name==='website')continue;if(el.type==='checkbox'||el.type==='radio'){if(el.checked)data[el.name]=el.value||'on'}else data[el.name]=el.value}sessionStorage.setItem(KEY,JSON.stringify(data))}catch{}};
  const restore=()=>{let data;try{data=JSON.parse(sessionStorage.getItem(KEY)||'null')}catch{}if(!data)return;for(const [name,value] of Object.entries(data)){const els=form.querySelectorAll(`[name="${CSS.escape(name)}"]`);for(const el of els){if(el.type==='checkbox'||el.type==='radio')el.checked=el.value===value||value==='on';else el.value=value;el.dispatchEvent(new Event('change',{bubbles:true}))}}
  };
  form.addEventListener('input',save);form.addEventListener('change',save);window.addEventListener('pagehide',save);
  setTimeout(restore,900);
})();