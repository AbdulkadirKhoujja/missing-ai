// Quickstart accuracy (roadmap #86, Gate C): the agent-memory developer
// quickstart must describe what a developer actually gets when they copy its
// commands. Synthetic and local only: the documented commands are run exactly
// as written, in a private temporary directory, with no network access needed.
// This file checks the document against the commands; it makes no accuracy,
// privacy or benchmark claim about the memory feature itself.
import test from "node:test";
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {existsSync,mkdtempSync,readdirSync,readFileSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {dirname,join,resolve} from "node:path";
import {fileURLToPath} from "node:url";

const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const DOC="docs/AGENT_MEMORY_DEVELOPER_QUICKSTART.md";
const doc=readFileSync(join(root,DOC),"utf8");
const readme=readFileSync(join(root,"README.md"),"utf8");

function shellBlocks(markdown){
  return [...markdown.matchAll(/```sh\n([\s\S]*?)```/g)]
    .flatMap(match=>match[1].split("\n").map(line=>line.trim()).filter(Boolean));
}
const commands=shellBlocks(doc);

// Runs one documented command with a private TMPDIR so leftovers are visible.
function runDocumented(command){
  const [program,...args]=command.split(/\s+/);
  assert.equal(program,"node",`documented command must start with node: ${command}`);
  const scratch=mkdtempSync(join(tmpdir(),"missing-ai-quickstart-check-"));
  try{
    const result=spawnSync(process.execPath,args,{
      cwd:root,
      encoding:"utf8",
      timeout:120_000,
      env:{...process.env,TMPDIR:scratch,TMP:scratch,TEMP:scratch}
    });
    return {...result,leftovers:readdirSync(scratch)};
  }finally{
    rmSync(scratch,{recursive:true,force:true});
  }
}
const demoCommands=commands.filter(command=>/^node scripts\//.test(command));
const runs=new Map();
function run(command){
  if(!runs.has(command)) runs.set(command,runDocumented(command));
  return runs.get(command);
}

test("the quickstart documents runnable commands and every file they name exists",()=>{
  assert.ok(commands.length>=2,"the quickstart must keep a copyable command block");
  assert.ok(demoCommands.length>=1,"at least one demo script must be documented");
  for(const command of commands){
    assert.match(command,/^node (--test )?[\w./-]+\.mjs$/,
      `unexpected command shape (no flags, pipes or network tools expected): ${command}`);
    const file=command.split(/\s+/).at(-1);
    assert.ok(existsSync(join(root,file)),`documented file is missing: ${file}`);
  }
});

test("every repository path quoted in the quickstart exists",()=>{
  const paths=[...doc.matchAll(/`((?:scripts|tests|docs|private-history|shared|server|site)\/[\w./-]+)`/g)]
    .map(match=>match[1]);
  assert.ok(paths.length>=2,"expected the quickstart to quote repository paths");
  for(const path of paths) assert.ok(existsSync(join(root,path)),`quoted path is missing: ${path}`);
});

test("each documented demo command exits cleanly and prints one JSON receipt",()=>{
  for(const command of demoCommands){
    const result=run(command);
    assert.equal(result.status,0,`${command} exited ${result.status}: ${result.stderr}`);
    assert.equal(result.stderr,"",`${command} wrote to stderr`);
    const lines=result.stdout.split("\n").filter(Boolean);
    assert.equal(lines.length,1,`${command} must print exactly one line`);
    const receipt=JSON.parse(lines[0]);
    assert.equal(typeof receipt.example,"string");
    assert.equal(receipt.remote_storage,false,`${command} must report local-only storage`);
  }
});

test("each documented demo command removes its temporary folder, as the quickstart says",()=>{
  assert.match(doc,/remove[s]? the temporary (directory|folders?)/i,
    "the quickstart no longer states the clean-up behaviour this test checks");
  for(const command of demoCommands){
    assert.deepEqual(run(command).leftovers,[],`${command} left files in its temporary directory`);
  }
});

test("receipt fields quoted in the quickstart match the receipt actually printed",()=>{
  const paragraph=doc.split("\n").find(line=>line.startsWith("An expected JSON receipt has"));
  assert.ok(paragraph,"the quickstart must keep its expected-receipt sentence");
  const quoted=[...paragraph.matchAll(/`([a-z_]+): ([^`]+)`/g)].map(match=>[match[1],JSON.parse(match[2])]);
  assert.ok(quoted.length>=6,`expected several quoted receipt fields, found ${quoted.length}`);
  const receipt=JSON.parse(run("node scripts/agent-memory-demo.mjs").stdout);
  for(const [field,expected] of quoted){
    assert.ok(Object.hasOwn(receipt,field),`quoted field is absent from the receipt: ${field}`);
    assert.deepEqual(receipt[field],expected,`quoted value differs from the receipt for ${field}`);
  }
});

test("the append invariant stated in the quickstart holds for the printed receipt",()=>{
  assert.match(doc,/`post_append_history_messages` is exactly `history_messages \+ 1`/);
  const receipt=JSON.parse(run("node scripts/agent-memory-demo.mjs").stdout);
  assert.equal(receipt.history_messages,1);
  assert.equal(receipt.post_append_history_messages,receipt.history_messages+1);
});

test("the receipt does not claim more than the quickstart allows",()=>{
  const receipt=JSON.parse(run("node scripts/agent-memory-demo.mjs").stdout);
  assert.equal(receipt.verified_implementation,false);
  assert.equal(typeof receipt.limitations,"string");
  assert.ok(receipt.limitations.length>0);
  for(const [field,value] of Object.entries(receipt)){
    assert.doesNotMatch(field,/accuracy|score|benchmark|certif/i,
      `receipt field reads like a quality claim: ${field}`);
    if(typeof value==="string"&&field!=="limitations"){
      assert.doesNotMatch(value,/\b(accurate|certified|guaranteed)\b/i);
    }
  }
});

test("tool names quoted in the quickstart are served by the private-history companion",()=>{
  const tools=[...new Set([...doc.matchAll(/`(missing_ai_[a-z_]+)`/g)].map(match=>match[1]))];
  assert.ok(tools.length>=2,"expected the quickstart to name the tools it uses");
  const companion=readFileSync(join(root,"private-history/context-mcp.mjs"),"utf8");
  for(const tool of tools){
    assert.ok(companion.includes(`"${tool}"`),`quoted tool is not defined by the companion: ${tool}`);
  }
});

test("the README points at the same quickstart, command and Node version",()=>{
  assert.ok(readme.includes(`](${DOC})`),"README must link the quickstart");
  const inline=[...readme.matchAll(/`(node scripts\/agent-memory[\w.-]*\.mjs)`/g)].map(match=>match[1]);
  assert.ok(inline.length>=1,"README must keep its copyable demo command");
  for(const command of inline){
    assert.ok(commands.includes(command),`README command is not in the quickstart: ${command}`);
  }
  const engines=JSON.parse(readFileSync(join(root,"package.json"),"utf8")).engines.node;
  const minimum=engines.match(/^>=(\d+)$/)?.[1];
  assert.ok(minimum,`unexpected engines.node format: ${engines}`);
  assert.match(doc,new RegExp(`Node ${minimum}\\+`),"quickstart Node version differs from package.json");
  assert.match(readme,new RegExp(`Node\\.js ${minimum}\\+`),"README Node version differs from package.json");
});

test("status lines keep the demo framed as synthetic and not a hosted service",()=>{
  assert.match(doc,/\*\*Status:\*\*[^\n]*not a new memory API or live hosted service/);
  assert.match(doc,/synthetic/i);
  assert.match(doc,/not\*{0,2} a scored retrieval benchmark/i);
});
