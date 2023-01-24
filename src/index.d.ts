import { Compiler, WebpackPluginInstance } from 'webpack'

export const banner: string
export const footer: string

export class PinoWebpackPlugin implements WebpackPluginInstance {
  constructor(options: { transports: string[] })
  [index: string]: any
  apply: (compiler: Compiler) => void
}
