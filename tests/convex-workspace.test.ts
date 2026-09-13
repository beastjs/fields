import { describe, expect, test } from 'bun:test'
import { languageForPath, normalizeProjectPath, validateWorkspace } from '../convex/workspace'

const workspace = {
  version: 1 as const,
  project: {
    entry: '/src/main.ts',
    files: {
      '/src/main.ts': '',
      '/src/App.btsx': 'h1 Hello\n'
    }
  },
  activeFile: '/src/App.btsx',
  preview: { width: '100%' as const }
}

describe('Convex workspace validation', () => {
  test('normalizes paths and preserves the frontend v1 wire shape', () => {
    expect(normalizeProjectPath('src/components/../App.btsx')).toBe('/src/App.btsx')
    expect(validateWorkspace(workspace)).toEqual(workspace)
    expect(languageForPath('/src/App.btsx')).toBe('btsx')
    expect(languageForPath('/src/main.ts')).toBe('typescript')
  })

  test('rejects missing entry files and normalized duplicates', () => {
    expect(() => validateWorkspace({
      ...workspace,
      project: { entry: '/missing.ts', files: workspace.project.files }
    })).toThrow('entry file does not exist')
    expect(() => validateWorkspace({
      ...workspace,
      project: {
        ...workspace.project,
        files: { '/src/App.btsx': '', 'src/App.btsx': '', '/src/main.ts': '' }
      }
    })).toThrow('Duplicate normalized path')
  })

  test('enforces the 200-file limit before writes', () => {
    const files = Object.fromEntries(Array.from({ length: 201 }, (_, index) => [`/${index}.ts`, '']))
    expect(() => validateWorkspace({
      ...workspace,
      project: { entry: '/0.ts', files },
      activeFile: '/0.ts'
    })).toThrow('between 1 and 200 files')
  })
})
