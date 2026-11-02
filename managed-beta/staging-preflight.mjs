// Operator-only HTTPS/OIDC metadata gate for an isolated, disabled-by-default managed beta.
// Does not start a server, create users, consume access tokens or store private content.
import {isIP} from 'node:net';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';

function httpsUrl(value,name){
 if(typeof value!=='string'||value.length>500)throw Error(name+' must be a configured HTTPS URL.');
 let u;try{u=new URL(value);}catch{throw Error(name+' must be a configured HTTPS URL.');}
 if(u.protocol!=='https:'||u.username||u.password||u.hash||u.search||!u.hostname||
    u.hostname==='localhost'||u.hostname.endsWith('.localhost')||u.hostname.endsWith('.local')||u.hostname.endsWith('.internal')||isIP(u.hostname.replace(/^\[|\]$/g,'')))throw Error(name+' must be a public HTTPS hostname without credentials.');
 return u.href;
}
async function jsonWithin(response,limit){
 if(!response.ok||Number(response.headers.get('content-length')||0)>limit||!response.body)throw Error('Provider metadata unavailable.');
 const reader=response.body.getReader();let size=0;const chunks=[];
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel().catch(()=>{});throw Error('Provider metadata too large.');}chunks.push(Buffer.from(value));}
 let result;try{result=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw Error('Provider metadata invalid.');}
 if(!result||typeof result!=='object'||Array.isArray(result))throw Error('Provider metadata invalid.');
 return result;
}
export async function checkStagingProvider({issuer,audience,jwksUrl,resource,authorizationUrl,tokenUrl,portalOrigin,redirectUri,clientId,fetchImpl=fetch}={}){
 issuer=httpsUrl(issuer,'Issuer');resource=httpsUrl(resource,'MCP resource');
 audience=httpsUrl(audience,'OAuth audience');jwksUrl=httpsUrl(jwksUrl,'JWKS');
 authorizationUrl=httpsUrl(authorizationUrl,'Authorization endpoint');tokenUrl=httpsUrl(tokenUrl,'Token endpoint');
 portalOrigin=httpsUrl(portalOrigin,'Portal origin');redirectUri=httpsUrl(redirectUri,'OIDC callback');
 if(!clientId||typeof clientId!=='string'||clientId.length>300)throw Error('OIDC client ID is required.');
 if(audience!==resource)throw Error('The token audience must match the MCP resource identifier.');
 const portal=new URL(portalOrigin),callback=new URL(redirectUri);
 if(portal.href!==portal.origin+'/'||callback.origin!==portal.origin||callback.pathname!=='/approve/callback')throw Error('The OIDC callback must be on the portal origin.');
 const discovery=issuer.replace(/\/$/,'')+'/.well-known/openid-configuration';
 const get=async(url,limit)=>{
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),5000);
  try{return await jsonWithin(await fetchImpl(url,{method:'GET',redirect:'error',signal:controller.signal,headers:{accept:'application/json'}}),limit);}
  finally{clearTimeout(timer);}
 };
 let metadata,jwks;
 try{metadata=await get(discovery,32_768);jwks=await get(jwksUrl,32_768);}
 catch{throw Error('Provider metadata or signing keys could not be verified.');}
 if(metadata.issuer!==issuer||metadata.authorization_endpoint!==authorizationUrl||
    metadata.token_endpoint!==tokenUrl||metadata.jwks_uri!==jwksUrl)throw Error('Provider discovery does not match the pinned configuration.');
 if(!Array.isArray(metadata.code_challenge_methods_supported)||!metadata.code_challenge_methods_supported.includes('S256'))throw Error('Provider must advertise PKCE S256.');
 if(!Array.isArray(metadata.response_types_supported)||!metadata.response_types_supported.includes('code'))throw Error('Provider must support authorization code flow.');
 if(!Array.isArray(jwks.keys)||!jwks.keys.some(k=>k?.kty==='RSA'&&typeof k.kid==='string'&&k.kid.length<=128&&typeof k.n==='string'&&k.n.length>100&&typeof k.e==='string'&&k.e.length>0&&(!k.alg||k.alg==='RS256')&&k.use!=='enc'))throw Error('Provider must publish usable RS256 signing keys.');
 return {metadata:'verified',pkce:'S256',authorization_code:true,rs256_keys:true,configured_resource:resource,client_registration:metadata.client_id_metadata_document_supported===true?'cimd-supported':typeof metadata.registration_endpoint==='string'?'dcr-supported':'requires-pre-registered-client',real_login_tested:false,two_account_tested:false};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const env=process.env;
 try{
  const result=await checkStagingProvider({issuer:env.MISSING_AI_OIDC_ISSUER,audience:env.MISSING_AI_OIDC_AUDIENCE,jwksUrl:env.MISSING_AI_OIDC_JWKS_URL,resource:env.MISSING_AI_MCP_RESOURCE,authorizationUrl:env.MISSING_AI_OIDC_AUTHORIZATION_URL,tokenUrl:env.MISSING_AI_OIDC_TOKEN_URL,portalOrigin:env.MISSING_AI_PORTAL_ORIGIN,redirectUri:env.MISSING_AI_PORTAL_REDIRECT_URI,clientId:env.MISSING_AI_OIDC_CLIENT_ID});
  process.stdout.write('STAGING_PROVIDER_METADATA_VERIFIED '+JSON.stringify({pkce:result.pkce,registration:result.client_registration,login_tested:false})+'\n');
 }catch{process.stderr.write('STAGING_PROVIDER_PREFLIGHT_FAILED: review OIDC settings and published discovery metadata.\n');process.exitCode=2;}
}
