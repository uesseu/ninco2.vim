//export const SearchEngine = {
//  brave: 'https://api.search.brave.com/res/v1/web/search',
//  duckduckgo: 'https://lite.duckduckgo.com/lite/'
//}
//
//export class Web{
//  apikey: string
//  url: string
//
//  constructor(url: string, apikey: string = ''){
//    this.url = url
//    this.apikey = apikey
//  }
//
//  async private duckduckgo(query: string, start: number=1, num: number=10, options=urlOption){
//    const queryList = query.split(' ').concat(options).join('+')
//    let key = `?q=${queryList}&s=${num}&dc=${start}&v=l`
//    let process = new Deno.Command('w3m', {args: ['-dump_source', '-o', "accept_encoding='identity;q=0'", this.url + key]});
//    let html = await process.output().then(
//      x=> {
//        return new TextDecoder().decode(x.stdout)
//      }
//    )
//    const links = [];
//    const linkRegex = /<a\srel="nofollow"\shref="\/\/duckduckgo.com\/l\/\?uddg\=([^&]+)[^"]+"[^>]*>([^<]+)<\/a>/g;
//    let match;
//    while ((match = linkRegex.exec(html)) !== null) {
//      links.push(
//        {link: decodeURIComponent(match[1])
//           .replace('&amp;', '&')
//           .replace('&quot;', '"')
//           .replace('&apos;', "'")
//           .replace('&sol;', "/")
//           .replace('&percnt;', "%")
//           .replace('&lt;', "<")
//           .replace('&gt;', ">"),
//         title: match[2]}
//      )
//    }
//    return links
//  }
//
//  private mcp(query, count: number = 10, country: string = 'us', search_lang: string = 'en'){
//    return fetch(
//      `${this.url}?${new URLSearchParams({
//        q: query,
//        count: 10,
//        country: "us",
//        search_lang: "en",
//      })}`,
//      {
//        headers: {
//          "X-Subscription-Token": this.apikey,
//        },
//      },
//    ).then(response => response.json().web.results.map(x=>x.url))
//  }
//
//  search(){
//  }
//}
