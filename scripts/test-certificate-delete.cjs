const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
let approve=false,calls=0,loads=0,result=true,fail=false,messages=[];
const node={};const ctx=vm.createContext({$:()=>node,confirm:()=>approve,message:(s)=>messages.push(s),request:async(p,o)=>{calls++;assert.equal(p,'/rest/v1/rpc/ak_delete_certificate');assert.deepEqual(JSON.parse(o.body),{p_serial:101});if(fail)throw Error('Network failed');return result;}});
vm.runInContext(fs.readFileSync('certificates.js','utf8'),ctx);
ctx.loadCertificates=async()=>{loads++;};
(async()=>{
const button={disabled:false},row={serial:101,product_name:'Figure'};
await ctx.deleteCertificate(row,button);assert.equal(calls,0);
approve=true;await ctx.deleteCertificate(row,button);assert.equal(loads,1);assert.equal(button.disabled,false);
result=false;await ctx.deleteCertificate(row,button);assert.equal(loads,1);assert.match(messages.at(-1),/not confirmed/);
fail=true;await ctx.deleteCertificate(row,button);assert.equal(loads,1);assert.equal(button.disabled,false);
console.log('PASS: certificate deletion cancellation, exact target, confirmed success and failure handling.');
})().catch(e=>{console.error(e);process.exitCode=1;});
