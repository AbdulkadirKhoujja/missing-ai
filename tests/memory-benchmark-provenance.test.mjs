// Provenance record guard (roadmap #86, Gate D). The external memory benchmark
// note must stay a provenance record: it may not carry a MissingAI result, a
// percentage, or a "confirmed" licence it never verified. This file checks the
// wording of one document only. It runs no benchmark, downloads nothing and
// makes no accuracy claim.
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {dirname,join,resolve} from "node:path";
import {fileURLToPath} from "node:url";

const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const doc=readFileSync(join(root,"docs/MEMORY_BENCHMARK_PROVENANCE.md"),"utf8");

// Splits the document into its "## " sections, keyed by heading text.
function sections(markdown){
  const out=new Map();
  for(const part of markdown.split(/^## /m).slice(1)){
    const newline=part.indexOf("\n");
    out.set(part.slice(0,newline).trim(),part.slice(newline+1));
  }
  return out;
}
const bySection=sections(doc);

// Table rows of one section as {item,state,detail}.
function rows(section){
  return section.split("\n")
    .filter(line=>line.startsWith("| ")&&!line.startsWith("| ---")&&!line.startsWith("| Item"))
    .map(line=>{
      const [item,state,detail]=line.split("|").slice(1,4).map(cell=>cell.trim());
      return {item,state,detail};
    });
}

test("the record says up front that MissingAI has not been run and holds no score",()=>{
  const opening=doc.split("\n").slice(0,6).join("\n");
  assert.match(opening,/MissingAI has not been run on any of these benchmarks/);
  assert.match(opening,/contains no MissingAI score/);
});

test("the record prints no percentage and no decimal score",()=>{
  assert.equal(/\d\s?%/.test(doc),false,"no percentage figures");
  const decimals=[...doc.matchAll(/\b\d+\.\d+\b/g)].map(match=>match[0]);
  // Allowed decimals: arXiv ids, licence versions, the BEAM nugget step and "1.5 million".
  const allowed=new Set(["2402.17753","2410.10813","2510.27246","4.0","0.5","1.5"]);
  assert.deepEqual(decimals.filter(value=>!allowed.has(value)),[]);
});

test("each benchmark has a section with paper, licence, splits and scoring rows",()=>{
  for(const name of ["LoCoMo","LongMemEval","BEAM"]){
    assert.ok(bySection.has(name),`missing section ${name}`);
    const items=rows(bySection.get(name)).map(row=>row.item.toLowerCase());
    for(const needed of ["paper","licence","splits","scoring"]){
      assert.ok(items.some(item=>item.includes(needed)),`${name} needs a ${needed} row`);
    }
  }
});

test("every row declares a state, and unverified licences are not shown as confirmed",()=>{
  for(const name of ["LoCoMo","LongMemEval","BEAM"]){
    for(const row of rows(bySection.get(name))){
      assert.match(row.state,/^(\*\*)?(Confirmed|Not confirmed|Unresolved)/,`${name} / ${row.item}`);
    }
  }
  const licence=name=>rows(bySection.get(name)).filter(row=>/licence/i.test(row.item));
  for(const row of [...licence("LoCoMo"),...licence("LongMemEval")]){
    assert.match(row.state,/Not confirmed/,`${row.item} was not verified in the recorded check`);
  }
  const beam=licence("BEAM");
  assert.match(beam.find(row=>/dataset/i.test(row.item)).state,/^Confirmed/);
  assert.match(beam.find(row=>/code/i.test(row.item)).state,/Not confirmed/);
});

test("omission-detection metrics are marked N/A and the publication gates are present",()=>{
  const scope=bySection.get("What these benchmarks measure, and what they do not");
  assert.match(scope,/precision and recall on these datasets are \*\*N\/A\*\*/);
  const gates=bySection.get("Gates before any MissingAI number on these benchmarks is published");
  assert.equal((gates.match(/^\d\. /gm)||[]).length,5);
  assert.match(gates,/was actually executed/);
  assert.match(gates,/maintainer has reviewed/);
});
