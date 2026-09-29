(() => {
  const form=document.querySelector('#campaign-form'),input=document.querySelector('#artwork-file'),label=document.querySelector('#artwork-upload-label'),status=document.querySelector('#artwork-file-status');
  if(!form||!input||!label||!status)return;
  const MAX=25*1024*1024,allowed=new Set(['pdf','jpg','jpeg','png','ai','eps']);
  const updateMode=()=>{const selected=form.querySelector('[name="artwork_label"]:checked')?.value||'Supply own artwork';label.textContent=selected==='Supply own artwork'?'Upload your artwork':'Upload existing files (optional)';};
  input.addEventListener('change',()=>{status.textContent='';const file=input.files?.[0];if(!file)return;const ext=(file.name.split('.').pop()||'').toLowerCase();if(file.size>MAX){input.value='';status.textContent='That file is larger than 25MB. Please choose a smaller file.';return}if(!allowed.has(ext)){input.value='';status.textContent='Please upload a PDF, JPG, PNG, AI or EPS file.';return}status.textContent=`Selected: ${file.name}. It will be securely attached to this campaign when you submit the order.`;});
  form.addEventListener('change',event=>{if(event.target?.name==='artwork_label')updateMode();});
  window.DeliverCrewArtwork={
    hasFile:()=>Boolean(input.files?.[0]),
    async upload(campaignId){const file=input.files?.[0];if(!file)return true;status.textContent='Uploading artwork securely…';const body=new FormData();body.append('campaign_id',campaignId);body.append('file',file,file.name);const response=await fetch('/api/artwork/upload',{method:'POST',body});const result=await response.json().catch(()=>null);if(!response.ok)throw new Error(result?.error||'Artwork could not be uploaded. Please try again.');status.textContent=`Artwork uploaded: ${file.name}`;return true;}
  };
  updateMode();
})();