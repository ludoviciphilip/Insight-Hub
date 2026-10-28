import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

function getAllSourceFiles(dir: string, fileList: string[] = []): string[] {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.git' && file !== 'dist') {
        getAllSourceFiles(fullPath, fileList);
      }
    } else if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(file)) {
      // Exclude this guard test itself so literal search terms don't self-match
      if (!fullPath.endsWith('centralKeyGuard.test.ts')) {
        fileList.push(fullPath);
      }
    }
  }
  return fileList;
}

describe('Guarda de chave central e endpoints centralizados (BYOK Guard)', () => {
  const rootDir = process.cwd();
  const filesToCheck = [
    path.join(rootDir, 'server.ts'),
    path.join(rootDir, 'vite.config.ts'),
    ...getAllSourceFiles(path.join(rootDir, 'src')),
  ];

  it('não deve conter referências a process.env.GEMINI_API_KEY', () => {
    const forbiddenPattern = ['process', 'env', 'GEMINI_API_KEY'].join('.');
    const violations: string[] = [];

    for (const filePath of filesToCheck) {
      if (!fs.existsSync(filePath)) continue;
      const content = fs.readFileSync(filePath, 'utf-8');
      if (content.includes(forbiddenPattern)) {
        violations.push(path.relative(rootDir, filePath));
      }
    }

    expect(
      violations,
      `Arquivos contendo referência a chave central no process.env: ${violations.join(', ')}`
    ).toEqual([]);
  });

  it('não deve conter referências a VITE_GEMINI', () => {
    const forbidden = ['VITE', 'GEMINI'].join('_');
    const violations: string[] = [];

    for (const filePath of filesToCheck) {
      if (!fs.existsSync(filePath)) continue;
      const content = fs.readFileSync(filePath, 'utf-8');
      if (content.includes(forbidden)) {
        violations.push(path.relative(rootDir, filePath));
      }
    }

    expect(
      violations,
      `Arquivos contendo referência a VITE_GEMINI: ${violations.join(', ')}`
    ).toEqual([]);
  });

  it('não deve conter chamadas para rotas de proxy central /api/ai/', () => {
    const forbidden = ['/', 'api', '/', 'ai', '/'].join('');
    const violations: string[] = [];

    for (const filePath of filesToCheck) {
      if (!fs.existsSync(filePath)) continue;
      const content = fs.readFileSync(filePath, 'utf-8');
      if (content.includes(forbidden)) {
        violations.push(path.relative(rootDir, filePath));
      }
    }

    expect(
      violations,
      `Arquivos contendo rotas de proxy central /api/ai/: ${violations.join(', ')}`
    ).toEqual([]);
  });
});
