#!/usr/bin/env node
require('./colors')
const chalk = require('chalk')
const { getConfigFile } = require('@netlify/config')
const minimist = require('minimist')

const cleanStack = require('../utils/clean-stack')

const build = require('./main')

const args = minimist(process.argv.slice(2))

async function execBuild() {
  console.log(chalk.greenBright.bold(`Starting Netlify Build`))
  console.log()
  // Automatically resolve the config path
  const configPath = await getConfigFile(process.cwd())

  console.log(chalk.cyanBright.bold(`Using config file:`))
  console.log(configPath)
  console.log()
  // Then run build lifecycle
  console.log('process.argv', process.argv)

  // Redact argv so raw API key not exposed
  let skipNext = false
  const newArgv = process.argv.reduce((acc, value) => {
    if (skipNext && (value && value.length > 20)) {
      // length === 64
      skipNext = false
      return acc
    }
    if (value === '--token') {
      skipNext = true
      return acc
    }
    return acc.concat(value)
  }, [])
  console.log('newArgv', newArgv)
  await build(configPath, args, args.token)
}

execBuild()
  .then(() => {
    const sparkles = chalk.cyanBright('(ﾉ◕ヮ◕)ﾉ*:･ﾟ✧')
    console.log(`\n${sparkles} Finished with the build process!\n`)
  })
  .catch(e => {
    console.log()
    console.log(chalk.redBright.bold('┌────────────────────────┐'))
    console.log(chalk.redBright.bold('│  Netlify Build Error!  │'))
    console.log(chalk.redBright.bold('└────────────────────────┘'))
    console.log(chalk.bold(` ${e.message}`))
    console.log()
    console.log(chalk.redBright.bold('┌────────────────────────┐'))
    console.log(chalk.redBright.bold('│      Stack Trace:      │'))
    console.log(chalk.redBright.bold('└────────────────────────┘'))
    console.log(` ${chalk.bold(cleanStack(e.stack))}`)
    console.log()
  })
