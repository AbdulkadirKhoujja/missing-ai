import test from "node:test";import assert from "node:assert/strict";import {checkMissing,extractRequirements} from "../shared/checker.mjs";
test("extracts checklists and directives",()=>{const a=extractRequirements("- Must verify signed webhooks\n- Include cancellation flow\n- Provide email receipts");assert.equal(a.length,3);});
test("catches unmentioned criterion conservatively",()=>{const r=checkMissing("- Must verify signed webhooks\n- Include cancellation flow","We included the cancellation flow.");assert.equal(r.summary.needs_review,1);assert.ok(r.findings.some(f=>f.text.includes("webhooks")&&f.status==="needs_review"));});
test("exact coverage",()=>{const r=checkMissing("- Must verify signed webhooks","Must verify signed webhooks");assert.equal(r.summary.text_found,1);});
test("rejects empty inputs",()=>assert.throws(()=>checkMissing("x",""),/required/));
test("bounded inputs",()=>assert.throws(()=>checkMissing("a".repeat(30001),"yes"),/Maximum/));
