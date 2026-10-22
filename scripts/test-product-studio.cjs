const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
class El{constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.dataset={};this.classList={toggle(){},add(){}};this.value='';this.elements={};this.style={};}append(...es){this.children.push(...es)}replaceChildren(...es){this.children=es}setAttribute(k,v){this[k]=v}addEventListener(){}reset(){}showModal(){this.open=true}close(){this.open=false}}
const nodes=new Map();const $=id=>{if(!nodes.has(id))nodes.set(id,new El());return nodes.get(id)};
for(const name of ['name','anime','category','price','stock','description','material','height','original','packSize','minQty','optionLabel','featured','new','availabilityUnconfirmed'])$('product').elements[name]=new El('input');
let writes=[],errors=[];
const context={console,URL,URLSearchParams,location:{search:""},Blob,Date,Set,Map,JSON,structuredClone,crypto:require('node:crypto').webcrypto,setTimeout,clearTimeout,confirm:()=>false,$,money:n=>'₹'+n,document:{createElement:t=>new El(t),createTextNode:t=>t,querySelectorAll:()=>[]},window:{addEventListener(){}},element:(tag,text,parent)=>{const el=new El(tag);el.textContent=text;if(parent)parent.append(el);return el},safeImage:(src,parent)=>{if(src)parent.append(new El('img'))},load:async()=>{},render(){},renderOverview(){},edit(){},renderPhotos(){},signOut(){},readAll:async()=>[],message:(t,error)=>{if(error)errors.push(t)},request:async(path,options)=>{writes.push({path,data:JSON.parse(options.body)});return [{id:'saved'}]},URL_BASE:'https://example.supabase.co',session:{},tab:'products',rows:[],overview:{products:[],orders:[]},photos:[],editing:null,busy:false};
vm.createContext(context);vm.runInContext(fs.readFileSync('modern-admin.js','utf8'),context);
async function save(p){writes=[];errors=[];context.edit({id:p.id,data:p});await $('product').onsubmit({preventDefault(){}});return writes[0]?.data?.data;}
(async()=>{
 let p={id:'test',name:'Katana',anime:'Demon Slayer',category:'Swords',price:1299,original:2499,stock:20,description:'Original',imageUrl:'https://example.com/photo.jpg',colors:['Design 01','Design 02'],designNames:{'Design 01':'Sanemi','Design 02':'Zenitsu'},optionImages:{'Design 01':'https://example.com/sanemi.jpg'},optionSwatches:{'Design 01':'#123456'},optionLabel:'Design',preserveUnknownField:{value:123}};
 let data=await save(p);assert.equal(data.price,1299);assert.equal(data.stock,20);assert.deepEqual(JSON.parse(JSON.stringify(data.preserveUnknownField)),{value:123});assert.equal(data.optionImages['Design 01'],'https://example.com/sanemi.jpg');assert.equal(data.designNames['Design 02'],'Zenitsu');assert(!data.packSize);assert(!data.minQty);assert.deepEqual(p.colors,['Design 01','Design 02']);
 data=await save({...p,colors:undefined,designNames:undefined,optionImages:undefined});assert(!('colors' in data));assert.equal(data.imageUrls.length,1);
 await save({...p,colors:['Blue','blue']});assert.equal(writes.length,0);assert(errors.some(e=>e.includes('unique code')));
 await save({...p,colors:['constructor']});assert.equal(writes.length,0);
 await save({...p,price:-1});assert.equal(writes.length,0);
 await save({...p,original:1000});assert.equal(writes.length,0);
 data=await save({...p,packSize:20,minQty:2,featured:true,new:true,availabilityUnconfirmed:true});assert.equal(data.packSize,20);assert.equal(data.minQty,2);assert.equal(data.featured,true);assert.equal(data.availabilityUnconfirmed,true);
 console.log('PASS: existing prices/stock/unknown fields preserved; option photo/name serialization; no-option products; duplicate/prototype rejection; price validation; pack/availability controls. No live writes.');
})().catch(e=>{console.error(e);process.exitCode=1});

