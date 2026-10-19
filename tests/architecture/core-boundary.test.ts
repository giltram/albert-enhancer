import { readFileSync } from 'node:fs';
import { globSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('core architecture boundary', () => {
  it('does not reference browser, Chrome, React, Albert, or the DOM', () => {
    const forbidden = /\b(?:chrome|browser|document|window|HTMLElement|Albert|React)\b/;
    for (const file of globSync('src/core/**/*.ts')) {
      expect(readFileSync(file, 'utf8'), `${file} contains a platform dependency`).not.toMatch(forbidden);
    }
  });
});
