const _util = require('util')
const isRunning = require('is-running')

module.exports = {
    ..._util,
    sleep,
    newTimeoutPromise,
    rejectOnTimeout,
    stopProcess,
    waitForProcessExit,
    copyStreamLinesWithPrefix,
    tryParseJson,
}


async function newTimeoutPromise({ timeout, error }, init) {
    return new Promise((originalResolve, originalReject) => {
        let timerId
        const clean = () => {
            if (timerId) {
                clearTimeout(timerId)
                timerId = 0
            }
        }
        
        const resolve = (res) => {
            clean()
            originalResolve(res)
        }

        const reject = (err) => {
            clean()
            originalReject(err)
        }

        timerId = setTimeout(() => {
            reject(error || Object.assign(new Error('timeout!'), { isTimeout: true }))
        }, timeout)

        init(resolve, reject)
    })
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

async function rejectOnTimeout({ timeout, error } = {}) {
    await sleep(timeout)
    throw (error || Object.assign(new Error('timeout!'), { isTimeout: true }))
}


async function stopProcess(pid, {timeout=0}={}){
    if (!isRunning(pid)){
        return true
    }

    const start = Date.now()

    process.kill(pid, 'SIGINT')

    timeout = Math.max(0, +timeout || 0)

    const checkInterval = Math.min(timeout / 10, 100)

    do {
        if (!isRunning(pid)){
            return true
        }

        await sleep(checkInterval)
    } while (Date.now() - start < timeout * 0.8)
    
    process.kill(pid, 'SIGTERM')

    do {
        if (!isRunning(pid)){
            return true
        }

        await sleep(checkInterval)
    } while (Date.now() - start < timeout)
    
    process.kill(pid, 'SIGKILL')
    
    await sleep(0)
    return !isRunning(pid)
}

async function waitForProcessExit(proc, {timeout=Infinity}={}){
    return newTimeoutPromise({timeout}, (resolve, reject) => {
        if (proc && proc.on && typeof proc.on === 'function'){
            proc.on('exit', (code) => {
                resolve(code)
            })
    
            proc.on('error', (err) => {
                if (!isRunning(proc.pid)){
                    reject(err)
                }
            })
            return
        } 
        
        const pid = +proc
        if (!isNaN(pid)){
            ~(async () => {
                const pid = +proc
                timeout = Math.max(0, +timeout || 0)
                const checkInterval = Math.min(timeout / 10, 100)
                const start = Date.now()

                while (isRunning(pid) && Date.now() - start < timeout){
                    await sleep(checkInterval)
                }

                throw Object.assign(
                    new Error("timeout!"),
                    {isTimeout: true}
                )
            })().catch(resolve, reject)
        } 
        
        throw new Error("invalid argument, proc must be instance of Process or a pid")
    }) 
}


/**
 * 拷贝流，每行签名都有特定前缀
 */
function copyStreamLinesWithPrefix({ prefix, from, to }) {
    from.on('data', (data) => {
        const lines = (data + '').split("\n")
        if (lines[lines.length - 1] === '') {
            lines.pop()
        }

        for (let line of lines) {
            to.write(prefix + line + "\n")
        }
    })
}

function tryParseJson(d){
    if (typeof d === 'string'){
        try {
            return JSON.parse(d)
        } catch (e){
            return null
        }
    } 
    
    if (d && typeof d === 'object'){
        if (d instanceof Buffer){
            try {
                return JSON.parse(d.toString('utf8'))
            } catch (e){
                return null
            }
        }

        return d
    }

    return d
}