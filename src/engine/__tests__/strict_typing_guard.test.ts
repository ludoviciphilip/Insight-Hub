import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

function findSourceFiles(dir: string, fileList: string[] = []): string[] {
  if (!fs.existsSync(dir)) return fileList;
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) {
      if (!full.includes('__tests__')) {
        findSourceFiles(full, fileList);
      }
    } else if (full.endsWith('.ts') && !full.endsWith('.d.ts')) {
      fileList.push(full);
    }
  }
  return fileList;
}

describe('Strict Typing Guard for src/engine/shared and src/engine/model', () => {
  it('enforces 0 explicit any occurrences in engine/shared and engine/model', () => {
    const root = path.resolve(__dirname, '..');
    const targetDirs = [path.join(root, 'shared'), path.join(root, 'model')];

    const violations: { file: string; line: number; text: string }[] = [];

    for (const dir of targetDirs) {
      const files = findSourceFiles(dir);
      for (const file of files) {
        const content = fs.readFileSync(file, 'utf-8');
        const lines = content.split('\n');

        lines.forEach((line, idx) => {
          const trimmed = line.trim();
          // Skip comment lines
          if (trimmed.startsWith('*') || trimmed.startsWith('//') || trimmed.startsWith('/*')) {
            return;
          }
          // Match explicit any type usage or type cast
          if (/\bany\b/.test(line)) {
            violations.push({
              file: path.relative(path.resolve(root, '..', '..'), file),
              line: idx + 1,
              text: trimmed,
            });
          }
        });
      }
    }

    if (violations.length > 0) {
      const formatted = violations.map(v => `${v.file}:${v.line} -> ${v.text}`).join('\n');
      expect.fail(
        `Regressão de tipagem estrita! Encontrado(s) ${violations.length} uso(s) de 'any' em engine/shared ou engine/model:\n${formatted}`
      );
    }

    expect(violations.length).toBe(0);
  });
});
