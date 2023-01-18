const webpack = require('webpack')
const CommonJsRequireDependency = require('webpack/lib/dependencies/CommonJsRequireDependency')
const { createFsFromVolume, Volume } = require('memfs')
const { sep, dirname, relative } = require('path')
// const { cache } = require('webpack') // Cache handling missing

const fileBanner = `/* Start of pino-webpack-plugin additions */
function pinoWebpackAbsolutePath(p) {
  try {
    return require('path').join(__dirname, p)
  } catch(e) {
    // This is needed not to trigger a warning if we try to use within CJS - Do we have another way?
    const f = new Function('p', 'return new URL(p, import.meta.url).pathname');
    return f(p)
  }
}
`

const compatibilityFooter = `
/* The following statement is added by pino-webpack-plugin to make sure extracted file are valid commonjs modules */
; if(typeof module !== 'undefined' && typeof __webpack_exports__ !== "undefined") { module.exports = __webpack_exports__; }
`
const PLUGIN_NAME = 'PinoWebpackPlugin'
// const CACHE_ID = 'pino-worker-plugin' // Cache handling missing

const fs = createFsFromVolume(new Volume())

class PinoWebpackPlugin {
  constructor(options) {
    options = { transports: [], ...options }
    this.transports = options.transports
  }

  apply(compiler) {
    compiler.hooks.thisCompilation.tap(PLUGIN_NAME, (compilation) => {
      const dependencies = {} // {entry: source file, file: generated file}

      // When requiring pino, thread-stream or users transports, prepare some required files for external bundling.
      compilation.hooks.buildModule.tap(PLUGIN_NAME, (mod) => {
        const addChildCompilerEntryPoint = (id, context, file, name) => {
          // Use id as name if none was given
          dependencies[id] = { entry: new webpack.EntryPlugin(context, file, { name: name ?? id }) }
        }

        switch (true) {
          case mod.rawRequest === 'thread-stream':
            addChildCompilerEntryPoint('thread-stream-worker', mod.context, './lib/worker.js')
            break

          case mod.rawRequest === 'pino':
            addChildCompilerEntryPoint('pino/file', mod.context, './file.js', 'pino-file')
            addChildCompilerEntryPoint('pino-worker', mod.context, './lib/worker.js')
            addChildCompilerEntryPoint('pino-pipeline-worker', mod.context, './lib/worker-pipeline.js')
            break

          case this.transports.includes(mod.rawRequest):
            addChildCompilerEntryPoint(mod.rawRequest, mod.context, mod.request)
            break
        }
      })

      // When requiring pino, also make sure all transports in the options are required
      compilation.hooks.succeedModule.tap(PLUGIN_NAME, (mod) => {
        if (mod.rawRequest !== 'pino') {
          return
        }

        for (const transport of this.transports) {
          mod.dependencies.push(new CommonJsRequireDependency(transport, null))
        }
      })

      /** Compile dependencies and add result to compilation assets **/
      compilation.hooks.additionalAssets.tapAsync(PLUGIN_NAME, (processAssetsCallback) => {
        // Create child compiler for dependencies
        const childCompiler = compilation.createChildCompiler(
          `${PLUGIN_NAME}ChildCompiler`,
          {
            library: {
              type: 'commonjs2'
            },
            iife: false
          },
          Object.values(dependencies).map((worker) => worker.entry)
        )
        childCompiler.inputFileSystem = compiler.inputFileSystem
        // Generate files in memory
        // It will be written to output path by main compilation
        childCompiler.outputFileSystem = fs

        // Enable required plugins
        new webpack.node.NodeTemplatePlugin({
          library: {
            type: 'commonjs2'
          },
          iife: false
        }).apply(childCompiler)
        new webpack.node.NodeTargetPlugin().apply(childCompiler)

        // When the files have been compiled, add a compatibility footer
        childCompiler.hooks.thisCompilation.tap(PLUGIN_NAME, (childCompilation) => {
          // Add assets with compatibility footer to main compilation
          childCompilation.hooks.processAssets.tap(
            {
              name: `${PLUGIN_NAME}ChildCompiler`,
              stage: webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONS
            },
            (childAssets) => {
              for (const path of Object.keys(childAssets)) {
                if (path.endsWith('.js')) {
                  compilation.emitAsset(path, new webpack.sources.ConcatSource(childAssets[path], compatibilityFooter))
                }
              }
            }
          )

          // Get generated file for each dependency
          childCompilation.hooks.chunkAsset.tap(`${PLUGIN_NAME}ChildCompiler`, (chunk, file) => {
            const dependencyId = chunk.name === 'pino-file' ? 'pino/file' : chunk.name
            if (dependencyId && dependencies[dependencyId]) {
              dependencies[dependencyId].file = file
            }
          })
        })

        // Perform the dependencies compilation
        childCompiler.run((err, stats) => {
          processAssetsCallback(err, stats)
        })
      })

      // Add banner to entrypoints files
      compilation.hooks.processAssets.tap(
        {
          name: PLUGIN_NAME,
          stage: webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONS
        },
        () => {
          const workerFiles = []

          // Create array of declarations used in banner
          for (const depId in dependencies) {
            if (!dependencies[depId].file) {
              continue
            }
            workerFiles.push([depId, dependencies[depId].file])
          }

          compilation.entrypoints.forEach((ep, k) => {
            for (const entrypointFile of ep.getFiles()) {
              const relativePath = relative(dirname(entrypointFile), '.') || '.'
              compilation.updateAsset(
                entrypointFile,
                new webpack.sources.ConcatSource(
                  fileBanner,
                  '\n',
                  `globalThis.__bundlerPathsOverrides = {${workerFiles.map(
                    ([workerId, file]) => `'${workerId}': pinoWebpackAbsolutePath('${relativePath}${sep}${file}')`
                  )}};`,
                  '\n',
                  '/* End of pino-webpack-plugin additions */',
                  '\n\n',
                  compilation.assets[entrypointFile]
                )
              )
            }
          })
        }
      )
    })
  }
}

module.exports = {
  banner: fileBanner,
  footer: compatibilityFooter,
  PinoWebpackPlugin
}
