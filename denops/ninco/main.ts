import {connector} from './glue.ts'
import {Writer, VimWriter} from './writer.ts'

export async function main(denops: Denops): Promise<void> {
  denops.dispatcher = connector(denops, (handler, fname)=>new VimWriter(handler, fname))
}
