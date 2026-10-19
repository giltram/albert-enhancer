import { readFileSync } from 'node:fs';
import { globSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { describe, expect, it } from 'vitest';
import type { EnrollmentOption, ScheduleProblem } from '../../src/core';
import { solveSchedules } from '../../src/core/schedule';

describe('release safety audit', () => {
  it('requests only local storage and NYU HTTPS hosts', () => {
    const config = readFileSync('wxt.config.ts', 'utf8');
    expect(config).toContain("permissions: ['storage']");
    expect(config).toContain("host_permissions: ['https://*.nyu.edu/*']");
    expect(config).not.toMatch(/<all_urls>|webRequest|cookies|history/);
  });

  it('contains no remote-code or dynamic evaluation path', () => {
    const sources = globSync('src/**/*.{ts,tsx}').map((file) => readFileSync(file, 'utf8')).join('\n');
    expect(sources).not.toMatch(/\beval\s*\(|new Function\s*\(|document\.write\s*\(/);
  });

  it('prunes a moderately branching solver problem quickly', () => {
    const options: EnrollmentOption[] = Array.from({ length: 8 }, (_, course) =>
      Array.from({ length: 8 }, (_, option) => ({
        id: `c${course}-o${option}`, courseId: `c${course}`, sectionIds: [`s${course}-${option}`], instructors: [],
        meetings: [{ day: 'monday' as const, startMinute: 480 + option * 60, endMinute: 530 + option * 60 }],
      })),
    ).flat();
    const problem: ScheduleProblem = {
      intents: Array.from({ length: 8 }, (_, course) => ({ courseId: `c${course}`, required: true })),
      options,
      registration: { optionStatuses: {}, excludedOptionIds: [] },
    };
    const started = performance.now();
    const schedules = solveSchedules(problem);
    expect(performance.now() - started).toBeLessThan(2_000);
    expect(schedules.length).toBe(40_320);
  });
});
