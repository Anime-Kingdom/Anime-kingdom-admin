'use strict';
const URL_BASE='https://iuftepknrbankwkfdbuc.supabase.co';
const KEY='sb_publishable_hnpfNcfu6QKRwOdXeRd0FA_Cv34axxK';
const $=id=>document.getElementById(id);
const money=n=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR'}).format(Number(n)||0);
let session=null,tab='dashboard',rows=[],offset=0,editing=null,photos=[],busy=false;
function message(text,error=false,id='status'){const el=$(id);el.textContent=text;el.className=error?'error':'success';}
async function request(path,options={},auth=true){
 if(auth)await ensureSession();
 const currentSession=session;
 const headers={apikey:KEY,...options.headers};
 if(auth){if(!session){throw Error('Administrator access is not configured on this device. Orders and changes are unavailable.');}headers.Authorization='Bearer '+session.access_token;}
 if(options.body&&!(options.body instanceof Blob))headers['Content-Type']='application/json';
 const response=await fetch(URL_BASE+path,{...options,headers,signal:AbortSignal.timeout(25000)});
 const text=await response.text();let body;try{body=text?JSON.parse(text):null;}catch{body=null;}
 if(auth&&session!==currentSession)throw Error('Session changed. Please sign in again.');
 if(!response.ok){if(response.status===401&&auth){signOut();throw Error('Session expired. Please sign in again.');}throw Error(body?.msg||body?.message||body?.error_description||'Request failed ('+response.status+').');}
 return body;
}
function signOut(){for(const id of ['editor','coupon-editor','certificate-dialog','qr-dialog']){const dialog=$(id);if(dialog?.open)dialog.close();}$('gateway').hidden=false;$('admin-shell').hidden=true;session=null;overview={products:[],orders:null};localStorage.removeItem('ak-admin-session');rows=[];$('list').replaceChildren();$('disconnect').hidden=true;$('connection-label').textContent='Store preview';}
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{if(busy)return;tab=b.dataset.tab;load();});
$('filter').onchange=render;$('sort').onchange=render;
$('refresh').onclick=()=>load();$('search').oninput=render;$('more').onclick=()=>load(true);
async function load(append=false,quiet=false){if(busy)return;busy=true;const selected=tab;$('refresh').disabled=true;$('more').disabled=true;
 document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===selected));
 configureFilters(selected);
 $('heading').textContent=selected[0].toUpperCase()+selected.slice(1);$('add').hidden=!['products','coupons','certificates'].includes(selected);$('add').textContent=selected==='certificates'?'+ Register item':selected==='coupons'?'+ Coupon':'+ Product';
 try{
 if(selected==='certificates'){more.hidden=true;await loadCertificates();return;}if(['dashboard','customers','inventory'].includes(selected)){await loadOverview(selected);return;}
 const path=selected==='coupons'?'/rest/v1/ak_coupons?select=*&order=code.asc':selected==='products'?'/rest/v1/ak_products?select=*&order=id.asc':'/rest/v1/AK%20orders?select=id,created_at,customer_name,email,phone,status,payment_method,utr_number,form_data&form_type=eq.checkout&order=created_at.desc,id.desc';
 const all=[];let page=0;
 while(true){const batch=await request(path+'&limit=100&offset='+page,{},selected==='orders');if(!Array.isArray(batch))throw Error('Unexpected database response.');all.push(...batch);if(batch.length<100)break;page+=batch.length;}
 if(selected!==tab)return;
 const changed=JSON.stringify(rows)!==JSON.stringify(all);rows=all;offset=all.length;$('more').hidden=true;if(changed||!quiet)render();
 message(rows.length+' '+selected+' loaded. Automatically checks for updates every 15 seconds.');
 }catch(err){if(!quiet){rows=[];$('list').replaceChildren();}message(err.message,true);}finally{busy=false;$('refresh').disabled=false;$('more').disabled=false;}}
