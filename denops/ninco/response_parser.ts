/**
 * The worst boiler plate of this software.
 * Code tries to parse something like json bun not json.
 * @param {any} response - Denops object.
 * @returns {string} - Output of LLM.
 */
export function parseResponseChatgpt(response: any): any{
  if (response.trim()[0] === "{"){
    try {
      return Array(JSON.parse(response.trim().slice(5)))
      .filter(x => x !== "")
      .map(x => x["choices"][0]["delta"]["content"]).join("")
    } catch (er) {
      try{
        return JSON.parse(response)["error"]["message"]
      }
      catch {
        console.log(er)
      }
    }
  }
  if (response.length === 0) return ""
  if (response.trim() === "data: [DONE]") return ""
  if (response.trim().slice(5, 10) === "error") {
    try{
      return JSON.parse(response)["error"]["message"]
    } catch (er) {
      console.log(er)
    }
  }
  if (response.trim().slice(0, 8) === ": ping -") return ""
  if (response[0] !== "[") {
    try {
      return Array(JSON.parse(response.trim().slice(5))).filter(x => x !== "").map(x => {
        try{
          return x["choices"][0]["delta"]["content"]
        } catch (er) {
          if (debug){
            console.log(er)
            console.log(response)
          }
          return ''
        }
      }).join("")
    } catch (er) {
      if (debug){
        console.log(er)
        console.log(response)
      }
      return "[Error]"
    }
  }
}

export function processChunk(type: string, chunk: any): Array<string>{
  let data: Array<string>
  let raw = new TextDecoder().decode(chunk)
  try{
    if (type === 'chatgpt'){
      data = raw.split("\n\n").map(parseResponseChatgpt)
    } else if (type === 'ollama') {
      let res = JSON.parse(raw)
      if (res && res['message']) data = [res['message']['content']]
      else data = []
    }
    return data
  } catch {
    return ['']
  }
}

