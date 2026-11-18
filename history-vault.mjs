// Optional encrypted browser storage. The passphrase is never retained by this module.
const ITERATIONS=310000,encoder=new TextEncoder(),decoder=new TextDecoder();
function toB64(bytes){const pieces=[];for(let i=0;i<bytes.length;i+=8192)pieces.push(String.fromCharCode(...bytes.subarray(i,i+8192)));return btoa(pieces.join("")); }
function fromB64(value){return Uint8Array.from(atob(value),c=>c.charCodeAt(0));}
async function derive(passphrase,salt){
 if(typeof passphrase!=="string"||passphrase.length<12)throw Error("Use a passphrase of at least 12 characters.");
 const material=await crypto.subtle.importKey("raw",encoder.encode(passphrase),"PBKDF2",false,["deriveKey"]);
 return crypto.subtle.deriveKey({name:"PBKDF2",hash:"SHA-256",salt,iterations:ITERATIONS},material,{name:"AES-GCM",length:256},false,["encrypt","decrypt"]);
}
export async function encryptHistory(messages,passphrase){
 if(!Array.isArray(messages)||!messages.length)throw Error("Import a history before saving it.");
 const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
 const key=await derive(passphrase,salt),data=encoder.encode(JSON.stringify({v:1,messages}));
 const encrypted=await crypto.subtle.encrypt({name:"AES-GCM",iv},key,data);
 return {v:1,kdf:"PBKDF2-SHA256",iterations:ITERATIONS,cipher:"AES-256-GCM",salt:toB64(salt),iv:toB64(iv),data:toB64(new Uint8Array(encrypted))};
}
export async function decryptHistory(record,passphrase){
 if(!record||record.v!==1||record.kdf!=="PBKDF2-SHA256"||record.iterations!==ITERATIONS||record.cipher!=="AES-256-GCM")throw Error("Unsupported encrypted history format.");
 try{
  const key=await derive(passphrase,fromB64(record.salt));
  const bytes=await crypto.subtle.decrypt({name:"AES-GCM",iv:fromB64(record.iv)},key,fromB64(record.data));
  const obj=JSON.parse(decoder.decode(bytes));
  if(obj.v!==1||!Array.isArray(obj.messages))throw Error("Invalid encrypted history.");
  return obj.messages;
 }catch(error){
  if(error.message?.startsWith("Use a passphrase"))throw error;
  throw Error("Could not unlock: incorrect passphrase or corrupted local data.");
 }
}
