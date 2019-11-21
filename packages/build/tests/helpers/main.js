require('log-process-errors/build/register/ava')

const {
  env: { PRINT },
} = require('process')
const { normalize } = require('path')

const {
  meta: { file: testFile },
} = require('ava')
const execa = require('execa')
const { getBinPath } = require('get-bin-path')
const { magentaBright } = require('chalk')

const { normalizeOutput } = require('./normalize')

const BINARY_PATH = getBinPath({ cwd: __dirname })
const FIXTURES_DIR = normalize(`${testFile}/../fixtures`)

// Run the netlify-build using a fixture directory, then snapshot the output.
// Options:
//  - `flags` {string[]}: CLI flags
//  - `config` {string}: `--config` CLI flag
//  - `cwd` {string}: current directory when calling `netlify-build`
//  - `env` {object}: environment variable
//  - `snapshot` {boolean}: whether to create a snapshot
const runFixture = async function(t, fixtureName, { flags = '', config, cwd, env, debug, snapshot = true } = {}) {
  const configFlag = getConfigFlag(config, fixtureName)
  const binaryPath = await BINARY_PATH
  const { all, exitCode } = await execa.command(`${binaryPath} ${configFlag} ${flags}`, {
    all: true,
    reject: false,
    cwd,
    env,
    timeout: TIMEOUT,
  })

  const isPrint = PRINT === '1'
  doTestAction({ t, all, isPrint, debug, snapshot })

  return { all, exitCode }
}

// 10 minutes timeout
const TIMEOUT = 6e5

// The `config` flag can be overriden, but defaults to the `netlify.yml` inside
// the fixture directory
const getConfigFlag = function(config, fixtureName) {
  if (config === undefined) {
    return `--config ${FIXTURES_DIR}/${fixtureName}/netlify.yml`
  }

  if (config === false) {
    return ''
  }

  return `--config ${config}`
}

// The `PRINT` environment variable can be set to `1` to run the test in print
// mode. Print mode is a debugging mode which shows the test output but does
// not create nor compare its snapshot.
const doTestAction = function({ t, all, isPrint, debug = isPrint, snapshot }) {
  const allA = debug ? all : normalizeOutput(all)

  if (isPrint) {
    return printOutput(t, allA)
  }

  if (snapshot) {
    t.snapshot(allA)
  }
}

const printOutput = function(t, all) {
  console.log(`
${magentaBright.bold(`${LINE}
  ${t.title}
${LINE}`)}

${all}`)
  t.pass()
}

const LINE = '='.repeat(50)

module.exports = { runFixture, FIXTURES_DIR }
