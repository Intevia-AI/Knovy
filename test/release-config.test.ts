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

  it('auto-publishes (releaseType: release) so tagged builds go live without a manual draft step', () => {
    expect(config.publish.releaseType).toBe('release')
  })
})

describe('release workflow', () => {
  const workflow = readYaml('.github/workflows/release.yml')
  const buildStep = workflow.jobs.release.steps.find(
    (step: any) => step.name === 'Build and Publish',
  )

  it('has a Build and Publish step', () => {
    expect(buildStep).toBeDefined()
  })

  it('uses the built-in GITHUB_TOKEN, not a personal RELEASE_PAT', () => {
    expect(buildStep.env.GITHUB_TOKEN).toBe('${{ secrets.GITHUB_TOKEN }}')
  })

  it('grants the release job contents:write so GITHUB_TOKEN can create releases', () => {
    expect(workflow.jobs.release.permissions.contents).toBe('write')
  })

  it('verifies the pushed tag matches the app version before building', () => {
    const guard = workflow.jobs.release.steps.find(
      (step: any) =>
        typeof step.name === 'string' &&
        /tag/i.test(step.name) &&
        /version/i.test(step.name),
    )
    expect(guard).toBeDefined()
    expect(guard.run).toContain('package.json')
  })
})

describe('staging workflow', () => {
  const stagingPath = '.github/workflows/staging.yml'
  const readStaging = () => readYaml(stagingPath)
  const stagingSteps = () => {
    const wf = readStaging()
    const job: any = Object.values(wf.jobs)[0]
    return job.steps as any[]
  }

  it('triggers on push to the stg branch', () => {
    const wf = readStaging()
    const on = wf.on ?? wf[true] // js-yaml may coerce the `on` key
    expect(on.push.branches).toContain('stg')
  })
})

describe('no leftover references to the external release setup', () => {
  const files = ['.github/workflows/release.yml', 'apps/app/electron-builder.yml']

  for (const file of files) {
    const raw = readFileSync(resolve(repoRoot, file), 'utf8')

    it(`${file} does not mention the separate Knovy-Release repo`, () => {
      expect(raw).not.toContain('Knovy-Release')
    })

    it(`${file} does not reference the personal RELEASE_PAT secret`, () => {
      expect(raw).not.toContain('RELEASE_PAT')
    })
  }
})
