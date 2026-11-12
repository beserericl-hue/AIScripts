import { describe, it, expect } from 'vitest';
import { introItemHasBody, isOfficialPromptOnly, dropEmptyIntroItems } from '../../src/services/introItems';

const PROMPT = 'Describe and provide evidence that the following are adequately addressed in the curriculum:';
describe('introduction drafts that are only CSHSE’s prompt', () => {
  it('NEGATIVE: the official lead-in alone is not a draft (snippet or HTML)', () => {
    expect(isOfficialPromptOnly(PROMPT)).toBe(true);
    expect(introItemHasBody({ snippet: PROMPT })).toBe(false);
    expect(introItemHasBody({ htmlSnippet: `<p><strong>${PROMPT}</strong></p>` })).toBe(false);
    expect(dropEmptyIntroItems({ 'standard-21': { items: [{ snippet: PROMPT }] } } as any)).toEqual({});
  });
  it('POSITIVE: program writing is kept, even when it starts like a prompt', () => {
    const prog = 'Describe the program. The Human Services program at ETSU prepares students for practice through field experience.';
    expect(introItemHasBody({ snippet: prog })).toBe(true);
    expect(introItemHasBody({ snippet: PROMPT + ' Our curriculum addresses these through HDAL 4710.' })).toBe(true);
    expect(introItemHasBody({ htmlSnippet: '<table><tr><td>x</td></tr></table>' })).toBe(true);
    expect(isOfficialPromptOnly('Field experience is central to our program.')).toBe(false);
  });
});
