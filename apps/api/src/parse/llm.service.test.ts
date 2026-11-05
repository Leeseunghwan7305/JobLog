import assert from 'node:assert/strict';
import { test } from 'node:test';

import { type ClaudeService } from './claude.service';
import { type GroqService } from './groq.service';
import { LlmService } from './llm.service';
import { type OllamaService } from './ollama.service';
import { type ParsedPosting } from './types';

process.env.LLM_PROVIDER = 'groq'; // 기본 tier = groq로 고정

const draft = (confidence: 'high' | 'low'): ParsedPosting => ({
  companyName: 'A',
  position: 'P',
  location: null,
  employmentType: null,
  deadline: null,
  stages: [{ name: '서류', order: 0 }],
  confidence,
});

function makeLlm(opts: {
  groq: ParsedPosting | null;
  claude: ParsedPosting | null;
  claudeEnabled: boolean;
}): { llm: LlmService; claudeCalls: () => number } {
  let claudeCalls = 0;
  const groq = {
    enabled: true,
    parse: () => Promise.resolve(opts.groq),
  } as unknown as GroqService;
  const claude = {
    enabled: opts.claudeEnabled,
    parse: () => {
      claudeCalls++;
      return Promise.resolve(opts.claude);
    },
  } as unknown as ClaudeService;
  const ollama = {
    enabled: false,
    parse: () => Promise.resolve(null),
  } as unknown as OllamaService;
  return { llm: new LlmService(claude, ollama, groq), claudeCalls: () => claudeCalls };
}

test('2-tier: groq high면 에스컬레이션 안 함(claude 켜져 있어도)', async () => {
  const { llm, claudeCalls } = makeLlm({
    groq: draft('high'),
    claude: draft('high'),
    claudeEnabled: true,
  });
  const r = await llm.parse('x');
  assert.equal(r?.confidence, 'high');
  assert.equal(claudeCalls(), 0);
});

test('2-tier: groq low + claude high면 claude로 교체', async () => {
  const strong = draft('high');
  const { llm } = makeLlm({ groq: draft('low'), claude: strong, claudeEnabled: true });
  const r = await llm.parse('x');
  assert.equal(r, strong);
});

test('2-tier: groq low + claude도 low면 기존(groq) 유지', async () => {
  const base = draft('low');
  const { llm } = makeLlm({ groq: base, claude: draft('low'), claudeEnabled: true });
  const r = await llm.parse('x');
  assert.equal(r, base);
});

test('2-tier: claude 비활성이면 에스컬레이션 안 함', async () => {
  const { llm, claudeCalls } = makeLlm({
    groq: draft('low'),
    claude: draft('high'),
    claudeEnabled: false,
  });
  const r = await llm.parse('x');
  assert.equal(r?.confidence, 'low');
  assert.equal(claudeCalls(), 0);
});

test('2-tier: groq null + claude high면 claude로 복구', async () => {
  const strong = draft('high');
  const { llm } = makeLlm({ groq: null, claude: strong, claudeEnabled: true });
  const r = await llm.parse('x');
  assert.equal(r, strong);
});
