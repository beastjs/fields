import { describe, expect, test } from 'bun:test';
import { normalizePath, VirtualFileSystem } from '../src/playground/virtual-fs';

describe('virtual filesystem', () => {
  test('normalizes nested paths independently of the host OS', () => {
    expect(normalizePath('src\\nested/./../App.btsx')).toBe('/src/App.btsx');
    expect(() => normalizePath('/../../secret')).toThrow('escapes');
    expect(() => normalizePath('https://example.com/a')).toThrow('Invalid');
  });
  test('writes replace, deletes remove, snapshots and lists are deterministic', () => {
    const fs = new VirtualFileSystem();
    fs.write('/b.ts', 'b'); fs.write('/a.ts', 'a'); fs.write('/a.ts', 'updated');
    expect(fs.list()).toEqual(['/a.ts', '/b.ts']);
    expect(fs.read('/a.ts')).toBe('updated');
    const snapshot = fs.snapshot(); snapshot['/a.ts'] = 'external';
    expect(fs.read('/a.ts')).toBe('updated');
    fs.delete('/a.ts');
    expect(fs.exists('/a.ts')).toBe(false);
    expect(fs.read('/missing.ts')).toBeUndefined();
  });
  test('rejects ambiguous normalized input', () => {
    expect(() => new VirtualFileSystem({ 'a.ts': '', '/a.ts': '' })).toThrow('Duplicate');
  });
  test('resolves entries, extensions, index files, parents and generated imports', () => {
    const fs = new VirtualFileSystem({ '/src/main.ts': '', '/src/App.btsx': '', '/lib/index.ts': '' });
    expect(fs.resolve('/src/main')).toBe('/src/main.ts');
    expect(fs.resolve('./App', '/src/main.ts')).toBe('/src/App.btsx');
    expect(fs.resolve('./App.tsrx', '/src/main.ts')).toBe('/src/App.btsx');
    expect(fs.resolve('../lib', '/src/main.ts')).toBe('/lib/index.ts');
    expect(() => fs.resolve('./missing', '/src/main.ts')).toThrow('Cannot resolve');
    expect(() => fs.resolve('unlisted')).toThrow('not included');
  });
});
