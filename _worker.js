const DB_URL = 'https://nbwbqosofzwnxhzpsicj.supabase.co';
const ORIGINS = new Set(['https://delivercrewdistribution.co.uk', 'https://www.delivercrewdistribution.co.uk', 'https://delivercrew.pages.dev']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SESSION = /^cs_(test|live)_[A-Za-z0-9]+$/;
const JSON_HEADERS = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' };
class PublicError extends Error { constructor(message, status=400, code='invalid_request') { super(message); this.status=status; this.code=code; } }
const json = (body, status=200) => new Response(JSON.stringify(body), {status, headers:JSON_HEADERS});
const dbKey = env => env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
const configured = env => Boolean(env.STRIPE_SECRET_KEY && dbKey(env) && env.STRIPE_WEBHOOK_SECRET);
const enabled = env => configured(env) && env.PAYMENTS_ENABLED === 'true';
const keyMode = env => /^(?:sk|rk)_live_/.test(env.STRIPE_SECRET_KEY || '');
function requireSetup(env) { if (!configured(env)) throw new PublicError('Online payment is not available yet. Please request a quote instead.',503,'not_configured'); }
function trustedRequest(request) {
  const url=new URL(request.url);
  if(!ORIGINS.has(url.origin) || request.headers.get('Origin')!==url.origin) throw new PublicError('Please open checkout from the DeliverCrew website.',403);
  if(!request.headers.get('Content-Type')?.startsWith('application/json')) throw new PublicError('Expected a JSON request.',415);
}
async function readBody(request,max) {
  if(Number(request.headers.get('Content-Length'))>max) throw new PublicError('Request too large.',413);
  const reader=request.body?.getReader();if(!reader) return '';
  let size=0;const chunks=[];
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>max){await reader.cancel();throw new PublicError('Request too large.',413)}chunks.push(value)}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}return new TextDecoder().decode(bytes);
}
async function db(env,path,{method='GET',body,prefer}={}) {
  const key=dbKey(env);if(!key)throw new PublicError('Online payment is not available yet.',503,'not_configured');
  const headers={apikey:key,'Content-Type':'application/json'};
  if(key.startsWith('eyJ'))headers.Authorization=`Bearer ${key}`;
  if(prefer)headers.Prefer=prefer;
  const response=await fetch(`${DB_URL}/rest/v1/${path}`,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
  const result=await response.json().catch(()=>null);
  if(!response.ok){
    const safe=new Set(['Complete required fields','Checkout details changed','Please choose an artwork option','Please choose a distribution type and quantity','That print option is not currently available','That distribution option is not currently available','Please wait before submitting another request','The preferred start date cannot be in the past','Please enter a valid email address','Please enter a valid first name']);
    if(safe.has(result?.message))throw new PublicError(result.message,400);
    throw new PublicError('We could not update your order. Please try again or contact DeliverCrew.',502,'database_unavailable');
  }
  return result;
}
async function stripe(env,path,{method='GET',body,idempotencyKey}={}) {
  const headers={Authorization:`Bearer ${env.STRIPE_SECRET_KEY}`};
  if(body)headers['Content-Type']='application/x-www-form-urlencoded';
  if(idempotencyKey)headers['Idempotency-Key']=idempotencyKey;
  const response=await fetch(`https://api.stripe.com/v1/${path}`,{method,headers,body:body?.toString()});
  const result=await response.json().catch(()=>null);
  if(!response.ok)throw new PublicError('We could not connect to secure payment. Please try again or request a quote.',502,'payment_unavailable');
  return result;
}
const pence = value => {const result=Math.round(Number(value)*100);if(!Number.isSafeInteger(result)||result<50)throw new PublicError('This order needs a quote before payment.',400);return result};
async function orderForSession(env,session){
  if(!session || !SESSION.test(session.id) || session.mode!=='payment' || session.currency!=='gbp' || session.metadata?.application!=='delivercrew' || !UUID.test(session.metadata?.campaign_id||'') || session.livemode!==keyMode(env)) throw new PublicError('Payment could not be matched to an order.',400);
  const [order]=await db(env,`campaigns?id=eq.${session.metadata.campaign_id}&select=id,campaign_number,total,payment_status,stripe_session_id,status`);
  if(!order||order.stripe_session_id!==session.id||session.client_reference_id!==order.id||session.amount_total!==pence(order.total))throw new PublicError('Payment could not be matched to an order.',409);
  return order;
}
async function fulfill(env,session){
  const order=await orderForSession(env,session);
  if(session.payment_status!=='paid'||session.status!=='complete')return {paid:false,campaign_number:order.campaign_number};
  // Only transition an unpaid record. Delayed or duplicate events must not undo refunds.
  if(order.payment_status==='unpaid'){
    const update={payment_status:'paid',stripe_payment_intent:typeof session.payment_intent==='string'?session.payment_intent:null};
    if(order.status==='awaiting_payment')update.status='awaiting_artwork';
    const updated=await db(env,`campaigns?id=eq.${order.id}&stripe_session_id=eq.${session.id}&payment_status=eq.unpaid&total=eq.${Number(order.total)}${order.status==='awaiting_payment'?'&status=eq.awaiting_payment':''}`,{method:'PATCH',body:update,prefer:'return=representation'});
    if(!updated?.length){const current=await orderForSession(env,session);if(current.payment_status==='unpaid')throw new PublicError('Payment received by Stripe; order confirmation is still being updated. Please check again.',503,'confirmation_pending')}
  }
  return {paid:true,campaign_number:order.campaign_number,test:!session.livemode,refund:order.payment_status==='refunded'||order.payment_status==='part_refunded'?order.payment_status:null};
}
export async function verifySignature(raw,header,secret,now=Math.floor(Date.now()/1000)){
  if(!header||!secret)return false;
  const parts=header.split(',').map(x=>x.split('='));const timestamp=parts.find(x=>x[0]==='t')?.[1];
  if(!/^\d+$/.test(timestamp||'')||Math.abs(now-Number(timestamp))>300)return false;
  const signatures=parts.filter(x=>x[0]==='v1'&&/^[a-f0-9]{64}$/i.test(x[1])).map(x=>x[1]);
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);
  for(const signature of signatures){const bytes=Uint8Array.from(signature.match(/../g),x=>parseInt(x,16));if(await crypto.subtle.verify('HMAC',key,bytes,new TextEncoder().encode(`${timestamp}.${raw}`)))return true}
  return false;
}
async function checkout(request,env){
  trustedRequest(request);requireSetup(env);if(!enabled(env))throw new PublicError('Online payment is not available yet. Please request a quote instead.',503,'not_enabled');
  let input;try{input=JSON.parse(await readBody(request,16000))}catch(error){if(error instanceof PublicError)throw error;throw new PublicError('Invalid checkout request.')}
  if(!UUID.test(input.request_id||'')||!input.payload||typeof input.payload!=='object'||Array.isArray(input.payload))throw new PublicError('Invalid checkout request.');
  // Supabase validates the choices and calculates the price from its current price list.
  const [order]=await db(env,'rpc/prepare_campaign_checkout',{method:'POST',body:{p_request_id:input.request_id,p_payload:input.payload}});
  if(!order||!UUID.test(order.id))throw new PublicError('Order could not be prepared.',502);
  if(order.stripe_session_id){
    if(!SESSION.test(order.stripe_session_id))throw new PublicError('Payment session could not be found.',502);
    const existing=await stripe(env,`checkout/sessions/${order.stripe_session_id}`);
    if(existing.status==='complete'){const result=await fulfill(env,existing);return json({return_url:`/payment.html?session_id=${encodeURIComponent(existing.id)}`,paid:result.paid})}
    if(existing.status==='expired')throw new PublicError('This payment session has expired. Please review your details and start a new checkout.',409,'session_expired');
    if(existing.status==='open'&&existing.url)return json({url:existing.url});
    throw new PublicError('Please contact DeliverCrew about this payment.',409);
  }
  if(order.payment_status!=='unpaid')throw new PublicError('This order already has a payment recorded.',409);
  const origin=new URL(request.url).origin;
  const body=new URLSearchParams({mode:'payment',success_url:`${origin}/payment.html?session_id={CHECKOUT_SESSION_ID}`,cancel_url:`${origin}/booking.html?payment=cancelled`,client_reference_id:order.id,customer_email:order.email,'payment_method_types[0]':'card','metadata[application]':'delivercrew','metadata[campaign_id]':order.id,'metadata[campaign_number]':String(order.campaign_number),'line_items[0][price_data][currency]':'gbp','line_items[0][price_data][unit_amount]':String(pence(order.total)),'line_items[0][price_data][product_data][name]':`DeliverCrew campaign DC-${order.campaign_number}`,'line_items[0][quantity]':'1','custom_text[submit][message]':'Preferred delivery dates are subject to availability. DeliverCrew will confirm the schedule with you.'});
  const session=await stripe(env,'checkout/sessions',{method:'POST',body,idempotencyKey:`delivercrew-${input.request_id}`});
  if(!SESSION.test(session.id||'')||!session.url?.startsWith('https://checkout.stripe.com/'))throw new PublicError('Secure checkout could not be opened.',502);
  // Store the session before redirecting so the webhook can verify the exact order.
  const linked=await db(env,`campaigns?id=eq.${order.id}&stripe_session_id=is.null&payment_status=eq.unpaid`,{method:'PATCH',body:{stripe_session_id:session.id},prefer:'return=representation'});
  if(!linked?.length){const [current]=await db(env,`campaigns?id=eq.${order.id}&select=stripe_session_id`);if(current?.stripe_session_id!==session.id)throw new PublicError('Please contact DeliverCrew before trying another payment.',409)}
  return json({url:session.url});
}
async function webhook(request,env){
  requireSetup(env);const raw=await readBody(request,128000);
  if(!await verifySignature(raw,request.headers.get('Stripe-Signature'),env.STRIPE_WEBHOOK_SECRET))throw new PublicError('Invalid signature.',400);
  let event;try{event=JSON.parse(raw)}catch{throw new PublicError('Invalid event.')}
  if(['checkout.session.completed','checkout.session.async_payment_succeeded'].includes(event.type)){
    const id=event.data?.object?.id;if(!SESSION.test(id||''))throw new PublicError('Invalid payment session.');
    const session=await stripe(env,`checkout/sessions/${id}`);
    if(session.metadata?.application==='delivercrew')await fulfill(env,session);
  }
  return json({received:true});
}
export default {async fetch(request,env){
  const url=new URL(request.url);
  if(!url.pathname.startsWith('/api/payments/'))return env.ASSETS.fetch(request);
  try{
    if(url.pathname==='/api/payments/config'&&request.method==='GET')return json({available:enabled(env),test:enabled(env)?!keyMode(env):false});
    if(url.pathname==='/api/payments/checkout'&&request.method==='POST')return await checkout(request,env);
    if(url.pathname==='/api/payments/webhook'&&request.method==='POST')return await webhook(request,env);
    if(url.pathname==='/api/payments/status'&&request.method==='GET'){
      requireSetup(env);const id=url.searchParams.get('session_id');if(!SESSION.test(id||''))throw new PublicError('Invalid payment session.');
      return json(await fulfill(env,await stripe(env,`checkout/sessions/${id}`)));
    }
    return json({error:'Not found.'},404);
  }catch(error){return json({error:error instanceof PublicError?error.message:'We could not complete that request. Please try again.',code:error instanceof PublicError?error.code:'server_error'},error instanceof PublicError?error.status:500)}
}};
