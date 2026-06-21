import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = join(__dirname, '..')
const resolveScript = join(projectRoot, 'scripts', 'resolve.js')

const PASS_CASES = [
  { args: ['--song', 'Tim McGraw', '--artist', 'Taylor Swift'] },
  { args: ['--song', 'bad guy', '--artist', 'Billie Eilish'] },
  { args: ['--album', 'Speak Now', '--artist', 'Taylor Swift'] },
  { args: ['--album', 'Hamilton'] },
  { args: ['--album', 'The Greatest Showman Soundtrack'] },
  { args: ['--album', 'Stardew Valley Soundtrack'] },
  { args: ['--album', 'Legally Blonde OBC Recording'] },
  { args: ['--album', 'Anastasia Original Broadway Cast Recording'] },
  {
    args: ['--album', 'Heathers The Musical World Premiere Cast Recording'],
    optional: true,
  },
]

const FAIL_CASES = [
  { args: ['--song', 'fake song title', '--artist', 'Taylor Swift'] },
  { args: ['--album', 'random fake album name 12345'] },
  { args: ['--artist', 'asdfasdfasdf'] },
  { args: ['--album', 'Heathers Original Off-Broadway Cast Recording'] },
]

function runResolve(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn('node', [resolveScript, ...args], {
      cwd: projectRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''

    proc.stdout.on('data', (chunk) => {
      stdout += chunk
    })
    proc.stderr.on('data', (chunk) => {
      stderr += chunk
    })

    proc.on('error', reject)
    proc.on('close', (code) => resolve({ code, stdout, stderr }))
  })
}

function formatArgs(args) {
  return args.join(' ')
}

async function expectPass(testCase) {
  const label = formatArgs(testCase.args)
  const { code, stdout, stderr } = await runResolve(testCase.args)

  let output
  try {
    output = JSON.parse(stdout)
  } catch {
    console.error(`FAIL (pass expected, invalid JSON): ${label}`)
    console.error(stdout || stderr)
    process.exitCode = 1
    return
  }

  if (code !== 0 || output.intent === 'unknown') {
    if (testCase.optional) {
      console.log(`SKIP (optional, not on iTunes): ${label}`)
      return
    }

    console.error(`FAIL (pass expected): ${label}`)
    console.error(JSON.stringify(output, null, 2))
    process.exitCode = 1
    return
  }

  console.log(`PASS: ${label}`)
}

async function expectFail(testCase) {
  const label = formatArgs(testCase.args)
  const { code, stdout, stderr } = await runResolve(testCase.args)

  let output
  try {
    output = JSON.parse(stdout)
  } catch {
    if (code !== 0) {
      console.log(`PASS (failed cleanly): ${label}`)
      return
    }

    console.error(`FAIL (fail expected, invalid JSON): ${label}`)
    console.error(stdout || stderr)
    process.exitCode = 1
    return
  }

  if (code === 0 && output.intent !== 'unknown') {
    console.error(`FAIL (fail expected, got match): ${label}`)
    console.error(JSON.stringify(output, null, 2))
    process.exitCode = 1
    return
  }

  console.log(`PASS (failed cleanly): ${label}`)
}

console.log('Running resolver integration tests against live iTunes API...\n')

for (const testCase of PASS_CASES) {
  await expectPass(testCase)
}

for (const testCase of FAIL_CASES) {
  await expectFail(testCase)
}

if (process.exitCode) {
  console.error('\nIntegration tests failed.')
} else {
  console.log('\nAll integration tests passed.')
}
