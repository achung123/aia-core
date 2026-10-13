import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

describe('vite.config.ts', () => {
  const configPath = resolve(__dirname, '..', 'vite.config.ts');
  const oldConfigPath = resolve(__dirname, '..', 'vite.config.js');

  it('vite.config.ts exists', () => {
    expect(existsSync(configPath)).toBe(true);
  });

  it('vite.config.js is removed', () => {
    expect(existsSync(oldConfigPath)).toBe(false);
  });

  it('uses @vitejs/plugin-react instead of preact', () => {
    const content = readFileSync(configPath, 'utf-8');
    expect(content).toContain("@vitejs/plugin-react");
    expect(content).not.toContain("preact");
  });

  it('uses react() plugin', () => {
    const content = readFileSync(configPath, 'utf-8');
    expect(content).toMatch(/plugins:\s*\[react\(\)\]/);
  });

  it('preserves dev server port 5173 and host 0.0.0.0', () => {
    const content = readFileSync(configPath, 'utf-8');
    expect(content).toContain('port: 5173');
    expect(content).toMatch(/host:\s*['"]0\.0\.0\.0['"]/);
  });

  it('preserves all 7 proxy rules', () => {
    const content = readFileSync(configPath, 'utf-8');
    const requiredProxies = [
      '/games',
      '/players',
      '/stats',
      '/upload',
      '/images',
      '/docs',
      '/openapi.json',
    ];
    for (const proxy of requiredProxies) {
      expect(content).toContain(`'${proxy}'`);
    }
  });

  it('imports defineConfig from vite', () => {
    const content = readFileSync(configPath, 'utf-8');
    expect(content).toContain("import { defineConfig } from 'vite'");
  });
});
