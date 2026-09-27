(() => {
  'use strict';
  const form = document.querySelector('#campaign-form');
  const host = document.querySelector('#area-map');
  if (!form || !host) return;
  const el = id => document.getElementById(id);
  const search = el('area-search'), status = el('area-status'), results = el('area-results');
  const postcodeField = form.elements.delivery_postcodes, areaField = form.elements.delivery_area;
  const selected = new Set(), markers = new Map();
  const fmt = n => n.toLocaleString('en-GB');
  const normal = s => s.toUpperCase().replace(/\s+/g, '');
  let rows = [], matches = [], limit = 20, map, manualPostcodes = '', generatedArea = '', queryTimer;
  if (window.L) {
    map = L.map(host, {scrollWheelZoom:false}).setView([50.94,-0.22],9);
    const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom:18, attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    tiles.on('tileerror', () => { status.textContent = 'The background map could not load. You can still select postcode sectors from the list.'; });
  } else {
    host.classList.add('area-map-fallback');
    host.textContent = 'The map is unavailable. Search and select your postcode sectors from the list below.';
  }
  function paintMarkers() {
    const visible = new Set(matches.map(r => r.sector));
    markers.forEach((marker,key) => {
      const chosen = selected.has(key);
      marker.setStyle({color:chosen?'#043a40':'#276676',fillColor:chosen?'#13c9c4':'#ffffff',fillOpacity:1,weight:chosen?3:2,radius:chosen?10:7});
      if (chosen || visible.has(key)) { if (!map.hasLayer(marker)) marker.addTo(map); }
      else if (map.hasLayer(marker)) map.removeLayer(marker);
      const node = marker.getElement();
      if (node) { node.setAttribute('aria-pressed',String(chosen)); node.setAttribute('aria-label',`${chosen?'Remove':'Add'} postcode sector ${key}`); }
    });
  }
  function quantityNote() {
    const total = rows.filter(r=>selected.has(r.sector)).reduce((n,r)=>n+r.households,0);
    const quantity = Number(form.elements.distribution_quantity.value);
    el('area-quantity-note').textContent = total && quantity && quantity < total
      ? `You have chosen ${fmt(quantity)} leaflets for areas with an estimated ${fmt(total)} households (2021). This is partial coverage; add any preferred streets in the notes below.` : '';
  }
  function syncSelection() {
    const chosen = rows.filter(r=>selected.has(r.sector));
    const codes = chosen.map(r=>r.sector).join(', ');
    if (chosen.length) {
      if (!postcodeField.readOnly) manualPostcodes = postcodeField.value;
      postcodeField.value = codes; postcodeField.readOnly = true;
      if (!areaField.value || areaField.value === generatedArea) {
        generatedArea = 'Postcode sectors: '+codes; areaField.value = generatedArea;
      }
    } else {
      if (postcodeField.readOnly) postcodeField.value = manualPostcodes;
      postcodeField.readOnly = false;
      if (areaField.value === generatedArea) areaField.value = '';
      generatedArea = '';
    }
    el('area-count').textContent = String(chosen.length);
    el('area-households').textContent = fmt(chosen.reduce((n,r)=>n+r.households,0));
    el('area-clear').disabled = !chosen.length;
    const chips = el('area-selected'); chips.replaceChildren();
    chosen.forEach(row=>{
      const button=document.createElement('button');button.type='button';button.className='area-chip';
      button.textContent=row.sector+' ×';button.setAttribute('aria-label','Remove '+row.sector);
      button.addEventListener('click',()=>toggle(row.sector));chips.append(button);
    });
    quantityNote(); paintMarkers();
  }
  function toggle(key) {
    if (selected.has(key)) selected.delete(key);
    else {
      if (selected.size >= 25) { status.textContent='You can select up to 25 sectors. For a larger campaign, include the extra areas in your notes.';return; }
      selected.add(key);
    }
    syncSelection(); render();
    status.textContent = `${selected.size} sector${selected.size===1?'':'s'} selected. Your selected postcodes are included in the form below.`;
  }
  function render() {
    results.replaceChildren();
    if (!matches.length) {
      const p=document.createElement('p');p.textContent='No matching sectors. Try a nearby Sussex postcode or enter your area in the fields below.';results.append(p);
    }
    matches.slice(0,limit).forEach(row=>{
      const label=document.createElement('label');label.className='area-result';
      const check=document.createElement('input');check.type='checkbox';check.checked=selected.has(row.sector);check.setAttribute('aria-label','Select '+row.sector);
      check.addEventListener('change',()=>{toggle(row.sector);const replacement=[...results.querySelectorAll('input')].find(e=>e.getAttribute('aria-label')==='Select '+row.sector);replacement?.focus({preventScroll:true});});
      const info=document.createElement('span'),title=document.createElement('strong'),detail=document.createElement('small'),place=document.createElement('small');
      title.textContent=row.sector;detail.textContent=fmt(row.households)+' households (2021)';place.textContent=row.place;
      info.append(title,detail,place);label.append(check,info);results.append(label);
    });
    el('area-more').hidden=matches.length<=limit;
  }
  function runSearch(focus=false) {
    clearTimeout(queryTimer);
    const raw=search.value.trim();
    let term=normal(raw), exactSector=/^[A-Z]{1,2}\d[A-Z\d]?\s+\d$/i.test(raw);
    if (/^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/.test(term)) { term=term.slice(0,-2); exactSector=true; }
    const exactDistrict=!exactSector && rows.some(r=>r.sector.split(' ')[0]===term);
    matches=rows.filter(r=>exactSector ? normal(r.sector)===term : exactDistrict ? r.sector.split(' ')[0]===term : normal(r.sector).startsWith(term)||normal(r.place).includes(term));limit=20;
    status.textContent=`${matches.length} matching sectors. Tap a marker or choose from the list.`;
    render();paintMarkers();
    if (map && focus) {
      const points=matches.filter(r=>r.lat!=null&&r.lng!=null).map(r=>[r.lat,r.lng]);
      if(points.length) map.fitBounds(points,{padding:[35,35],maxZoom:13});
    }
  }
  search.addEventListener('input',()=>{clearTimeout(queryTimer);queryTimer=setTimeout(()=>runSearch(true),180);});
  search.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();runSearch(true);}});
  el('area-search-button').addEventListener('click',()=>runSearch(true));
  el('area-more').addEventListener('click',()=>{limit+=20;render();});
  el('area-clear').addEventListener('click',()=>{selected.clear();syncSelection();render();status.textContent='Selection cleared. You can search again or enter postcodes manually.';});
  form.elements.distribution_quantity.addEventListener('change',quantityNote);
  fetch('data/map-sectors.json').then(r=>{if(!r.ok)throw Error('Area data unavailable');return r.json();}).then(data=>{
    rows=data.sectors;matches=rows;
    rows.forEach(row=>{
      if(!map||row.lat==null||row.lng==null)return;
      const marker=L.circleMarker([row.lat,row.lng]).addTo(map);
      const tip=document.createElement('span');tip.textContent=`${row.sector} · ${fmt(row.households)} households (2021)`;
      marker.bindTooltip(tip).on('click',()=>toggle(row.sector));
      marker.on('add',()=>{
        const node=marker.getElement();if(node){node.setAttribute('tabindex','0');node.setAttribute('role','button');node.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();toggle(row.sector);}};}
      });
      // The first add precedes the event handler, so apply keyboard support now too.
      const node=marker.getElement();if(node){node.setAttribute('tabindex','0');node.setAttribute('role','button');node.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();toggle(row.sector);}};}
      markers.set(row.sector,marker);
    });
    runSearch();
  }).catch(()=>{status.textContent='Area data could not load. Please enter your target area and postcodes in the fields below.';});
})();
