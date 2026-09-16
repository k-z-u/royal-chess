#!/usr/bin/env node
/**
 * Publish the production build to GitHub Pages.
 *
 *   npm run deploy
 *
 * Builds `dist/`, then force-pushes it to the `gh-pages` branch of the
 * repository's `origin` remote. GitHub Pages serves that branch, so the site
 * is live at https://<owner>.github.io/<repo>/ the moment the push lands.
 *
 * The branch is a disposable artifact branch: it only ever contains the
 * contents of `dist/`, so there is nothing to merge back and no history worth
 * keeping — hence the force push.
 */
import { execFileSync } from 'node:child_process'
import { cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIST = path.join(ROOT, 'dist')

const run = (cmd, args, cwd) =>
  execFileSync(cmd, args, { cwd, stdio: ['ignore', 'pipe', 'inherit'], encoding: 'utf8' })

const remote = run('git', ['remote', 'get-url', 'origin'], ROOT).trim()
if (!remote) {
  console.error('no `origin` remote — point this repo at GitHub first')
  process.exit(1)
}

const staging = mkdtempSync(path.join(tmpdir(), 'royal-chess-pages-'))
try {
  cpSync(DIST, staging, { recursive: true })
  // stop GitHub Pages from running Jekyll over the output
  writeFileSync(path.join(staging, '.nojekyll'), '')

  run('git', ['init', '-q', '-b', 'gh-pages'], staging)
  run('git', ['add', '-A'], staging)
  run(
    'git',
    [
      '-c',
      'user.name=royal-chess deploy',
      '-c',
      'user.email=deploy@users.noreply.github.com',
      'commit',
      '-q',
      '-m',
      `Deploy ${new Date().toISOString()}`,
    ],
    staging,
  )
  run('git', ['remote', 'add', 'origin', remote], staging)
  execFileSync('git', ['push', '-f', '-q', 'origin', 'gh-pages'], { cwd: staging, stdio: 'inherit' })

  const slug = remote.replace(/\.git$/, '').replace(/^.*github\.com[:/]/, '')
  const [owner, repo] = slug.split('/')
  console.log(`\ndeployed → https://${owner}.github.io/${repo}/`)
} finally {
  rmSync(staging, { recursive: true, force: true })
}
