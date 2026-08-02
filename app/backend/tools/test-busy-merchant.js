const B='http://localhost:4600';
const j=async(p,o={},tok)=>{const r=await fetch(B+p,{method:o.method||(o.body!==undefined?'POST':'GET'),headers:{'content-type':'application/json',...(tok?{authorization:'Bearer '+tok}:{})},body:o.body!==undefined?JSON.stringify(o.body):undefined});let d=null;try{d=await r.json()}catch{}return{s:r.status,d}};
const topBal=async(tok)=>{const f=(await j('/app/feed',{},tok)).d;const r=f.find(x=>x.operator==='orange_cd'&&!x.quarantined&&x.balance_after!=null);return r?r.balance_after:250000;};
(async()=>{
  const A=(await j('/app/auth/login',{body:{email:'demo@koda.africa',password:'koda-demo'}})).d;
  const codes=[];
  // inject 50 different-payer SMS, each chaining off the TRUE current balance (like a real Sentinel)
  for(let i=0;i<50;i++){
    const amt=2000+i*10;
    const bal=(await topBal(A.token))+amt;
    const ref=`OM.BUSY.${Date.now().toString().slice(-5)}.${i}`; codes.push(ref);
    const sfx=String(1000+i).slice(-4);
    await j('/app/sandbox/sms',{body:{raw:`Vous avez recu ${amt} FC de MERE NGOZI ${String.fromCharCode(65+i%26)}${i} (+2438${sfx}). Ref: ${ref}. Solde: ${bal}`,operator:'orange_cd'}},A.token);
  }
  let verified=0,other=0;const statuses={};
  for(const ref of codes){const v=(await j('/app/verify',{body:{reference:ref}},A.token)).d;statuses[v.status]=(statuses[v.status]||0)+1;v.status==='verified'?verified++:other++;}
  console.log(`busy merchant, 50 different-payer clean payments → ${JSON.stringify(statuses)}`);
  process.exit(verified===50?0:1);
})();
