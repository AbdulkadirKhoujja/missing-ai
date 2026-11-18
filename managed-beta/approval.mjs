// Verify proof minted by an INDEPENDENT user-authenticated approval portal.
// The MCP model cannot sign these proofs. This module does not implement login or mint proofs.
import {createPublicKey,verify} from 'node:crypto';
const decode=s=>{if(typeof s!=='string'||s.length>4000||!/^[A-Za-z0-9_-]+$/.test(s))throw Error('Invalid approval proof.');try{return JSON.parse(Buffer.from(s,'base64url').toString('utf8'));}catch{throw Error('Invalid approval proof.');}};
export function createApprovalVerifier({publicKey,issuer,audience='missing-ai-managed-approval',now=()=>Date.now()}={}){
 if(typeof issuer!=='string'||!issuer.startsWith('https://')||!publicKey)throw Error('Approval verifier is not configured.');
 const key=createPublicKey(publicKey);
 return async function verifyApproval(proof,{tenant,preview_id}){
  if(typeof proof!=='string'||proof.length>6_000)throw Error('Approval proof missing.');
  const parts=proof.split('.');if(parts.length!==3)throw Error('Invalid approval proof.');
  const head=decode(parts[0]),claims=decode(parts[1]);
  if(head?.alg!=='RS256'||claims?.iss!==issuer||claims.aud!==audience||claims.tenant!==tenant||claims.preview_id!==preview_id||claims.intent!=='save_context'||
     !Number.isSafeInteger(claims.exp)||!Number.isSafeInteger(claims.iat)||claims.exp-claims.iat>300||claims.exp-claims.iat<1||
     claims.iat>now()/1000+30||claims.exp<now()/1000||claims.exp>now()/1000+300)throw Error('Approval is missing, expired or belongs to another draft/user.');
  const verified=verify('RSA-SHA256',Buffer.from(parts[0]+'.'+parts[1]),key,Buffer.from(parts[2],'base64url'));
  if(!verified)throw Error('Invalid approval signature.');
  return true;
 };
}
