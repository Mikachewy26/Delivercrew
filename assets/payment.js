(()=>{
 const title=document.querySelector('#payment-title'),status=document.querySelector('#payment-status'),retry=document.querySelector('#retry-payment-check');
 const session=new URLSearchParams(location.search).get('session_id');
 async function check(){
  retry.hidden=true;status.textContent='Checking your payment with Stripe…';
  if(!/^cs_(test|live)_[A-Za-z0-9]+$/.test(session||'')){title.textContent='No payment to check';status.textContent='Sign in to My orders to view your campaigns, or contact us for help.';return}
  try{
   const response=await fetch(`/api/payments/status?session_id=${encodeURIComponent(session)}`,{cache:'no-store'});const result=await response.json();
   if(!response.ok)throw new Error('We could not confirm the payment just now. Please check again or contact us before making another payment.');
   if(result.refund){title.textContent=result.refund==='refunded'?'Payment refunded':'Payment partly refunded';status.textContent=`Campaign DC-${result.campaign_number}. A refund is recorded for this order. Contact us if you need more details.`;return}
   if(result.paid){title.textContent=result.test?'Test payment confirmed':'Thank you — payment received';status.textContent=`Campaign DC-${result.campaign_number}. ${result.test?'This was a test; no real money was taken.':'We have received your payment.'} We will contact you to confirm your delivery schedule and any artwork requirements.`;try{sessionStorage.removeItem('delivercrew-checkout-attempt');sessionStorage.removeItem('delivercrew-checkout-draft')}catch{}}
   else{title.textContent='Payment not yet confirmed';status.textContent='Stripe has not confirmed a completed payment. Please check again shortly or contact us before paying again.';retry.hidden=false}
  }catch(error){title.textContent='Payment check unavailable';status.textContent=error.message;retry.hidden=false}
 }
 retry.addEventListener('click',check);check();
})();
