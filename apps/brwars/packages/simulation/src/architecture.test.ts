import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import ts from 'typescript';
import { expect, it } from 'vitest';

const root = dirname(new URL(import.meta.url).pathname);
function sources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory()
      ? sources(path)
      : path.endsWith('.ts') && !path.endsWith('.test.ts')
        ? [path]
        : [];
  });
}
const files = sources(root);
const parsed = (file: string) =>
  ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
it('fachada pública contém apenas exports; módulos internos não dependem dela', () => {
  expect(parsed(join(root, 'index.ts')).statements.every(ts.isExportDeclaration)).toBe(true);
  for (const file of files.filter((file) => file !== join(root, 'index.ts'))) {
    for (const node of parsed(file).statements) {
      if (!ts.isImportDeclaration(node) || !ts.isStringLiteral(node.moduleSpecifier)) continue;
      const target = resolve(dirname(file), node.moduleSpecifier.text);
      expect([root, join(root, 'index')], file).not.toContain(target);
    }
  }
});
it('dependências de execução da simulação são acíclicas e independentes de UI/servidor', () => {
  const graph = new Map<string, string[]>();
  for (const file of files) {
    const dependencies: string[] = [];
    for (const node of parsed(file).statements) {
      if (
        !ts.isImportDeclaration(node) ||
        !ts.isStringLiteral(node.moduleSpecifier) ||
        node.importClause?.isTypeOnly
      )
        continue;
      const spec = node.moduleSpecifier.text;
      expect(spec, file).not.toMatch(/react|phaser|colyseus|apps\//);
      if (!spec.startsWith('.')) continue;
      const base = resolve(dirname(file), spec);
      const target = files.find(
        (candidate) => candidate === `${base}.ts` || candidate === join(base, 'index.ts'),
      );
      if (target) dependencies.push(target);
    }
    graph.set(file, dependencies);
  }
  const visited = new Set<string>();
  function visit(file: string, stack: string[]) {
    expect(stack, `Ciclo: ${[...stack, file].join(' → ')}`).not.toContain(file);
    if (visited.has(file)) return;
    for (const target of graph.get(file) ?? []) visit(target, [...stack, file]);
    visited.add(file);
  }
  for (const file of files) visit(file, []);
});