function autoRefresh(){if(document.hidden||busy||$('certificate-dialog').open||$('qr-dialog').open||$('editor').open||$('coupon-editor').open)return;const active=document.activeElement;if(active&&['INPUT','TEXTAREA','SELECT'].includes(active.tagName))return;if(['orders','customers','dashboard'].includes(tab)&&!session)return;return load(false,true);}
if(typeof setInterval==='function'){setInterval(autoRefresh,15000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)autoRefresh();});}
function element(tag,text,parent){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(parent)parent.append(e);return e;}
function safeImage(src,parent){try{const u=new URL(src);if(u.protocol!=='https:')return;const img=element('img',undefined,parent);img.src=u.href;img.alt='Product';img.loading='lazy';}catch{}}
function configureFilters(selected){
 const filter=$('filter');const previous=filter.datasetTab;filter.datasetTab=selected;
 if(previous!==selected){filter.replaceChildren();const options=selected==='orders'?['all','pending','confirmed','packed','shipped','delivered','cancelled']:selected==='coupons'?['all','enabled','disabled']:['products','inventory'].includes(selected)?['all','in-stock','low-stock','out-of-stock']:['all'];for(const value of options){const o=element('option',value==='all'?'All items':value.replaceAll('-',' '),filter);o.value=value;}filter.value='all';$('search').value='';$('sort').value='default';}
 $('sort').disabled=!['products','inventory'].includes(selected);filter.disabled=['dashboard','customers','certificates'].includes(selected);
 $('list').className=['products','coupons','inventory'].includes(selected)?'card-grid':'';
 if(previous!==selected)$('result-count').textContent='';
}
function filteredRows(items,kind){
 const query=$('search').value.toLowerCase(),filter=$('filter').value||'all';
 const found=items.filter(row=>{if(!JSON.stringify(row).toLowerCase().includes(query))return false;if(filter==='all')return true;if(kind==='orders')return (row.status||'pending')===filter;if(kind==='coupons')return filter==='enabled'?row.enabled:!row.enabled;const stock=Number(row.data?.stock)||0;return filter==='out-of-stock'?stock===0:filter==='low-stock'?stock>0&&stock<=5:stock>0;});
 const sort=$('sort').value;if(['products','inventory'].includes(kind)&&sort!=='default')found.sort((a,b)=>sort==='name'?String(a.data.name).localeCompare(String(b.data.name)):sort==='stock'?Number(a.data.stock)-Number(b.data.stock):(Number(a.data.price)-Number(b.data.price))*(sort==='price-high'?-1:1));
 $('result-count').textContent=found.length+' of '+items.length+' '+kind;
 return found;
}
function render(){if(tab==='certificates'){renderCertificates();return;}if(['dashboard','customers','inventory'].includes(tab)){renderOverview();return;}const list=$('list');list.replaceChildren();const found=filteredRows(rows,tab);if(!found.length)element('p','No '+tab+' found.',list);
 for(const row of found){const card=element('article',undefined,list);if(tab==='coupons'){element('h3',row.code,card);element('p',(row.percent?row.percent+'%':money(row.amount))+' off · Minimum '+money(row.minimum)+' · '+(row.enabled?'Enabled':'Disabled'),card);element('button','Edit coupon',card).onclick=()=>editCoupon(row);}
 else if(tab==='products'){
 const p=row.data;safeImage(p.imageUrl,card);element('h3',p.name,card);element('span',Number(p.stock)===0?'Out of stock':Number(p.stock)<=5?'Low stock':'In stock',card).className='badge '+(Number(p.stock)<=5?'warning':'');element('div',money(p.price)+' · Stock '+p.stock,card).className='money';if(p.original>p.price){element('del',money(p.original),card);element('p',Math.round((1-p.price/p.original)*100)+'% off · Save '+money(p.original-p.price),card).className='success';}element('p',p.anime,card);const b=element('button','Edit product',card);b.onclick=()=>edit(row);
 }else{const data=row.form_data||{};element('span',row.status||'pending',card).className='badge';element('h3',row.customer_name||'Customer',card);element('p',new Date(row.created_at).toLocaleString()+' · '+row.id,card);
 for(const item of data.items||[]){const line=element('div',undefined,card);safeImage(item.imageUrl,line);element('p',(item.name||item.id)+' × '+item.qty+' — '+money(item.lineTotal??item.price*item.qty),line);}
 element('p','Total '+money(data.total)+' · '+(row.payment_method||data.paymentMethod||'Unknown payment method'),card).className='money';
 const a=data.address||{};element('p',[a.address,a.city,a.state,a.pin].filter(Boolean).join(', '),card);element('p',[row.phone,row.email].filter(Boolean).join(' · '),card);
 element('p','Payment: '+(data.paymentStatus||'Not recorded'),card);
 if((row.payment_method||data.paymentMethod)==='upi'||row.utr_number||data.upiReference||data.paymentScreenshot){
 const payment=element('section',undefined,card);payment.className='payment-details';element('h4','UPI payment details',payment);
 element('p','UTR / reference: '+(row.utr_number||data.upiReference||'Not provided'),payment);
 if(data.upiId)element('p','Paid to UPI ID: '+data.upiId,payment);
 element('p','Customer-submitted proof · Verify payment in your bank or UPI app.',payment);
 const proof=data.paymentScreenshot;
 if(typeof proof==='string'&&proof.length<=3000000&&/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(proof)){
 const details=element('details',undefined,payment);element('summary','View payment screenshot',details);const img=element('img',undefined,details);img.className='payment-proof';img.alt='Customer payment screenshot';img.loading='lazy';img.src=proof;
 }else element('p',proof?'Payment screenshot format is not supported.':'No payment screenshot attached.',payment);
 }
 const actions=element('div',undefined,card);actions.className='order-actions';
 const select=element('select',undefined,actions);select.setAttribute('aria-label','Order status');const statuses=['pending','confirmed','packed','shipped','delivered','cancelled'];if(row.status&&!statuses.includes(row.status))statuses.unshift(row.status);for(const s of statuses){const o=element('option',s,select);o.value=s;}select.value=row.status||'pending';
 const b=element('button','Update status',actions);b.onclick=async()=>{b.disabled=true;try{const updated=await request('/rest/v1/AK%20orders?id=eq.'+encodeURIComponent(row.id),{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({status:select.value})});if(updated.length!==1)throw Error('Order was not updated.');row.status=select.value;message('Order status saved.');}catch(err){message(err.message,true);}finally{b.disabled=false;}};
 const remove=element('button','Delete',actions);remove.className='danger compact-delete';remove.setAttribute('aria-label','Permanently delete order '+row.id);remove.onclick=()=>deleteOrder(row,remove);
 }}
}
async function deleteOrder(row,button){
 if(busy||button.disabled)return;
 if(!confirm('Permanently delete order '+row.id+' for '+(row.customer_name||'Customer')+'? This cannot be undone. It will not refund payment or restore stock.'))return;
 busy=true;button.disabled=true;
 try{
 const removed=await request('/rest/v1/AK%20orders?id=eq.'+encodeURIComponent(row.id)+'&form_type=eq.checkout&select=id',{method:'DELETE',headers:{Prefer:'return=representation'}});
 if(!Array.isArray(removed)||removed.length!==1||removed[0].id!==row.id)throw Error('Order was not deleted. Administrator delete permission may need to be enabled.');
 rows=rows.filter(item=>item.id!==row.id);if(overview.orders)overview.orders=overview.orders.filter(item=>item.id!==row.id);render();message('Order deleted. Payment and stock were not changed.');
 }catch(error){message(error.message,true);}finally{busy=false;button.disabled=false;}
}
$('add').onclick=()=>tab==='certificates'?openCertificateEditor():tab==='coupons'?editCoupon(null):edit(null);
function edit(row){editing=row;const p=row?.data||{name:'',anime:'',category:'Figures',price:599,stock:20,description:'',featured:false};const f=$('product');for(const name of ['name','anime','category','price','stock','description'])f.elements[name].value=p[name]??'';f.elements.original.value=p.original>0?p.original:'';f.elements.featured.checked=!!p.featured;photos=[...(p.imageUrls||[p.imageUrl]).filter(Boolean)];renderPhotos();$('upload').value='';message('',false,'edit-status');$('editor').showModal();}
function renderPhotos(){const parent=$('photos');parent.replaceChildren();photos.forEach((url,index)=>{const box=element('div',undefined,parent);safeImage(url,box);const b=element('button',index===0?'Remove cover':'Remove photo',box);b.type='button';b.onclick=()=>{photos.splice(index,1);renderPhotos();};});}
$('cancel').onclick=()=>$('editor').close();
$('upload').onchange=async()=>{const file=$('upload').files[0];if(!file)return;const save=$('save');save.disabled=true;try{
 if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024)throw Error('Choose a JPG, PNG or WebP image under 5 MB.');
 if(photos.length>=10)throw Error('Maximum 10 photos per product.');
 const bitmap=await createImageBitmap(file);bitmap.close();
 const path=crypto.randomUUID()+'.'+({'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[file.type]);
 await request('/storage/v1/object/ak-product-images/'+path,{method:'POST',headers:{'Content-Type':file.type},body:file});photos.push(URL_BASE+'/storage/v1/object/public/ak-product-images/'+path);renderPhotos();message('Photo uploaded. Save the product to publish it.',false,'edit-status');
 }catch(err){message(err.message,true,'edit-status');}finally{save.disabled=false;$('upload').value='';}};
$('product').onsubmit=async e=>{e.preventDefault();$('save').disabled=true;try{const f=$('product');if(!photos.length)throw Error('Add at least one photo.');
 const data={...(editing?.data||{}),name:f.elements.name.value.trim(),anime:f.elements.anime.value.trim(),category:f.elements.category.value.trim(),price:Number(f.elements.price.value),original:f.elements.original.value.trim()?Number(f.elements.original.value):0,stock:Number(f.elements.stock.value),description:f.elements.description.value.trim(),featured:f.elements.featured.checked,imageUrl:photos[0],imageUrls:[...photos]};
 if(!data.name||!data.anime||!data.category||!Number.isFinite(data.price)||data.price<=0||!Number.isInteger(data.stock)||data.stock<0)throw Error('Enter a name, collection, positive price and whole stock quantity.');
 if(!Number.isFinite(data.original)||data.original<0||(data.original>0&&data.original<data.price))throw Error('Original price must be equal to or greater than the selling price. Leave it blank when there is no discount.');
 const id=editing?.id||'product-'+crypto.randomUUID();data.id=id;
 const path='/rest/v1/ak_products'+(editing?'?id=eq.'+encodeURIComponent(id):'');
 const result=await request(path,{method:editing?'PATCH':'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({id,data})});if(result.length!==1)throw Error('Product was not saved.');
 $('editor').close();await load();message('Product saved to the shared website catalog.');
 }catch(err){message(err.message,true,'edit-status');}finally{$('save').disabled=false;}};
let couponEditing=null;
function editCoupon(row){couponEditing=row;const f=$('coupon-form');f.elements.code.value=row?.code||'';f.elements.code.readOnly=!!row;f.elements.kind.value=row?.amount?'amount':'percent';f.elements.value.value=row?.percent||row?.amount||20;f.elements.minimum.value=row?.minimum||0;f.elements.enabled.checked=row?.enabled??true;message('',false,'coupon-status');$('coupon-editor').showModal();}
$('coupon-cancel').onclick=()=>$('coupon-editor').close();
$('coupon-form').onsubmit=async e=>{e.preventDefault();$('coupon-save').disabled=true;try{const f=$('coupon-form'),code=f.elements.code.value.trim().toUpperCase(),kind=f.elements.kind.value,value=Number(f.elements.value.value),minimum=Number(f.elements.minimum.value);if(!/^[A-Z0-9_-]{3,40}$/.test(code)||!Number.isFinite(value)||value<=0||(kind==='percent'&&value>100)||!Number.isFinite(minimum)||minimum<0)throw Error('Enter a valid code, positive discount, and minimum order. Percentage cannot exceed 100.');const data={code,minimum,percent:kind==='percent'?value:null,amount:kind==='amount'?value:null,enabled:f.elements.enabled.checked};const result=await request('/rest/v1/ak_coupons'+(couponEditing?'?code=eq.'+encodeURIComponent(code):''),{method:couponEditing?'PATCH':'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(data)});if(result.length!==1)throw Error('Coupon was not saved.');$('coupon-editor').close();await load();message('Coupon saved.');}catch(err){message(err.message,true,'coupon-status');}finally{$('coupon-save').disabled=false;}};

let refreshing=null;
function remember(value){session={...value,expires_at:value.expires_at||Math.floor(Date.now()/1000)+(value.expires_in||3600)};localStorage.setItem('ak-admin-session',JSON.stringify(session));}
async function ensureSession(){
 if(!session)return;
 if(session.expires_at*1000>Date.now()+60000)return;
 if(!refreshing)refreshing=request('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:JSON.stringify({refresh_token:session.refresh_token})},false).then(remember).catch(e=>{signOut();throw e;}).finally(()=>{refreshing=null;});
 await refreshing;
}
function connected(){ $('gateway').hidden=true;$('admin-shell').hidden=false; $('disconnect').hidden=false;$('connection-label').textContent='Connected to animekingdom.in'; }
$('disconnect').onclick=()=>{signOut();load();};
$('toggle-passcode').onclick=()=>{const field=$('admin-passcode');const visible=field.type==='password';field.type=visible?'text':'password';$('toggle-passcode').textContent=visible?'Hide':'Show';$('toggle-passcode').setAttribute('aria-label',visible?'Hide passcode':'Show passcode');$('toggle-passcode').setAttribute('aria-pressed',String(visible));};
$('gateway-form').onsubmit=async event=>{event.preventDefault();const button=$('gateway-submit');if(button.disabled)return;button.disabled=true;message('Checking administrator access…',false,'gateway-status');try{
 if($('admin-identifier').value.trim()!=='RAM')throw Error('Invalid administrator identifier or passcode.');
 const value=await request('/auth/v1/token?grant_type=password',{method:'POST',body:JSON.stringify({email:'vgamerking45@gmail.com',password:$('admin-passcode').value})},false);
 session=value;const allowed=await request('/rest/v1/rpc/ak_is_admin',{method:'POST',body:'{}'});if(allowed!==true)throw Error('This account does not have administrator access.');
 remember(value);connected();message('',false,'gateway-status');await load();
 }catch(error){signOut();message(error.message,true,'gateway-status');}finally{$('admin-passcode').value='';button.disabled=false;}};
async function start(){if(typeof location!=='undefined'&&new URLSearchParams(location.hash.slice(1)).get('type')==='recovery'){location.replace('reset.html'+location.hash);return;}try{const saved=JSON.parse(localStorage.getItem('ak-admin-session')||'null');if(saved?.refresh_token){session=saved;await ensureSession();const allowed=await request('/rest/v1/rpc/ak_is_admin',{method:'POST',body:'{}'});if(allowed!==true)throw Error('Administrator access is not activated.');connected();await load();}}catch(error){signOut();message(error.message,true,'gateway-status');}}
let overview={products:[],orders:null};
async function readAll(path,auth){const all=[];for(let n=0;;n+=100){const batch=await request(path+'&limit=100&offset='+n,{},auth);if(!Array.isArray(batch))throw Error('Unexpected store response.');all.push(...batch);if(batch.length<100)return all;}}
async function loadOverview(selected){
 const products=await readAll('/rest/v1/ak_products?select=*&order=id.asc',false);
 let orders=null;if(session&&selected!=='inventory')orders=await readAll('/rest/v1/AK%20orders?select=id,created_at,customer_name,email,phone,status,payment_method,utr_number,form_data&form_type=eq.checkout&order=created_at.desc,id.desc',true);
 if(tab!==selected)return;overview={products,orders};renderOverview();message(orders===null&&selected!=='inventory'?'Catalog connected. Private orders require administrator access.':'Store data refreshed. Updates checked every 15 seconds.');
}
function renderOverview(){if(!session)overview.orders=null;const list=$('list');list.replaceChildren();document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));const q=$('search').value.toLowerCase();
 if(tab==='dashboard'){
 const grid=element('div',undefined,list);grid.className='metrics';const orders=overview.orders;const completed=orders?.filter(o=>o.status==='delivered'||o.form_data?.paymentStatus==='paid')||[];const revenue=completed.reduce((n,o)=>n+(Number(o.form_data?.total)||0),0);
 for(const [label,value,note] of [['PRODUCTS',overview.products.length,'Live website catalog'],['TOTAL ORDERS',orders?orders.length:'—',orders?'All checkout orders':'Administrator access required'],['PAID / DELIVERED VALUE',orders?money(revenue):'—','Recorded order totals; not net profit'],['AVERAGE ORDER VALUE',orders?money(completed.length?revenue/completed.length:0):'—','Paid or delivered orders'],['LOW STOCK',overview.products.filter(p=>Number(p.data.stock)<=5).length,'Five units or fewer'],['PENDING ORDERS',orders?orders.filter(o=>!o.status||o.status==='pending').length:'—','Awaiting confirmation']]){const c=element('article',undefined,grid);element('small',label,c);element('h2',String(value),c);element('p',note,c);}return;
 }
 if(tab==='inventory'){for(const row of filteredRows(overview.products,'inventory')){const c=element('article',undefined,list);safeImage(row.data.imageUrl,c);element('h3',row.data.name,c);element('p',row.data.stock+' units · '+(row.data.stock===0?'Out of stock':row.data.stock<=5?'Low stock':'In stock'),c);element('button','Update stock',c).onclick=()=>edit(row);}return;}
 if(!overview.orders){element('p','Administrator access is required to view customer orders.',list);return;}
 const customers=new Map();for(const o of overview.orders){const key=o.email||o.phone||o.id;const c=customers.get(key)||{name:o.customer_name,email:o.email,phone:o.phone,count:0,total:0};c.count++;c.total+=Number(o.form_data?.total)||0;customers.set(key,c);}for(const c of [...customers.values()].filter(c=>JSON.stringify(c).toLowerCase().includes(q))){const card=element('article',undefined,list);element('h3',c.name||'Customer',card);element('p',[c.email,c.phone].filter(Boolean).join(' · '),card);element('p',c.count+' orders · '+money(c.total)+' ordered',card);}if(!customers.size)element('p','No customer orders yet.',list);
}
start();
