import { describe, it, expect } from 'vitest';
import { APP_VERSION, APP_BUILD_DATE, LICENSE_NAME } from '../../version';
import pkg from '../../../package.json';
import fs from 'fs';
import path from 'path';

describe('Version & License Integrity', () => {
  it('APP_VERSION strictly matches package.json.version dynamically', () => {
    expect(APP_VERSION).toBe(pkg.version);
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('APP_BUILD_DATE is a valid ISO date', () => {
    expect(APP_BUILD_DATE).toBeDefined();
    expect(new Date(APP_BUILD_DATE).toString()).not.toBe('Invalid Date');
  });

  it('LICENSE_NAME is configured as The Mutualist License v1.3', () => {
    expect(LICENSE_NAME).toBe('The Mutualist License v1.3');
  });

  it('maintains only LICENSE.md and removes duplicate LICENSE file', () => {
    const rootDir = process.cwd();
    const licenseMdPath = path.join(rootDir, 'LICENSE.md');
    const duplicateLicensePath = path.join(rootDir, 'LICENSE');

    expect(fs.existsSync(licenseMdPath)).toBe(true);
    expect(fs.existsSync(duplicateLicensePath)).toBe(false);

    const licenseContent = fs.readFileSync(licenseMdPath, 'utf-8');
    expect(licenseContent).toContain('The Mutualist License');
  });

  it('README.md references LICENSE.md and does not mention open-source guarantees', () => {
    const rootDir = process.cwd();
    const readmeContent = fs.readFileSync(path.join(rootDir, 'README.md'), 'utf-8');

    expect(readmeContent).toContain('LICENSE.md');
    expect(readmeContent).not.toContain('garantias de código aberto');
    expect(readmeContent).not.toContain('open source guarantees');
  });
});
