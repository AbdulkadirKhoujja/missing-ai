// Authenticated managed-beta resource-server verifier. No password handling or OAuth issuer here.
import {createHash,createPublicKey,verify} from 'node:crypto';

export class AuthError extends Error { constructor(message='Unauthorized', status=401){super(message);this.name='AuthError';this.status=status;} }
const decodeJson=raw=>{
  if(typeof raw!=='string'||raw.length>8192||!/^[A-Za-z0-9_-]+$/.test(raw))throw new AuthError();
  try{return JSON.parse(Buffer.from(raw,'base64url').toString('utf8'));}catch{throw new AuthError();}
};
function isObj(x){return x!==null&&typeof x==='object'&&!Array.isArray(x);}
function within(x,limit=256){return typeof x==='string'&&x.length>0&&x.length<=limit;}
function validConfig({issuer,audience,jwksUrl}){
  for(const [label,url] of [['issuer',issuer],['audience',audience],['JWKS',jwksUrl]]){
    if(!within(url,500))throw Error('Missing managed-beta '+label+' configuration.');
    const parsed=new URL(url);
    if(parsed.protocol!=='https:'||parsed.username||parsed.password||parsed.hash)throw Error('Managed-beta auth URLs must be HTTPS.');
  }
}
export function createVerifier({issuer,audience,jwksUrl,fetchImpl=fetch,clock=()=>Date.now(),cacheMs=300_000}={}){
  validConfig({issuer,audience,jwksUrl});
  let cached=null,until=0,lastFetch=0,pending=null;
  async function getKeys(force=false){
    if(!force&&cached&&clock()<until)return cached;
    // Random untrusted kid values must not turn this endpoint into a JWKS request amplifier.
    if(force&&cached&&clock()-lastFetch<30_000)return cached;
    if(pending)return pending;
    pending=downloadKeys();
    try{return await pending;}finally{pending=null;}
  }
  async function downloadKeys(){
    const ctl=new AbortController();const timeout=setTimeout(()=>ctl.abort(),4000);
    try{
      const res=await fetchImpl(jwksUrl,{method:'GET',redirect:'error',signal:ctl.signal,headers:{accept:'application/json'}});
      if(!res.ok||Number(res.headers.get('content-length')||0)>32_768)throw Error('Invalid JWKS response.');
      const buffer=Buffer.from(await res.arrayBuffer());
      if(buffer.length>32_768)throw Error('JWKS response too large.');
      const parsed=JSON.parse(buffer.toString('utf8'));
      if(!Array.isArray(parsed.keys)||parsed.keys.length>16)throw Error('Invalid JWKS.');
      cached=parsed.keys.filter(k=>isObj(k)&&k.kty==='RSA'&&within(k.kid,128)&&k.use!=='enc'&&(!k.alg||k.alg==='RS256'));
      lastFetch=clock();until=clock()+Math.min(Math.max(cacheMs,1000),300_000);
      return cached;
    }catch{throw new AuthError('Token verification unavailable',503);}
    finally{clearTimeout(timeout);}
  }
  return async function verifyToken(authorization,scopes=[]){
    if(typeof authorization!=='string'||authorization.length>12_000||!/^Bearer [A-Za-z0-9_.-]+$/.test(authorization))throw new AuthError();
    const token=authorization.slice(7);const parts=token.split('.');
    if(parts.length!==3||parts.some(x=>x.length===0))throw new AuthError();
    const head=decodeJson(parts[0]),claims=decodeJson(parts[1]);
    if(!isObj(head)||head.alg!=='RS256'||!within(head.kid,128)||!isObj(claims))throw new AuthError();
    const now=clock()/1000;
    if(claims.iss!==issuer||!(claims.aud===audience||(Array.isArray(claims.aud)&&claims.aud.includes(audience)))||
       !within(claims.sub,256)||!Number.isSafeInteger(claims.exp)||claims.exp<now-30||
       claims.exp>now+7200||claims.nbf!==undefined&&(!Number.isSafeInteger(claims.nbf)||claims.nbf>now+30)||
       claims.iat!==undefined&&(!Number.isSafeInteger(claims.iat)||claims.iat>now+30))throw new AuthError();
    const scopeSet=new Set(typeof claims.scope==='string'?claims.scope.split(/\s+/).filter(Boolean):Array.isArray(claims.scp)?claims.scp:[]);
    if(scopes.some(s=>!scopeSet.has(s)))throw new AuthError('Insufficient scope',403);
    let keys=await getKeys();let key=keys.find(k=>k.kid===head.kid);
    if(!key){keys=await getKeys(true);key=keys.find(k=>k.kid===head.kid);}
    if(!key)throw new AuthError();
    let valid=false;
    try{valid=verify('RSA-SHA256',Buffer.from(parts[0]+'.'+parts[1]),createPublicKey({key,format:'jwk'}),Buffer.from(parts[2],'base64url'));}catch{throw new AuthError();}
    if(!valid)throw new AuthError();
    // Raw sub is never accepted from tool arguments or stored in the private-history database.
    const tenant=createHash('sha256').update(issuer+'\0'+claims.sub).digest('hex');
    return {tenant,scopes:scopeSet};
  };
}
