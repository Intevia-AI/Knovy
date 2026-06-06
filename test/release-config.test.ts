import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { describe, it, expect } from 'vitest'
import { load } from 'js-yaml'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function readYaml(relativePath: string): any {
  const raw = readFileSync(resolve(repoRoot, relativePath), 'utf8')
  return load(raw)
}

describe('electron-builder publish target', () => {
  const config = readYaml('apps/app/electron-builder.yml')

  it('publishes via GitHub provider', () => {
    expect(config.publish.provider).toBe('github')
  })

  it('publishes to the Intevia-AI owner', () => {
    expect(config.publish.owner).toBe('Intevia-AI')
  })

  it('publishes to THIS repository (Knovy), not the separate Knovy-Release repo', () => {
    expect(config.publish.repo).toBe('Knovy')
  })
})
