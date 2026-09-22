const BASE = 'http://localhost:3001';
interface S { statement: string; symbol: string; chain: string; address: string }
const SEEDS: S[] = [
  { symbol:'USDC', chain:'ethereum', address:'0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    statement:'$USDC supply growth signals capital waiting to rotate into risk.' },
  { symbol:'USDT', chain:'ethereum', address:'0xdac17f958d2ee523a2206206994597c13d831ec7',
    statement:'$USDT balances are leaving exchanges faster than they arrive.' },
  { symbol:'DAI', chain:'ethereum', address:'0x6b175474e89094c44da98b954eedeac495271d0f',
    statement:'$DAI demand is holding up as on-chain leverage unwinds.' },
  { symbol:'USDC', chain:'base', address:'0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
    statement:'$USDC on Base is growing faster than the chain it bridges from.' },
];
async function run(s: S) {
  const res = await fetch(`${BASE}/api/investigate`, { method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ statement: s.statement, mode:'live', asset: s }) });
  const reader = res.body!.getReader(); const dec = new TextDecoder();
  let buf=''; let id:string|null=null; let err:string|null=null;
  for(;;){ const {done,value}=await reader.read(); if(done) break;
    buf += dec.decode(value,{stream:true});
    const fr = buf.split('\n\n'); buf = fr.pop() ?? '';
    for(const f of fr){
      const ev=f.split('\n').find(l=>l.startsWith('event: '))?.slice(7).trim();
      const dl=f.split('\n').find(l=>l.startsWith('data: '))?.slice(6);
      if(!ev||!dl) continue;
      if(ev==='done') id=JSON.parse(dl).investigationId;
      if(ev==='error') err=JSON.parse(dl).message;
    }}
  if(err) throw new Error(err);
  return id;
}
async function main(){
  for(const s of SEEDS){
    process.stdout.write(`  ${s.symbol.padEnd(6)} ${s.chain.padEnd(9)} `);
    try{
      const id = await run(s);
      await fetch(`${BASE}/api/monitor`,{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({investigationId:id,action:'start',intervalMinutes:10})});
      console.log('→ monitoring on');
    }catch(e){ console.log('→ failed:', (e as Error).message.slice(0,80)); }
  }
  const u=(await (await fetch(`${BASE}/api/usage`)).json()).usage;
  console.log(`\n${u.liveCalls} live calls · ${u.creditsRemaining} credits left`);
}
main();
export {};
