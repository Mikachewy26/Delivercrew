import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const code=await readFile(new URL('../_worker.js',import.meta.url),'utf8');
const {default:worker,verifySignature}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const origin='https://delivercrewdistribution.co.uk';
const campaign='10000000-0000-4000-8000-000000000001',requestId='20000000-0000-4000-8000-000000000002';
const env={STRIPE_SECRET_KEY:'sk_test_fake',SUPABASE_SECRET_KEY:'sb_secret_fake',STRIPE_WEBHOOK_SECRET:'whsec_fake',PAYMENTS_ENABLED:'true'};
const sessionId='cs_test_abc123';
const session=()=>({id:sessionId,mode:'payment',currency:'gbp',metadata:{application:'delivercrew',campaign_id:campaign},client_reference_id:campaign,amount_total:6500,status:'complete',payment_status:'paid',payment_intent:'pi_fake',livemode:false});
const order=()=>({id:campaign,campaign_number:123,total:65,payment_status:'unpaid',stripe_session_id:sessionId,status:'awaiting_payment'});
const response=data=>new Response(JSON.stringify(data),{status:200});
const originalFetch=globalThis.fetch;
async function sign(raw,secret,time=Math.floor(Date.now()/1000)){
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);const signed=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(`${time}.${raw}`));return`t=${time},v1=${Buffer.from(signed).toString('hex')}`;
}
function post(path,body,originHeader=origin){return new Request(origin+path,{method:'POST',headers:{Origin:originHeader,'Content-Type':'application/json'},body:JSON.stringify(body)})}
const statusRequest=()=>new Request(origin+'/api/payments/status?session_id='+sessionId);
function mockPaid({payment=session(),record=order(),onPatch=()=>{}}={}){
 globalThis.fetch=async(url,options={})=>{if(url.startsWith('https://api.stripe.com/'))return response(payment);if(options.method==='PATCH'){onPatch(JSON.parse(options.body),url);return response([{...record,...JSON.parse(options.body)}])}return response([record])};
}
test.afterEach(()=>{globalThis.fetch=originalFetch});
test('checkout stays disabled until all settings and explicit activation exist',async()=>{
 const r=await worker.fetch(new Request(origin+'/api/payments/config'),{STRIPE_SECRET_KEY:'sk_live_fake'});assert.deepEqual(await r.json(),{available:false,test:false});
 const blocked=await worker.fetch(post('/api/payments/checkout',{}),{...env,PAYMENTS_ENABLED:'false'});assert.equal(blocked.status,503);
});
test('cross-site requests rejected before any external calls',async()=>{globalThis.fetch=()=>{throw Error('must not fetch')};assert.equal((await worker.fetch(post('/api/payments/checkout',{},'https://attacker.example'),env)).status,403)});
test('oversized JSON rejected before any external calls',async()=>{globalThis.fetch=()=>{throw Error('must not fetch')};assert.equal((await worker.fetch(post('/api/payments/checkout',{payload:'x'.repeat(17000)}),env)).status,413)});
test('signature verifies raw body, rejects tampering and stale timestamps',async()=>{const raw='{"id":"evt_test"}';const signature=await sign(raw,env.STRIPE_WEBHOOK_SECRET);assert.equal(await verifySignature(raw,signature,env.STRIPE_WEBHOOK_SECRET),true);assert.equal(await verifySignature(raw+' ',signature,env.STRIPE_WEBHOOK_SECRET),false);assert.equal(await verifySignature(raw,await sign(raw,env.STRIPE_WEBHOOK_SECRET,1),env.STRIPE_WEBHOOK_SECRET),false)});
test('forged webhook rejected before Stripe or database access',async()=>{globalThis.fetch=()=>{throw Error('must not fetch')};assert.equal((await worker.fetch(post('/api/payments/webhook',{type:'checkout.session.completed'}),env)).status,400)});
test('return page checks Stripe, amount and currency before marking paid',async()=>{let patches=0;mockPaid({onPatch:update=>{patches++;assert.equal(update.payment_status,'paid');assert.equal(update.status,'awaiting_artwork')}});const r=await worker.fetch(statusRequest(),env);assert.equal(r.status,200);assert.equal((await r.json()).paid,true);assert.equal(patches,1)});
test('wrong amount cannot mark an order paid',async()=>{let patches=0;mockPaid({payment:{...session(),amount_total:1},onPatch:()=>patches++});assert.equal((await worker.fetch(statusRequest(),env)).status,409);assert.equal(patches,0)});
test('wrong session or mode cannot mark an order paid',async()=>{let patches=0;mockPaid({record:{...order(),stripe_session_id:'cs_test_other'},onPatch:()=>patches++});assert.equal((await worker.fetch(statusRequest(),env)).status,409);mockPaid({payment:{...session(),livemode:true},onPatch:()=>patches++});assert.equal((await worker.fetch(statusRequest(),env)).status,400);assert.equal(patches,0)});
test('unpaid or incomplete Stripe sessions do not mark orders paid',async()=>{let patches=0;mockPaid({payment:{...session(),payment_status:'unpaid',status:'open'},onPatch:()=>patches++});const r=await worker.fetch(statusRequest(),env);assert.equal((await r.json()).paid,false);assert.equal(patches,0)});
test('duplicate paid events and late events after refund never overwrite payment status',async()=>{for(const payment_status of ['paid','refunded','part_refunded']){let patches=0;mockPaid({record:{...order(),payment_status},onPatch:()=>patches++});assert.equal((await worker.fetch(statusRequest(),env)).status,200);assert.equal(patches,0)}});
test('signed webhook retrieves authoritative Stripe session and updates order',async()=>{let patches=0;mockPaid({onPatch:()=>patches++});const raw=JSON.stringify({type:'checkout.session.completed',data:{object:{id:sessionId,amount_total:1}}});const r=await worker.fetch(new Request(origin+'/api/payments/webhook',{method:'POST',headers:{'Stripe-Signature':await sign(raw,env.STRIPE_WEBHOOK_SECRET)},body:raw}),env);assert.equal(r.status,200);assert.equal(patches,1)});
test('checkout uses database price and reuses session on retry',async()=>{
 let linked=false,creates=0;const stored={...order(),stripe_session_id:null,email:'test@example.invalid'};
 globalThis.fetch=async(url,options={})=>{
  if(url.endsWith('rpc/prepare_campaign_checkout'))return response([{...stored,stripe_session_id:linked?sessionId:null}]);
  if(url==='https://api.stripe.com/v1/checkout/sessions'){creates++;const params=new URLSearchParams(options.body);assert.equal(params.get('line_items[0][price_data][unit_amount]'),'6500');assert.equal(options.headers['Idempotency-Key'],'delivercrew-'+requestId);return response({...session(),status:'open',payment_status:'unpaid',url:'https://checkout.stripe.com/c/pay/'+sessionId})}
  if(url.startsWith('https://api.stripe.com/'))return response({...session(),status:'open',payment_status:'unpaid',url:'https://checkout.stripe.com/c/pay/'+sessionId});
  if(options.method==='PATCH'){linked=true;return response([{...stored,stripe_session_id:sessionId}])}
  throw Error('Unexpected URL '+url);
 };
 for(let i=0;i<2;i++){const r=await worker.fetch(post('/api/payments/checkout',{request_id:requestId,payload:{total:0.01}}),env);assert.equal(r.status,200);assert.equal((await r.json()).url,'https://checkout.stripe.com/c/pay/'+sessionId)}assert.equal(creates,1);
});
