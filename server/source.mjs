import https from "node:https";
import dns from "node:dns/promises";
import net from "node:net";

const MAX_PAGE_BYTES=400_000;
function isPublicIPv4(ip) {
  if(net.isIP(ip)!==4) return false;
  const p=ip.split(".").map(Number);
  if(p[0]===0||p[0]===10||p[0]===127||p[0]>=224)return false;
  if(p[0]===169&&p[1]===254)return false;
  if(p[0]===172&&p[1]>=16&&p[1]<=31)return false;
  if(p[0]===192&&p[1]===168)return false;
  if(p[0]===100&&p[1]>=64&&p[1]<=127)return false;
  if(p[0]===192&&p[1]===0)return false;
  if(p[0]===198&&(p[1]===18||p[1]===19))return false;
  if(p[0]===192&&p[1]===0&&p[2]===2)return false;
  if(p[0]===198&&p[1]===51&&p[2]===100)return false;
  if(p[0]===203&&p[1]===0&&p[2]===113)return false;
  return true;
}
export function validatePublicUrl(input) {
  if(typeof input!=="string"||input.length>2048)throw new Error("Enter a valid public HTTPS URL.");
  let u;try{u=new URL(input)}catch{throw new Error("Enter a valid public HTTPS URL.");}
  if(u.protocol!=="https:"||u.username||u.password||(u.port&&u.port!=="443"))throw new Error("Only public HTTPS webpages on the standard port are supported.");
  const h=u.hostname.toLowerCase().replace(/\.$/,"");
  if(!h.includes(".")||h==="localhost"||h.endsWith(".localhost")||h.endsWith(".local")||h.endsWith(".internal")||net.isIP(h))throw new Error("Private hosts and IP addresses are not supported.");
  u.hash="";return u;
}
async function resolvePublicAddress(host) {
  const addresses=await dns.lookup(host,{all:true});
  if(!addresses.length||addresses.some(a=>a.family!==4&&!net.isIP(a.address)))throw new Error("Could not validate the public website.");
  // Use only a pinned, validated public IPv4 address to prevent DNS rebinding.
  const public4=addresses.filter(a=>a.family===4&&isPublicIPv4(a.address));
  if(!public4.length||addresses.some(a=>a.family===4&&!isPublicIPv4(a.address)))throw new Error("Private address destinations are not allowed.");
  return public4[0].address;
}
export function htmlToText(input) {
  const s=String(input||"");
  const extract=s.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
  const html=extract?extract[1]:s;
  const stripped=html.replace(/<!--([\s\S]*?)-->/g," ")
    .replace(/<(script|style|svg|noscript|nav|footer|header)\b[^>]*>[\s\S]*?<\/\1>/gi," ")
    .replace(/<\s*br\s*\/?\s*>|<\/(p|div|li|h[1-6]|tr|section)>/gi,"\n")
    .replace(/<li\b[^>]*>/gi,"\n- ")
    .replace(/<[^>]+>/g," ");
  return stripped.replace(/&(#x[0-9a-f]+|#[0-9]+|amp|lt|gt|quot|apos|nbsp);/gi,(m,e)=>{
    const c=e.toLowerCase();
    if(c[0]==="#"){const code=c.startsWith("#x")?parseInt(c.slice(2),16):parseInt(c.slice(1),10);return code>0&&code<=0x10ffff?String.fromCodePoint(code):" ";}
    return {amp:"&",lt:"<",gt:">",quot:'"',apos:"'",nbsp:" "}[c]||m;
  }).replace(/[^\S\n]+/g," ").replace(/\n\s*\n\s*\n/g,"\n\n").trim().slice(0,30000);
}
// Node 22 may ask custom DNS resolvers for all addresses (options.all=true)
// when automatic family selection is enabled. In that mode callback's second
// argument MUST be an array of {address, family} objects, not a bare string.
// Always return only the previously validated, DNS-pinned IPv4 destination.
export function pinnedIPv4Lookup(address) {
  if(net.isIP(address)!==4)throw new Error("Pinned address must be IPv4.");
  return (_host,options,callback)=>{
    if(typeof options==="function"){callback=options;options={};}
    if(options?.all)callback(null,[{address,family:4}]);
    else callback(null,address,4);
  };
}

export async function fetchPublicSource(input,remaining=3) {
  const url=validatePublicUrl(input),address=await resolvePublicAddress(url.hostname);
  return new Promise((resolve,reject)=>{
    const req=https.request(url,{method:"GET",timeout:8000,headers:{Accept:"text/html,text/plain;q=0.9","User-Agent":"MissingAI/0.1 (public page requirement checker)"},family:4,autoSelectFamily:false,lookup:pinnedIPv4Lookup(address)},async res=>{
      const status=res.statusCode||0;
      if([301,302,303,307,308].includes(status)){
        const target=res.headers.location;res.resume();
        if(!target||remaining<=0)return reject(new Error("Too many redirects."));
        try {resolve(await fetchPublicSource(new URL(target,url).href,remaining-1))}catch(e){reject(e)}
        return;
      }
      if(status!==200){res.resume();return reject(new Error("The source webpage could not be loaded (HTTP "+status+")."));}
      const ct=(res.headers["content-type"]||"").toLowerCase();
      if(!/^(text\/html|text\/plain|application\/xhtml\+xml)/.test(ct)){res.resume();return reject(new Error("Only HTML and plain-text pages are supported."));}
      let length=0,chunks=[];res.on("data",chunk=>{length+=chunk.length;if(length>MAX_PAGE_BYTES){req.destroy(new Error("Page is too large."));return;}chunks.push(chunk)});res.on("end",()=>{
        const raw=Buffer.concat(chunks).toString("utf8");
        const text=ct.startsWith("text/plain")?raw.slice(0,30000):htmlToText(raw);
        if(!text.trim())return reject(new Error("No readable page text was found."));
        resolve({url:url.href,text,content_type:ct});
      });
    });
    req.on("timeout",()=>req.destroy(new Error("Page fetch timed out.")));
    req.on("error",err=>reject(new Error(err.message==="Page is too large."?err.message:"Could not safely fetch the public webpage.")));
    req.end();
  });
}
