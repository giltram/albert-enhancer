import { existsSync, globSync, readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const files = globSync('src/**/*.{ts,tsx}').map((file) => path.resolve(file));
const graph = new Map(files.map((file) => [file, [] as string[]]));
for (const file of files) {
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  for (const node of source.statements) {
    if (!ts.isImportDeclaration(node) && !ts.isExportDeclaration(node)) continue;
    const specifier = node.moduleSpecifier;
    if (specifier === undefined || !ts.isStringLiteral(specifier) || !specifier.text.startsWith('.')) continue;
    const base = path.resolve(path.dirname(file), specifier.text);
    const target = [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts')].find((candidate) => existsSync(candidate) && graph.has(candidate));
    if (target !== undefined) graph.get(file)!.push(target);
  }
}
const moduleName = (file: string): string => path.relative(path.resolve('src'), file).split(path.sep)[0]!;

describe('source dependency graph (including type-only imports)', () => {
  it('has no direct or indirect file cycle', () => {
    const done = new Set<string>();
    const active: string[] = [];
    function visit(file: string): void {
      if (done.has(file)) return;
      expect(active.includes(file), `Dependency cycle: ${[...active, file].map((item) => path.relative(process.cwd(), item)).join(' → ')}`).toBe(false);
      active.push(file);
      for (const target of graph.get(file) ?? []) visit(target);
      active.pop();
      done.add(file);
    }
    files.forEach(visit);
  });
  it('respects the documented module dependency direction', () => {
    const allowed: Record<string, readonly string[]> = {
      core: ['core'],
      features: ['features', 'core'],
      curricula: ['curricula', 'core'],
      storage: ['storage', 'core', 'features'],
      adapters: ['adapters', 'storage', 'core', 'features', 'curricula'],
      entrypoints: ['entrypoints', 'adapters', 'storage', 'core', 'features', 'curricula'],
    };
    for (const [file, targets] of graph) {
      for (const target of targets) {
        expect(allowed[moduleName(file)], `${path.relative(process.cwd(), file)} → ${path.relative(process.cwd(), target)}`).toContain(moduleName(target));
      }
    }
  });
});
