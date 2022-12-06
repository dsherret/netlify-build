import { join, relative } from 'path'

import { virtualRoot } from '../../shared/consts.js'
import type { WriteStage2Options } from '../../shared/stage2.js'
import { DenoBridge } from '../bridge.js'
import { Bundle, BundleFormat } from '../bundle.js'
import { wrapBundleError } from '../bundle_error.js'
import { EdgeFunction } from '../edge_function.js'
import { FeatureFlags } from '../feature_flags.js'
import { ImportMap } from '../import_map.js'
import { wrapNpmImportError } from '../npm_import_error.js'
import { getPackagePath } from '../package_json.js'
import { getFileHash } from '../utils/sha256.js'

interface BundleESZIPOptions {
  basePath: string
  buildID: string
  debug?: boolean
  deno: DenoBridge
  distDirectory: string
  externals: string[]
  featureFlags: FeatureFlags
  functions: EdgeFunction[]
  importMap: ImportMap
}

const bundleESZIP = async ({
  basePath,
  buildID,
  debug,
  deno,
  distDirectory,
  externals,
  functions,
  importMap,
}: BundleESZIPOptions): Promise<Bundle> => {
  const extension = '.eszip'
  const destPath = join(distDirectory, `${buildID}${extension}`)
  const { bundler, importMap: bundlerImportMap } = getESZIPPaths()
  const importMapURL = await createUserImportMap(importMap, basePath, distDirectory)
  const payload: WriteStage2Options = {
    basePath,
    destPath,
    externals,
    functions,
    importMapURL,
  }
  const flags = ['--allow-all', '--no-config', `--import-map=${bundlerImportMap}`]

  if (!debug) {
    flags.push('--quiet')
  }

  try {
    await deno.run(['run', ...flags, bundler, JSON.stringify(payload)], { pipeOutput: true })
  } catch (error: unknown) {
    throw wrapBundleError(wrapNpmImportError(error), { format: 'eszip' })
  }

  const hash = await getFileHash(destPath)

  return { extension, format: BundleFormat.ESZIP2, hash, importMapURL }
}

// Takes an import map, writes it to a file on disk, and gets its URL relative
// to the ESZIP root (i.e. using the virtual root prefix).
const createUserImportMap = async (importMap: ImportMap, basePath: string, distDirectory: string) => {
  const destPath = join(distDirectory, 'import_map.json')

  await importMap.writeToFile(destPath)

  const relativePath = relative(basePath, destPath)
  const importMapURL = new URL(relativePath, virtualRoot)

  return importMapURL.toString()
}

const getESZIPPaths = () => {
  const denoPath = join(getPackagePath(), 'deno')

  return {
    bundler: join(denoPath, 'bundle.ts'),
    importMap: join(denoPath, 'vendor', 'import_map.json'),
  }
}

export { bundleESZIP as bundle }
