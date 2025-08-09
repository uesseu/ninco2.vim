import {Order, copy} from './order.ts'
import {processChunk} from './response_parser.ts'
import {urlOption} from './defaults.ts'

/**
 * Search by duckduckgo.
 * @param {string} query - Query to search.
 * @param {number} start - Start number of the search.
 * @param {number} num - Number of items to search.
 * @returns {string} - .
 */
export async function duckduckgo(query: string, start: number=1, num: number=10, options=urlOption){
  let url = 'https://lite.duckduckgo.com/lite/'
  const queryList = query.split(' ').concat(options).join('+')
  let key = `?q=${queryList}&s=${num}&dc=${start}&v=l`
  let process = new Deno.Command('w3m', {args: ['-dump_source', '-o', "accept_encoding='identity;q=0'", url + key]});
  let html = await process.output().then(
    x=> {
      return new TextDecoder().decode(x.stdout)
    }
  )
  const links = [];
  const linkRegex = /<a\srel="nofollow"\shref="\/\/duckduckgo.com\/l\/\?uddg\=([^&]+)[^"]+"[^>]*>([^<]+)<\/a>/g;
  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    links.push(
      {link: decodeURIComponent(match[1])
         .replace('&amp;', '&')
         .replace('&quot;', '"')
         .replace('&apos;', "'")
         .replace('&sol;', "/")
         .replace('&percnt;', "%")
         .replace('&lt;', "<")
         .replace('&gt;', ">"),
       title: match[2]}
    );
  }
  return links
}


/**
 * Read website by w3m.
 * @param {string} url - URI of the website.
 * @returns {string} - result.
 */
export async function readHTML(url){
  console.log(`Reading '${url}'`)
  let process = new Deno.Command('w3m', {args: [url, '-dump']});
  return process.output().then(
    x=> new TextDecoder().decode(x.stdout)
  )
}


