import test from 'node:test';
import assert from 'node:assert/strict';
import {checkStagingProvider} from '../managed-beta/staging-preflight.mjs';
const c={issuer:'https://login.example.org/',audience:'https://context.example.org/',resource:'https://context.example.org/',jwksUrl:'https://login.example.org/jwks',authorizationUrl:'https://login.example.org/authorize',tokenUrl:'https://login.example.org/token',portalOrigin:'https://context.example.org/',redirectUri:'https://context.example.org/approve/callback',clientId:'test-client'};
function mock(overrides={}){
 const meta={issuer:c.issuer,authorization_endpoint:c.authorizationUrl,token_endpoint:c.tokenUrl,jwks_uri:c.jwksUrl,code_challenge_methods_supported:['S256'],response_types_supported:['code'],client_id_metadata_document_supported:true,...overrides};
 return async url=>new Response(JSON.stringify(url===c.jwksUrl?{keys:[{kty:'RSA',kid:'staging-key',alg:'RS256',use:'sig',n:'N'.repeat(150),e:'AQAB'}]}:meta),{headers:{'content-type':'application/json'}});
}
test('valid pinned synthetic discovery checks metadata only',async()=>{
 const x=await checkStagingProvider({...c,fetchImpl:mock()});
 assert.equal(x.metadata,'verified');assert.equal(x.client_registration,'cimd-supported');
 assert.equal(x.real_login_tested,false);assert.equal(x.two_account_tested,false);
});
test('rejects missing S256 even with otherwise valid discovery',async()=>{
 await assert.rejects(checkStagingProvider({...c,fetchImpl:mock({code_challenge_methods_supported:['plain']})}),/PKCE S256/);
});
test('rejects mismatched resource audience',async()=>{
 await assert.rejects(checkStagingProvider({...c,audience:'https://unrelated.example.org/',fetchImpl:mock()}),/audience/);
});
test('rejects mismatched issuer or signing endpoint',async()=>{
 await assert.rejects(checkStagingProvider({...c,fetchImpl:mock({issuer:'https://unexpected.example.org/'})}),/discovery does not match/);
 await assert.rejects(checkStagingProvider({...c,fetchImpl:mock({jwks_uri:'https://unknown.example.org/jwks'})}),/discovery does not match/);
});
test('rejects HTTP, internal IPs and incorrect callback origin',async()=>{
 await assert.rejects(checkStagingProvider({...c,issuer:'http://login.example.org/',fetchImpl:mock()}),/HTTPS/);
 await assert.rejects(checkStagingProvider({...c,jwksUrl:'https://127.0.0.1/jwks',fetchImpl:mock()}),/public HTTPS/);
 await assert.rejects(checkStagingProvider({...c,jwksUrl:'https://[::1]/jwks',fetchImpl:mock()}),/public HTTPS/);
 await assert.rejects(checkStagingProvider({...c,redirectUri:'https://elsewhere.example.org/approve/callback',fetchImpl:mock()}),/OIDC callback/);
});
test('rejects oversized discovery response',async()=>{
 const fetchImpl=async()=>new Response('{'.repeat(40_000));
 await assert.rejects(checkStagingProvider({...c,fetchImpl}),/could not be verified/);
});
test('refuses keysets without usable RS256 signing keys',async()=>{
 const fetchImpl=async url=>new Response(JSON.stringify(url===c.jwksUrl?{keys:[]}:{issuer:c.issuer,authorization_endpoint:c.authorizationUrl,token_endpoint:c.tokenUrl,jwks_uri:c.jwksUrl,code_challenge_methods_supported:['S256'],response_types_supported:['code']}));
 await assert.rejects(checkStagingProvider({...c,fetchImpl}),/RS256 signing keys/);
});
