import {Order, copy} from './order.ts'
import {processChunk} from './response_parser.ts'

/**
 * Search by duckduckgo.
 * @param {string} query - Query to search.
 * @param {number} start - Start number of the search.
 * @param {number} num - Number of items to search.
 * @returns {string} - .
 */
export async function duckduckgo(query, start=1, num=10){
  let url = 'https://duckduckgo.com/lite/'
  let key = `?q=${query}&s=${num}&dc=${start}&v=l`
  let request = await fetch(
    url+key,
    {method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });
  let html = await request.text()
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

export async function webSearch(
  order: Order, query: string, start: number = 1, num:number = 10,
  compressPrompt: string = 'Below is piece of text of a website. Please summarize the main content of the website.',
  timeout=60000, stringNum = 10000
){
  let links = await duckduckgo(query, start, num)
  let results = await Promise.all(
    links.map(
      link=>readHTML(link.link).then((text)=>{
        let texts = [];
        for (let i = 0; i < text.length; i+=stringNum) {
            texts.push(text.slice(i, i+stringNum))
        }
        if (compressPrompt) {
          return Promise.all(texts.map(x=>order.copyChild()
            .putUser(compressPrompt + ":\n" + x).receive()))
        }
        return texts
      }).then(
      async(x)=>{
        if (compressPrompt) {
          console.log('Started summarizing')
          let allData = []
          for await (const xx of x){
            let data = ''
            let timeIsOut = false
            let timeoutId = setTimeout(() => timeIsOut = true, timeout);
            for await (const chunk of xx.body){
              if (timeIsOut) break
              data += processChunk(order.type, chunk)
            }
            allData.push(data)
          }
          return allData
        }
        return x
      })
    )
  )
  for (const n in results){
    for (const nn in results[n]){
      order.putSystem(`According to ${links[n].title}
  ${results[n][nn]}`)
    }
  }
  console.log('Done')
}


/**
 * Decide whether web search is needed or not.
 * This is experimental.
 * @param {Order} order - Template of order object.
 * @param {string} text - Text to process.
 * @param {number} threshould - Threshould to search.
 * @param {number} num - Number of tests. Should be bigger than threshould.
 * @returns {null} - null.
 */
async function isNeedToSearch(order, text, threshould=3, num=10){
  const words = await order.copyChild().putUser(
    `Extract words not be known well from below and write words for each line. If there is no such words, reply "No". Do not explain.\n'${text}'`
  ).receive()
  let allWords = ''
  let timeIsOut = false
  let timeoutId = setTimeout(() => timeIsOut = true, order.timeout);
  for await (const chunk of words.body){
    if (timeIsOut) break
    allWords += processChunk(order.type, chunk)
  }
  let shouldSearch = 0
  let yesno = []
  for (let n = 0; n < num; n++){
    yesno.push(await Promise.all(allWords.trim().split('\n').map(async (word)=> {
      return order.copyChild()
      .putUser(
        `Is '${word.trim()}' known well? Reply must be Yes or No.`
      ).receive()
    }).map(async (child)=>{
      let res = ''
      let c= await child
      let timeIsOut = false
      let timeoutId = setTimeout(() => timeIsOut = true, order.timeout);
      for await (const chunk of c.body){
        if (timeIsOut) break
        res += processChunk(order.type, chunk)
      }
      return res.trim()
    }))
                                ) }
  console.log(yesno.flat().filter(x=>x.match('No')!==null).length)
  return threshould < yesno.flat().filter(x=>x.match('No')!==null).length
}
