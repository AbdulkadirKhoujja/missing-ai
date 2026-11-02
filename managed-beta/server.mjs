// Run only behind a trusted TLS reverse proxy after identity provider configuration and operator review.
// Separate process and database from the existing Missing AI public checker and personal private-history tunnel.
import http from 'node:http';
import {createManagedBeta} from './mcp.mjs';
if(process.env.MISSING_AI_MANAGED_ENABLED!=='1'){
 process.stderr.write('Managed beta is disabled. This command does not start a public service.\n');process.exit(2);
}
const required=['MISSING_AI_OIDC_ISSUER','MISSING_AI_OIDC_AUDIENCE','MISSING_AI_OIDC_JWKS_URL','MISSING_AI_MCP_RESOURCE','MISSING_AI_MANAGED_DB','MISSING_AI_MANAGED_ENCRYPTION_KEY','MISSING_AI_APPROVAL_ISSUER','MISSING_AI_APPROVAL_PUBLIC_KEY_BASE64'];
for(const key of required)if(!process.env[key]){process.stderr.write('Missing required managed-beta configuration.\n');process.exit(2);}
try{
 const encryptionKey=Buffer.from(process.env.MISSING_AI_MANAGED_ENCRYPTION_KEY,'base64');
 const {handler}=createManagedBeta({issuer:process.env.MISSING_AI_OIDC_ISSUER,audience:process.env.MISSING_AI_OIDC_AUDIENCE,jwksUrl:process.env.MISSING_AI_OIDC_JWKS_URL,resource:process.env.MISSING_AI_MCP_RESOURCE,dbPath:process.env.MISSING_AI_MANAGED_DB,encryptionKey,approvalIssuer:process.env.MISSING_AI_APPROVAL_ISSUER,approvalPublicKey:Buffer.from(process.env.MISSING_AI_APPROVAL_PUBLIC_KEY_BASE64,'base64').toString('utf8'),allowedOrigins:String(process.env.MISSING_AI_ALLOWED_ORIGINS||'').split(',').filter(Boolean)});
 const port=Number(process.env.MISSING_AI_MANAGED_PORT||3443);
 if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Invalid port');
 const server=http.createServer(handler);server.requestTimeout=15_000;server.headersTimeout=10_000;
 server.listen(port,'127.0.0.1',()=>{process.stdout.write('Managed beta listening on private loopback.\n');});
}catch{process.stderr.write('Managed beta startup refused: invalid or unsafe configuration.\n');process.exit(2);}
