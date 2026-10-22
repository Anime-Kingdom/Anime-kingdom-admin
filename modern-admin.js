/* Administration tools use the existing authenticated request helper and RLS. */
(() => {
 'use strict';
 const legacyLoad=load,legacyRender=render,legacyOverview=renderOverview;
 let accounts=[],accountStats=null,variantDraft=[],uploads=0,dirty=false,reportVersion=0;
 const date=value=>value?new Date(value).toLocaleString('en-IN'):'Not recorded';
 const publicImage=value=>{try{const u=new URL(value);return u.protocol==='https:'?u.href:'';}catch{return '';}};
 const tag=(text,parent,ok=false)=>{const e=element('span',text,parent);e.className='tag'+(ok?' ok':'');return e;};
 const reportTabs=['accounts','requests','messages'];
 const showAll=element('button','Show all products',$('view-filter').parentElement.parentElement);showAll.id='show-all-products';showAll.className='secondary';showAll.type='button';showAll.onclick=()=>{$('search').value='';$('filter').value='all';$('view-filter').value='all';$('sort').value='default';render();};
 function optionMatches(p,filter){return filter==='all'||filter==='featured'&&p.featured||filter==='new'&&p.new||filter==='options'&&p.colors?.length||filter==='unavailable'&&p.availabilityUnconfirmed;}
 function displayedRows(){let source=tab==='inventory'?overview.products:rows;const filter=$('view-filter').value;if(tab==='products')source=source.filter(r=>optionMatches(r.data,filter));if(tab==='orders'&&filter!=='all')source=source.filter(r=>(r.status||'pending')===filter);return filteredRows(source,tab);}
 const legacyPortraits=['sanemi','zenitsu','tanjiro','giyu','muichiro','giyu','mitsuri','rengoku','kanao','shinobu'];
 function optionPhoto(p,key,index){return p.optionImages?.[key]||(p.id==='product-fda957ef-9189-437e-9915-61cc3d6138fa'&&legacyPortraits[index]?'https://animekingdom.in/portrait-'+legacyPortraits[index]+'.webp':'');}
 function setupFilter(){
  const f=$('view-filter');if(f.dataset.tab&&f.dataset.tab!==tab)$('search').value='';const previous=f.dataset.tab===tab?f.value:'all';f.replaceChildren();
  const entries=tab==='products'?[['all','All products'],['featured','Featured'],['new','New arrivals'],['options','With options'],['unavailable','Contact store']]:tab==='accounts'?[['all','All accounts'],['website','Used website'],['app','Used app'],['both','Used both'],['signed','Has signed in'],['no-profile','Profile incomplete']]:tab==='orders'?[['all','All orders'],...['pending','confirmed','packed','shipped','delivered','cancelled'].map(s=>[s,s[0].toUpperCase()+s.slice(1)])]:[['all','All records']];
  for(const [value,label]of entries){const o=element('option',label,f);o.value=value;}f.value=entries.some(([v])=>v===previous)?previous:'all';f.dataset.tab=tab;
  showAll.hidden=tab!=='products';$('record-count').hidden=['dashboard','certificates'].includes(tab);f.parentElement.hidden=!['products','accounts','orders'].includes(tab);
  $('list').classList.toggle('product-list',tab==='products');if(reportTabs.includes(tab))$('list').classList.toggle('card-grid',false);if($('filter'))$('filter').disabled=['dashboard','customers','certificates',...reportTabs].includes(tab);if($('sort'))$('sort').disabled=!['products','inventory'].includes(tab);$('export-data').hidden=['dashboard','certificates'].includes(tab);
 }
 function matchAccount(a){const filter=$('view-filter').value;return JSON.stringify(a).toLowerCase().includes($('search').value.toLowerCase())&&(filter==='all'||filter==='website'&&a.website_last_seen||filter==='app'&&a.app_last_seen||filter==='both'&&a.website_last_seen&&a.app_last_seen||filter==='signed'&&a.last_sign_in_at||filter==='no-profile'&&!a.customer_id);}
 async function getAccounts(){
  const all=[];let stats;
  for(let n=0;;n+=200){const response=await request('/rest/v1/rpc/ak_admin_customer_accounts',{method:'POST',body:JSON.stringify({p_offset:n,p_limit:200})});stats=response;all.push(...response.accounts);if(response.accounts.length<200)break;}
  return {accounts:all,stats};
 }
 load=async function(append=false,quiet=false){
  if(busy)return;
  const previousTab=$('view-filter').dataset.tab;setupFilter();
  if(previousTab!==tab){$('list').replaceChildren();element('p','Loading '+({products:'products',accounts:'accounts'}[tab]||tab)+'…',$('list')).className='empty-panel';$('record-count').textContent='';$('result-count').textContent='';}
  if(!reportTabs.includes(tab)){
   await legacyLoad(append,quiet);
   if(tab==='dashboard'&&session){const version=++reportVersion;try{const report=await request('/rest/v1/rpc/ak_admin_customer_accounts',{method:'POST',body:JSON.stringify({p_offset:0,p_limit:1})});if(version===reportVersion&&tab==='dashboard'){accountStats=report;renderOverview();}}catch(e){if(!quiet)message('Catalog loaded. Account report: '+e.message,true);}}
   return;
  }
  if(busy)return;busy=true;const selected=tab;$('heading').textContent={accounts:'Sign-ins & accounts',requests:'Custom requests',messages:'Customer messages'}[tab];$('add').hidden=true;$('refresh').disabled=true;$('more').hidden=true;
  document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
  try{
   if(!session){accounts=[];rows=[];$('list').replaceChildren();element('div','Connect your administrator account to see private customer information.',$('list')).className='empty-panel';return;}
   if(selected==='accounts'){const data=await getAccounts();if(tab!==selected)return;accounts=data.accounts;accountStats=data.stats;renderAccounts();}
   else {const type=selected==='requests'?'custom_figure':'contact';const data=await readAll('/rest/v1/AK%20orders?select=id,created_at,customer_name,email,phone,status,form_data&form_type=eq.'+type+'&order=created_at.desc,id.desc',true);if(tab!==selected)return;rows=data;renderMessages();}
   message('Updated '+new Date().toLocaleTimeString('en-IN')+'. Private records are visible only to the administrator.');
  }catch(e){if(!quiet)$('list').replaceChildren();message(e.message,true);}finally{busy=false;$('refresh').disabled=false;}
 };
 render=function(){
  setupFilter();
  if(tab==='accounts'){renderAccounts();return;}if(['requests','messages'].includes(tab)){renderMessages();return;}
  if(tab==='products'){renderProductTable();return;}
  if(['dashboard','customers','inventory','certificates'].includes(tab)){legacyRender();if(tab==='inventory')$('record-count').textContent=displayedRows().length+' products';else if(tab==='customers')$('record-count').textContent='';return;}
  const original=rows;rows=displayedRows();
  try{legacyRender();$('record-count').textContent=rows.length+' records';}finally{rows=original;}
 };
 function renderProductTable(){
  const list=$('list'),found=displayedRows();list.replaceChildren();list.classList.remove('card-grid');
  $('result-count').textContent=found.length+' of '+rows.length+' products';$('record-count').textContent=found.length===rows.length?'All products shown':(rows.length-found.length)+' hidden by filters';
  if(!found.length){element('div','No products match these filters. Use Show all products to reset them.',list).className='empty-panel';return;}
  const wrap=element('div',undefined,list);wrap.className='table-wrap catalog-table-wrap';const table=element('table',undefined,wrap);table.className='catalog-table';table.setAttribute('aria-label','Product catalog');
  const head=element('tr',undefined,element('thead',undefined,table));for(const label of ['#','Product','Price','Stock','Options','Actions'])element('th',label,head);
  const body=element('tbody',undefined,table);
  found.forEach((row,index)=>{const p=row.data,tr=element('tr',undefined,body);element('td',String(index+1),tr);const product=element('td',undefined,tr),identity=element('div',undefined,product);identity.className='catalog-identity';const image=publicImage(p.imageUrl||p.imageUrls?.[0]);if(image){const img=element('img',undefined,identity);img.src=image;img.alt='';img.loading='lazy';}const text=element('div',undefined,identity);element('strong',p.name||'Unnamed product',text);element('small',[p.anime,p.category].filter(Boolean).join(' · '),text);
   const price=element('td',money(p.price),tr);if(p.original>p.price)element('small',money(p.original)+' original',price);
   const stock=element('td',String(p.stock??0),tr);element('small',p.availabilityUnconfirmed?'Contact store':Number(p.stock)===0?'Out of stock':Number(p.stock)<=5?'Low stock':'In stock',stock);
   const options=element('td',p.colors?.length?p.colors.length+' '+(p.optionLabel==='Design'?'designs':'colours'):'—',tr);if(p.featured)tag('Featured',options);
   const actions=element('td',undefined,tr);actions.className='catalog-actions';const editButton=element('button','Edit product',actions);editButton.setAttribute('aria-label','Edit '+p.name);editButton.onclick=()=>edit(row);const duplicate=element('button','Duplicate as draft',actions);duplicate.className='secondary';duplicate.setAttribute('aria-label','Duplicate '+p.name+' as draft');duplicate.onclick=()=>{edit({id:null,data:{...structuredClone(p),name:p.name+' (copy)'}});editing=null;$('product-editor-title').textContent='New product from copy';};
  });

 };
 renderOverview=function(){legacyOverview();if(tab!=='dashboard')return;const list=$('list');const note=element('div',undefined,list);note.className='report-note';element('strong','Your next actions',note);const low=overview.products.filter(r=>Number(r.data.stock)<=5).length;element('p',low?low+' products need a stock check. Open Inventory to update quantities.':'Stock levels are healthy. Open Product catalog to add a new collection or design.',note);if(session&&accountStats){const grid=element('div',undefined,list);grid.className='metrics report-metrics';for(const[label,value]of [['REGISTERED ACCOUNTS',accountStats.registered],['ACCOUNTS THAT SIGNED IN',accountStats.signedIn],['USED WEBSITE',accountStats.website],['USED APP',accountStats.app]]){const c=element('article',undefined,grid);element('small',label,c);element('h2',String(value),c);element('p','Unique customer accounts',c);}const b=element('button','View customer sign-ins',list);b.onclick=()=>{tab='accounts';load();};}};
 function renderAccounts(){
  const list=$('list');list.replaceChildren();if(!session)return;
  const grid=element('div',undefined,list);grid.className='metrics report-metrics';for(const[label,key]of [['REGISTERED ACCOUNTS','registered'],['HAS SIGNED IN','signedIn'],['USED WEBSITE','website'],['USED APP','app']]){const c=element('article',undefined,grid);element('small',label,c);element('h2',String(accountStats?.[key]??0),c);}
  element('p','Last sign-in comes from authentication. App / website usage starts recording with this update. These are recorded visits, not a live online-user count.',list).className='report-note';
  const found=accounts.filter(matchAccount);$('record-count').textContent=found.length+' accounts';if(!found.length){element('div','No matching accounts.',list).className='empty-panel';return;}
  const wrap=element('div',undefined,list);wrap.className='table-wrap';const table=element('table',undefined,wrap),head=element('tr',undefined,element('thead',undefined,table));for(const label of ['Customer','Account provider','Last sign-in','Used website','Used app','Profile'])element('th',label,head);const body=element('tbody',undefined,table);
  for(const a of found){const tr=element('tr',undefined,body),customer=element('td',undefined,tr);element('strong',a.full_name||'Name not saved',customer);element('small',a.email||'No email',customer);if(a.phone)element('small',a.phone,customer);element('td',a.provider==='google'?'Google':a.provider||'Email',tr);element('td',date(a.last_sign_in_at),tr);element('td',date(a.website_last_seen),tr);element('td',date(a.app_last_seen),tr);const profile=element('td',undefined,tr);tag(a.customer_id?'AK–'+a.customer_id:'Incomplete',profile,!!a.customer_id);element('small',a.email_verified?'Email verified':'Email unverified',profile);}
 }
 function renderMessages(){
  const list=$('list');list.replaceChildren();const found=rows.filter(r=>JSON.stringify(r).toLowerCase().includes($('search').value.toLowerCase()));$('record-count').textContent=found.length+' records';if(!found.length)element('div','No requests or messages found.',list).className='empty-panel';
  for(const row of found){const c=element('article',undefined,list);element('h3',row.customer_name||row.form_data?.name||'Customer',c);element('p',[row.email,row.phone,date(row.created_at)].filter(Boolean).join(' · '),c);const data=row.form_data||{};for(const key of ['subject','message','character','size','pose','accessories','finish','requirements','instagram_id'])if(data[key]){const p=element('p',undefined,c);element('strong',key.replaceAll('_',' ')+': ',p);p.append(document.createTextNode(String(data[key])));}if(typeof data.reference==='string'&&/^data:image\/(jpeg|png|webp);base64,/.test(data.reference)){const img=element('img',undefined,c);img.src=data.reference;img.alt='Customer reference';}const status=element('select',undefined,c);status.setAttribute('aria-label','Request status');for(const value of ['pending','reviewing','contacted','completed','cancelled']){const o=element('option',value,status);o.value=value;}status.value=row.status||'pending';const b=element('button','Update request status',c);b.onclick=async()=>{b.disabled=true;try{const result=await request('/rest/v1/AK%20orders?id=eq.'+encodeURIComponent(row.id),{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({status:status.value})});if(result.length!==1)throw Error('No record updated.');row.status=status.value;message('Request status saved.');}catch(e){message(e.message,true);}finally{b.disabled=false;}};}
 }
 $('search').oninput=()=>render();$('view-filter').onchange=()=>render();$('filter').onchange=()=>render();$('sort').onchange=()=>render();
 $('export-data').onclick=()=>{
  if(['accounts','orders','customers','requests','messages'].includes(tab)&&!session){message('Connect as administrator before exporting private records.',true);return;}
  const sourceRows=['products','inventory','orders','coupons'].includes(tab)?displayedRows():rows;
  let data=tab==='accounts'?accounts.filter(matchAccount).map(a=>({name:a.full_name,email:a.email,phone:a.phone,provider:a.provider,last_sign_in:a.last_sign_in_at,website_last_used:a.website_last_seen,app_last_used:a.app_last_seen,collector_id:a.customer_id})):tab==='products'||tab==='inventory'?sourceRows.map(r=>({id:r.id,name:r.data.name,collection:r.data.anime,category:r.data.category,price:r.data.price,stock:r.data.stock,options:(r.data.colors||[]).join(' | ')})):tab==='customers'?(overview.orders||[]).map(r=>({name:r.customer_name,email:r.email,phone:r.phone,total:r.form_data?.total})):sourceRows.map(r=>({id:r.id,date:r.created_at,name:r.customer_name,email:r.email,phone:r.phone,status:r.status,total:r.form_data?.total}));
  const q=$('search').value.toLowerCase();if(!['products','inventory','orders','coupons','accounts'].includes(tab))data=data.filter(r=>JSON.stringify(r).toLowerCase().includes(q));if(!data.length){message('No records to export.',true);return;}
  const cell=v=>'"'+String(v??'').replace(/^(?:\s*[=+@-]|[\t\r])/,"'$&").replaceAll('"','""')+'"';const fields=Object.keys(data[0]);const csv='\ufeff'+[fields.map(cell).join(','),...data.map(r=>fields.map(k=>cell(r[k])).join(','))].join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='anime-kingdom-'+tab+'-'+new Date().toISOString().slice(0,10)+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 };
 edit=function(row){
  editing=row?.id?row:null;const p=row?.data||{name:'',anime:'',category:'Anime Figures',price:599,stock:20};const f=$('product');f.reset();
  for(const key of ['name','anime','category','price','stock','description','material','height'])f.elements[key].value=p[key]??'';
  f.elements.original.value=p.original>0?p.original:'';f.elements.packSize.value=p.packSize||1;f.elements.minQty.value=p.minQty||1;f.elements.optionLabel.value=p.optionLabel==='Design'?'Design':'Colour';for(const key of ['featured','new','availabilityUnconfirmed'])f.elements[key].checked=!!p[key];
  photos=[...(p.imageUrls?.length?p.imageUrls:[p.imageUrl]).filter(Boolean)];variantDraft=(p.colors||[]).map((key,i)=>({key,label:p.designNames?.[key]||key,image:optionPhoto(p,key,i),swatch:p.optionSwatches?.[key]||({Blue:'#1565ff',Red:'#ed2024',Black:'#111111',Silver:'#c0c0c0',Purple:'#9228df',Yellow:'#ffdd00',Brown:'#854b24'}[key])||'#9b72da',existing:!!row?.id}));renderPhotos();renderVariants();$('upload').value='';dirty=false;message('',false,'edit-status');$('product-editor-title').textContent=editing?'Edit '+p.name:'Create a product';$('editor').showModal();
 };
 renderPhotos=function(){const parent=$('photos');parent.replaceChildren();photos.forEach((url,index)=>{const box=element('div',undefined,parent);safeImage(url,box);if(index===0)tag('Cover',box);if(index>0){const cover=element('button','Make cover',box);cover.type='button';cover.className='secondary';cover.onclick=()=>{photos.splice(index,1);photos.unshift(url);dirty=true;renderPhotos();};}const remove=element('button','Remove photo',box);remove.type='button';remove.className='secondary';remove.onclick=()=>{photos.splice(index,1);dirty=true;renderPhotos();};});};
 async function upload(file){
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024||file.size===0)throw Error('Choose a JPG, PNG or WebP image up to 5 MB.');
  const bitmap=await createImageBitmap(file);if(bitmap.width>12000||bitmap.height>12000){bitmap.close();throw Error('Photo dimensions are too large.');}bitmap.close();const path=crypto.randomUUID()+'.'+({'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[file.type]);await request('/storage/v1/object/ak-product-images/'+path,{method:'POST',headers:{'Content-Type':file.type},body:file});return URL_BASE+'/storage/v1/object/public/ak-product-images/'+path;
 }
 function uploadState(delta){uploads+=delta;$('save').disabled=uploads>0;$('cancel').disabled=uploads>0;$('add-option').disabled=uploads>0;}
 $('upload').onchange=async()=>{const files=[...$('upload').files];if(!files.length)return;uploadState(1);try{if(photos.length+files.length>10)throw Error('Maximum 10 gallery photos.');for(const file of files){photos.push(await upload(file));dirty=true;renderPhotos();}message('Photos uploaded. Save the product to publish them.',false,'edit-status');}catch(e){message(e.message,true,'edit-status');}finally{uploadState(-1);$('upload').value='';}};
 function renderVariants(){
  const list=$('variant-list');list.replaceChildren();if(!variantDraft.length)element('p','No options. This product is sold as one design.',list).className='field-help';
  variantDraft.forEach((v,index)=>{const row=element('details',undefined,list);row.className='variant-row';row.open=v.open??!v.existing;row.ontoggle=()=>v.open=row.open;const summary=element('summary',undefined,row);if(v.image)safeImage(v.image,summary);element('strong',v.label||'New option '+(index+1),summary);const grid=element('div',undefined,row);grid.className='variant-grid';for(const [key,label]of [['key','Option code'],['label','Customer-facing name']]){const l=element('label',label,grid),input=element('input',undefined,l);input.value=v[key];input.maxLength=100;input.setAttribute('aria-label',label+' '+(index+1));if(key==='key'&&v.existing)input.readOnly=true;input.oninput=()=>{v[key]=input.value;dirty=true;};}
   if(v.image){safeImage(v.image,row);const remove=element('button','Remove option photo',row);remove.type='button';remove.className='secondary';remove.onclick=()=>{v.image='';dirty=true;renderVariants();};}
   const imageLabel=element('label','Upload photo for this option',row),file=element('input',undefined,imageLabel);file.type='file';file.accept='image/jpeg,image/png,image/webp';file.setAttribute('aria-label','Upload option photo '+(index+1));file.onchange=async()=>{const selected=file.files[0];if(!selected)return;uploadState(1);file.disabled=true;try{v.image=await upload(selected);dirty=true;renderVariants();message('Option photo uploaded. Save to publish.',false,'edit-status');}catch(e){message(e.message,true,'edit-status');}finally{uploadState(-1);file.disabled=false;}};
   const swatchLabel=element('label','Colour swatch',row),swatch=element('input',undefined,swatchLabel);swatch.type='color';swatch.value=v.swatch;swatch.setAttribute('aria-label','Colour swatch '+(index+1));swatch.oninput=()=>{v.swatch=swatch.value;dirty=true;};
   for(const [label,delta]of [['Move up',-1],['Move down',1]]){const b=element('button',label,row);b.type='button';b.className='secondary';b.disabled=index+delta<0||index+delta>=variantDraft.length;b.onclick=()=>{[variantDraft[index],variantDraft[index+delta]]=[variantDraft[index+delta],variantDraft[index]];dirty=true;renderVariants();};}
   const remove=element('button','Remove option',row);remove.type='button';remove.className='secondary';remove.onclick=()=>{variantDraft.splice(index,1);dirty=true;renderVariants();};
  });
 }
 $('add-option').onclick=()=>{if(variantDraft.length>=30){message('Maximum 30 options.',true,'edit-status');return;}variantDraft.push({key:'',label:'',image:'',swatch:'#9b72da',existing:false});dirty=true;renderVariants();};
 $('product').addEventListener('input',()=>dirty=true);
 function canClose(){if(uploads)return false;return !dirty||confirm('Discard your unsaved product changes?');}
 $('cancel').onclick=()=>{if(canClose())$('editor').close();};$('editor').addEventListener('cancel',event=>{if(!canClose())event.preventDefault();});
 $('product').onsubmit=async event=>{
  event.preventDefault();if(uploads)return;$('save').disabled=true;
  try{
   const f=$('product');if(!photos.length)throw Error('Add at least one product photo.');
   const data={...(editing?.data||{}),name:f.elements.name.value.trim(),anime:f.elements.anime.value.trim(),category:f.elements.category.value.trim(),price:Number(f.elements.price.value),original:f.elements.original.value?Number(f.elements.original.value):0,stock:Number(f.elements.stock.value),description:f.elements.description.value.trim(),material:f.elements.material.value.trim(),height:Number(f.elements.height.value)||0,featured:f.elements.featured.checked,new:f.elements.new.checked,availabilityUnconfirmed:f.elements.availabilityUnconfirmed.checked,imageUrl:photos[0],imageUrls:[...photos],optionLabel:f.elements.optionLabel.value};
   const packSize=Number(f.elements.packSize.value),minQty=Number(f.elements.minQty.value);if(!data.name||!data.anime||!data.category||!Number.isFinite(data.price)||data.price<=0||!Number.isInteger(data.stock)||data.stock<0||!Number.isFinite(data.original)||data.original<0||data.original>0&&data.original<data.price||!Number.isInteger(packSize)||packSize<1||packSize>1000||!Number.isInteger(minQty)||minQty<1||minQty>100||!Number.isFinite(data.height)||data.height<0)throw Error('Check the product name, prices, stock, pack quantity and dimensions.');
   if(packSize>1)data.packSize=packSize;else delete data.packSize;if(minQty>1)data.minQty=minQty;else delete data.minQty;data.colors=[];data.designNames={};data.optionImages={};data.optionSwatches={};const seen=new Set();
   for(const v of variantDraft){const key=v.key.trim()||v.label.trim(),label=v.label.trim()||key;if(!key||key.length>100||label.length>100||seen.has(key.toLowerCase())||['__proto__','constructor','prototype'].includes(key))throw Error('Every option needs a unique code and name of up to 100 characters.');seen.add(key.toLowerCase());data.colors.push(key);data.designNames[key]=label;if(v.image){const src=publicImage(v.image);if(!src)throw Error('Option photos must use a secure HTTPS address.');data.optionImages[key]=src;}if(/^#[0-9a-f]{6}$/i.test(v.swatch))data.optionSwatches[key]=v.swatch;}
   if(!data.colors.length){delete data.colors;delete data.optionLabel;}
   const id=editing?.id||'product-'+crypto.randomUUID();data.id=id;
   const result=await request('/rest/v1/ak_products'+(editing?'?id=eq.'+encodeURIComponent(id):''),{method:editing?'PATCH':'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({id,data})});if(result.length!==1)throw Error('Product was not saved.');dirty=false;$('editor').close();await load();message('Saved. Your website and app use this same catalog.');
  }catch(e){message(e.message,true,'edit-status');}finally{$('save').disabled=false;}
 };
 const oldSignOut=signOut;signOut=function(){accounts=[];accountStats=null;reportVersion++;oldSignOut();};
 setupFilter();
})();
