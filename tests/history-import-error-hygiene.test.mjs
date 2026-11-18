// Issue #73: error hygiene for the ChatGPT export importer (site/history-context.mjs).
// A conversations.json export holds private conversation text. When importChatGPTExport rejects
// an export, the error message must be a fixed string that never echoes export content, and
// malformed-but-parseable shapes must be skipped rather than crash with a runtime TypeError
// (whose message could quote a property name or value from the file).
// All fixtures are synthetic. This file tests current behaviour; it changes no source code.
import test from "node:test";
import assert from "node:assert/strict";
import {importChatGPTExport, HISTORY_LIMITS} from "../site/history-context.mjs";

const SECRET = "PRIVATE-FIXTURE-7f3a9c";

function conversation(id, texts, {title = SECRET + " title"} = {}) {
  const mapping = {};
  let parent = null;
  texts.forEach((text, i) => {
    const node = `${id}-n${i}`;
    mapping[node] = {parent, message: {author: {role: i % 2 ? "assistant" : "user"}, content: {parts: [text]}, create_time: 1700000000 + i}};
    parent = node;
  });
  return {id, title, current_node: parent, mapping};
}

function rejectsWithoutEcho(input, expected) {
  let error;
  try { importChatGPTExport(input); } catch (e) { error = e; }
  assert.ok(error, "expected the import to be rejected");
  assert.match(error.message, expected);
  assert.equal(error.message.includes(SECRET), false, "error message must not echo export content");
  assert.equal(error.constructor, Error, "rejection must be a deliberate Error, not a runtime TypeError");
}

test("non-array exports are rejected with a fixed message that does not echo content", () => {
  for (const input of [{[SECRET]: 1}, {conversations: SECRET}, {conversations: {[SECRET]: []}}, SECRET, 42, null, undefined]) {
    rejectsWithoutEcho(input, /^Expected ChatGPT conversations\.json array\.$/);
  }
});

test("over-limit exports are rejected with fixed messages that do not echo content", () => {
  rejectsWithoutEcho(Array.from({length: HISTORY_LIMITS.maxConversations + 1}, () => ({title: SECRET})), /^Export exceeds 5,000 conversations\.$/);

  // Message limit: each conversation chain is capped at 3,000 nodes, so spread messages across conversations.
  const perConversation = 2500;
  const conversations = Math.ceil((HISTORY_LIMITS.maxMessages + 1) / perConversation);
  const many = Array.from({length: conversations}, (_, c) => conversation(`m${c}`, Array.from({length: perConversation}, () => SECRET)));
  rejectsWithoutEcho(many, /^More than 20,000 text messages: select a smaller export\.$/);

  // Character limit: full-length messages until the running total passes the cap.
  const long = SECRET + "x".repeat(HISTORY_LIMITS.maxMessageCharacters - SECRET.length);
  const needed = Math.floor(HISTORY_LIMITS.maxCharacters / HISTORY_LIMITS.maxMessageCharacters) + 1;
  const big = Array.from({length: Math.ceil(needed / perConversation)}, (_, c) => conversation(`c${c}`, Array.from({length: perConversation}, () => long)));
  rejectsWithoutEcho(big, /^History exceeds 12 million characters\.$/);
});

test("malformed but parseable conversation shapes are skipped, never crash", () => {
  const cyclic = {id: "cyc", title: SECRET, current_node: "a", mapping: {
    a: {parent: "b", message: {author: {role: "user"}, content: {parts: [SECRET + " cyclic"]}}},
    b: {parent: "a", message: {author: {role: "assistant"}, content: {parts: ["reply"]}}},
  }};
  const shapes = [
    null, 0, SECRET, [SECRET], {},
    {mapping: SECRET, current_node: 0},
    {mapping: {[SECRET]: null}, current_node: SECRET},
    {mapping: {x: SECRET}, current_node: "x"},
    {mapping: {x: {message: null}}, current_node: "x"},
    {mapping: {x: {message: {author: SECRET, content: SECRET}}}, current_node: "x"},
    {mapping: {x: {message: {author: {role: "user"}, content: {parts: [null, 7, {text: 7}, {[SECRET]: 1}]}}}}, current_node: "x"},
    {mapping: {x: {parent: SECRET, message: {author: {role: "tool"}, content: {text: SECRET}}}}, current_node: "x"},
    {id: {nested: SECRET}, title: ["t"], mapping: {x: {message: {author: {role: "user"}, content: {text: "kept"}, create_time: SECRET}}}, current_node: "x"},
    cyclic,
  ];
  const result = importChatGPTExport(shapes);
  assert.equal(result.stats.conversations, shapes.length);
  assert.equal(result.stats.skipped_branches, 7, "shapes without a usable mapping/current node are skipped");
  assert.deepEqual(result.messages.map(m => m.text).sort(), [SECRET + " cyclic", "kept", "reply"].sort());
  const kept = result.messages.find(m => m.text === "kept");
  assert.equal(kept.date, null, "a non-numeric create_time yields no date rather than an error");
});
