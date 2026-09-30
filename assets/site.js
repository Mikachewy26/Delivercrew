function renderContent(el,value){
  if(el.dataset.format!=='blocks'){el.textContent=value;return}
  el.replaceChildren();let list=null;
  for(const line of value.split('\n')){
    const part=line.trim();
    if(!part){list=null;continue}
    if(part.startsWith('* ')){if(!list){list=document.createElement('ul');el.append(list)}const item=document.createElement('li');item.textContent=part.slice(2);list.append(item);continue
    }
    list=null;const tag=/^(What We Can Help With|Website & Digital|Marketing & Campaign Support|Design\. Produce\. Deliver\.|One Brand\. One Team\. One Simple Process\.)$/i.test(part)?'h3':'p';const node=document.createElement(tag);node.textContent=part;el.append(node)
  }
}
function addLegalFooterLinks(){
  for(const footer of document.querySelectorAll('.footer .wrap')){
    if(footer.querySelector('.legal-links'))continue;
    const links=document.createElement('nav');links.className='legal-links';links.setAttribute('aria-label','Legal');
    links.innerHTML='<a href="privacy.html">Privacy Policy</a><a href="cookies.html">Cookie Policy</a><a href="terms.html">Terms &amp; Conditions</a>';
    const back=footer.querySelector('a[href="#main"]');if(back)footer.insertBefore(links,back);else footer.append(links);
  }
}
function captureAdditionalServiceRequests(){
  const form=document.querySelector('#campaign-form');if(!form)return;
  form.addEventListener('submit',()=>{
    const selected=[...form.querySelectorAll('input[name="additional_services"]:checked')].map(x=>x.value);
    const details=form.elements.additional_services_details?.value?.trim();
    if(!selected.length&&!details)return;
    const notes=form.elements.notes;if(!notes)return;
    const block=['Additional services quote requested:',selected.length?selected.join(', '):'Other',details?`Details: ${details}`:''].filter(Boolean).join('\n');
    const current=notes.value.trim();
    if(!current.includes('Additional services quote requested:'))notes.value=[current,block].filter(Boolean).join('\n\n');
  },true);
}
addLegalFooterLinks();
captureAdditionalServiceRequests();
(async()=>{try{const response=await fetch('https://nbwbqosofzwnxhzpsicj.supabase.co/rest/v1/site_content?id=eq.main&select=content',{cache:'no-store',headers:{apikey:'sb_publishable_hXg97V6GpccCRV3zkuQvRQ_fT4UD4Wg'}});if(!response.ok)throw Error('Site content unavailable');const rows=await response.json();const data=rows?.[0]?.content;if(!data)throw Error('Site content unavailable');for(const el of document.querySelectorAll('[data-content]')){const [page,key]=el.dataset.content.split('.');const value=data?.[page]?.[key];if(typeof value==='string')renderContent(el,value)}const email=data?.shared?.email?.trim(),phone=data?.shared?.phone?.trim(),contact=document.querySelector('#contact-links'),status=document.querySelector('#contact-status');if(contact&&(email||phone)){if(status)status.hidden=true;contact.hidden=false;if(email){const a=document.createElement('a');a.href='mailto:'+email;a.textContent=email;contact.append(a)}if(phone){const a=document.createElement('a');a.href='tel:'+phone.replace(/[^+\d]/g,'');a.textContent=phone;contact.append(a)}}}catch(e){/* Embedded copy remains available for local preview. */}})();
