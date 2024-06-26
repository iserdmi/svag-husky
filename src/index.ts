import dedent from 'dedent'
import { promises as fs } from 'fs'
import path from 'path'
import { defineCliApp, getPackageJson, isFileExists, log, setPackageJsonDataItem, spawn } from 'svag-cli-utils'

defineCliApp(async ({ cwd, command, args }) => {
  const createHooksFiles = async () => {
    cwd = path.resolve(cwd, args[0] || '.')
    const { packageJsonDir } = await getPackageJson({ cwd })
    log.green('Creating husky hook files...')
    const source = [
      {
        name: 'pre-commit',
        content: dedent`#!/bin/sh

          pnpm test
          pnpm lint --fix
          pnpm types
        `,
      },
      {
        name: 'commit-msg',
        content: dedent`#!/bin/sh

          sh "$(npm root)/svag-husky/hooks/commit-msg" "$@"
        `,
      },
    ]
    for (const { name, content } of source) {
      const hookPath = path.resolve(packageJsonDir, '.husky', name)
      const { fileExists: hookExists } = await isFileExists({ filePath: hookPath })
      if (hookExists) {
        log.toMemory.black(`${hookPath}: hook file already exists`)
        continue
      }
      await fs.mkdir(path.dirname(hookPath), { recursive: true })
      await fs.writeFile(hookPath, content + '\n')
      log.toMemory.black(`${hookPath}: hook file created`)
    }
  }

  const installDeps = async () => {
    cwd = path.resolve(cwd, args[0] || '.')
    const { packageJsonDir, packageJsonPath } = await getPackageJson({ cwd })
    log.green('Installing dependencies...')
    await spawn({
      cwd: packageJsonDir,
      command: 'pnpm i -D svag-husky@latest husky',
    })
    log.toMemory.black(`${packageJsonPath}: dependencies installed`)
  }

  const initializeHusky = async () => {
    cwd = path.resolve(cwd, args[0] || '.')
    const { packageJsonDir, packageJsonPath } = await getPackageJson({ cwd })
    log.green('Initializing husky...')
    await spawn({
      cwd: packageJsonDir,
      command: 'git init',
    })
    await spawn({
      cwd: packageJsonDir,
      command: 'pnpm husky',
    })
    log.toMemory.black(`${packageJsonPath}: husky initialized`)
  }

  const addPrepareScriptToPackageJson = async () => {
    cwd = path.resolve(cwd, args[0] || '.')
    const { packageJsonDir, packageJsonPath, packageJsonData } = await getPackageJson({ cwd })
    log.green('Adding "prepare" script to package.json...')
    if (!packageJsonData.scripts) {
      packageJsonData.scripts = {}
    }
    const cmd = 'husky'
    if (!packageJsonData.scripts.prepare) {
      await setPackageJsonDataItem({ cwd: packageJsonDir, key: 'scripts.prepare', value: cmd })
      log.toMemory.black(`${packageJsonPath}: script "prepare" added`)
    } else if (packageJsonData.scripts.prepare.includes(cmd)) {
      log.toMemory.black(`${packageJsonPath}: script "prepare" already includes "${cmd}"`)
    } else {
      await setPackageJsonDataItem({
        cwd: packageJsonDir,
        key: 'scripts.prepare',
        value: `${packageJsonData.scripts.prepare} && ${cmd}`,
      })
      log.toMemory.black(`${packageJsonPath}: script "prepare" extended with "${cmd}"`)
    }
  }

  switch (command) {
    case 'install-deps': {
      await installDeps()
      break
    }
    case 'initialize-husky': {
      await initializeHusky()
      break
    }
    case 'create-hooks-files': {
      await createHooksFiles()
      break
    }
    case 'add-preapre-script-to-package-json': {
      await addPrepareScriptToPackageJson()
      break
    }
    case 'init': {
      await installDeps()
      await initializeHusky()
      await createHooksFiles()
      await addPrepareScriptToPackageJson()
      break
    }
    case 'h': {
      log.black(dedent`Commands:
        install-deps
        initialize-husky
        create-hooks-files
        add-preapre-script-to-package-json
        init — all of the above in one command
      `)
      break
    }
    case 'ping': {
      const { packageJsonDir } = await getPackageJson({ cwd })
      await spawn({ cwd: packageJsonDir, command: 'echo pong' })
      break
    }
    default: {
      log.red('Unknown command:', command)
      break
    }
  }
})
