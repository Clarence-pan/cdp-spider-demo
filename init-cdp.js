const CDP = require('chrome-remote-interface')

const Chrome = require('./chrome-debug-process')
const {sleep} = require('./util')

const CDP_PORT = +process.env.CDP_PORT || 9222

module.exports = async function({timeout=30*1000}={}){
    const start = Date.now()
    const chrome = await Chrome.start()

    timeout = Math.max(0, +timeout || 0)
    const retryInterval = Math.max(50, Math.min(200, timeout/10))
    
    let cdp, lastErr
    do {
        try {
            cdp = await CDP({port: CDP_PORT})
        } catch (e) {
            lastErr = e
        }

        if (!cdp){
            await sleep(retryInterval)
            continue
        }
    } while(!cdp || Date.now() - start > timeout)

    if (!cdp){
        chrome.close()
        throw lastErr
    }

    return {
        ...cdp,
        async close(){
            try {
                await cdp.close()
            } finally {
                await chrome.stop()
            }
        }
    }
}
