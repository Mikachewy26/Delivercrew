(() => {
  const form=document.querySelector('#campaign-form');
  const input=document.querySelector('#artwork-file');
  const label=document.querySelector('#artwork-upload-label');
  const status=document.querySelector('#artwork-file-status');
  if(!form||!input||!label||!status)return;
  const MAX=25*1024*1024;
  const allowed=new Set(['application/pdf','image/jpeg','image/png','application/postscript','application/illustrator']);
  const updateMode=()=>{
    const selected=form.querySelector('[name="artwork_label"]:checked')?.value||'Supply own artwork';
    label.textContent=selected==='Supply own artwork'?'Upload your artwork':'Upload existing files (optional)';
  };
  input.addEventListener('change',()=>{
    status.textContent='';
    const file=input.files?.[0];
    if(!file)return;
    const ext=file.name.split('.').pop()?.toLowerCase();
    if(file.size>MAX){input.value='';status.textContent='That file is larger than 25MB. Please choose a smaller file.';return;}
    if(!allowed.has(file.type)&&!['pdf','jpg','jpeg','png','ai','eps'].includes(ext)){input.value='';status.textContent='Please upload a PDF, JPG, PNG, AI or EPS file.';return;}
    status.textContent=`Selected: ${file.name}. This file will be linked to your campaign when the secure upload service is enabled.`;
  });
  form.addEventListener('change',event=>{if(event.target?.name==='artwork_label')updateMode();});
  updateMode();
})();