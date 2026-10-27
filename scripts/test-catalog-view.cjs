const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
class El{constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.dataset={};this.classList={toggle(){},add(){},remove(){}};this.value='';this.elements={};this.style={};}append(...es){this.children.push(...es);for(const e of es)if(e&&typeof e==='object')e.parentElement=this}replaceChildren(...es){this.children=es}setAttribute(k,v){this[k]=v}addEventListener(){}reset(){}showModal(){this.open=true}close(){this.open=false}}
const nodes=new Map();const $=id=>{if(!nodes.has(id))nodes.set(id,new El());return nodes.get(id)};
for(const name of ['name','anime','category','price','stock','description','material','height','original','packSize','minQty','optionLabel','featured','new','availabilityUnconfirmed'])$('product').elements[name]=new El('input');
let writes=[],errors=[];
const context={console,URL,URLSearchParams,location:{search:""},Blob,Date,Set,Map,JSON,structuredClone,crypto:require('node:crypto').webcrypto,setTimeout,clearTimeout,confirm:()=>false,$,money:n=>'₹'+n,document:{createElement:t=>new El(t),createTextNode:t=>t,querySelector:()=>new El('nav'),querySelectorAll:()=>[]},window:{addEventListener(){}},element:(tag,text,parent)=>{const el=new El(tag);el.textContent=text;if(parent)parent.append(el);return el},safeImage:(src,parent)=>{if(src)parent.append(new El('img'))},load:async()=>{},render(){},renderOverview(){},edit(){},renderPhotos(){},signOut(){},readAll:async()=>[],message:(t,error)=>{if(error)errors.push(t)},request:async(path,options)=>{writes.push({path,data:JSON.parse(options.body)});return [{id:'saved'}]},URL_BASE:'https://example.supabase.co',session:{},tab:'products',rows:[],overview:{products:[],orders:[]},photos:[],editing:null,busy:false};
const filters=new El();const filterLabel=new El('label');filters.append(filterLabel);filterLabel.append($('view-filter'));
vm.createContext(context);vm.runInContext(fs.readFileSync('modern-admin.js','utf8'),context);

vm.runInContext(fs.readFileSync('app.js','utf8').split('function filteredRows(items,kind){')[1].split('function render(){')[0].replace(/^/, 'function filteredRows(items,kind){'),context);
const products=Array.from({length:26},(_,i)=>({id:'p'+i,data:{id:'p'+i,name:'Product '+String(i).padStart(2,'0'),price:i+1,stock:i%3===0?0:20,featured:i%2===0,colors:i%5===0?['Blue']:undefined,imageUrl:'https://example.com/'+i+'.jpg'}}));
context.rows=products;context.overview.products=products;
$('filter').value='all';$('sort').value='default';context.render();
function descendants(el,predicate){return el.children.flatMap(c=>c&&typeof c==='object'?[...(predicate(c)?[c]:[]),...descendants(c,predicate)]:[])}
function productRows(){return descendants($('list'),e=>e.tagName==='TBODY')[0]?.children||[]}
assert.equal(productRows().length,26);assert.equal($('result-count').textContent,'26 of 26 products');assert.equal($('record-count').textContent,'All products shown');
$('search').value='Product 25';context.render();assert.equal(productRows().length,1);assert(productRows()[0].children[1].children[0].children[1].children[0].textContent.includes('25'));
$('filter').value='out-of-stock';$('view-filter').value='featured';$('sort').value='price-high';
const reset=filters.children.find(e=>e.id==='show-all-products');reset.onclick();assert.equal(productRows().length,26);assert.equal($('search').value,'');assert.equal($('filter').value,'all');assert.equal($('sort').value,'default');
$('filter').value='out-of-stock';$('filter').onchange();assert.equal(productRows().length,9);assert.equal($('record-count').textContent,'17 hidden by filters');
$('filter').value='all';$('view-filter').value='featured';context.render();assert.equal(productRows().length,13);
$('view-filter').value='all';$('sort').value='price-high';$('sort').onchange();assert.equal(productRows()[0].children[2].textContent,'₹26');
vm.runInContext(fs.readFileSync('app.js','utf8').split('function configureFilters(selected){')[1].split('function filteredRows')[0].replace(/^/, 'function configureFilters(selected){'),context);$('filter').datasetTab='products';context.configureFilters('products');assert.equal($('list').className,'product-list','Quiet refresh must retain the table layout');assert.equal(productRows().length,26,'Quiet refresh must retain existing product DOM');
let edited;context.edit=r=>edited=r;productRows()[0].children[5].children[0].onclick();assert.equal(edited.id,'p25');
context.busy=true;const before=$('list').children[0];context.tab='accounts';context.load().then(()=>{assert.equal($('list').children[0],before);console.log('PASS: all 26 rows rendered; search, combined filters, reset, sorting, edit mapping and busy-load guard.');}).catch(e=>{console.error(e);process.exitCode=1});
