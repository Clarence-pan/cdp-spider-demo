const path = require('path')
const child_process = require('child_process')
const isRunning = require('is-running')

const util = require('./util')
const CDP_PORT = +process.env.CDP_PORT || 9222

module.exports = {
    start,
}

async function start({debuggingPort=CDP_PORT}={}) {
    const exe = process.env.CHROME_CDP_START_EXE
    const args = (process.env.CHROME_CDP_START_ARGS + '').replace('{CDP_PORT}', debuggingPort)

    const proc = child_process.spawn(exe, replaceArgsEnvVars(args.split(" ")), {
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: false,
    })

    util.copyStreamLinesWithPrefix({prefix: "[chrome] ", from: proc.stdout, to: process.stdout})
    util.copyStreamLinesWithPrefix({prefix: "[chrome] ", from: proc.stderr, to: process.stderr})

    return {
        proc,
        pid: proc.pid,
        isAlive: () => isProcessAlive(proc.pid),
        stop: async ({timeout=5*1000}={}) => {
            if (!isProcessAlive(proc.pid)){
                return true
            }

            const start = Date.now()
            const stopCmd = process.env.CHROME_CDP_STOP_CMD
            if (stopCmd){
                const stopProc = child_process.spawn(stopCmd, {shell: true, stdio: 'inherit'})

                await util.waitForProcessExit(stopProc, {timeout: timeout - (Date.now() - start)})
            }

            return util.stopProcess(proc.pid, {timeout: timeout - (Date.now() - start)})
        }
    }
}

function replaceArgsEnvVars(args){
    let re, replacer
    if (path.sep === '/'){
        re = /\$\{([^}]+?)\}/g
    } else {
        re = /%([^%]+?)%/g
    }

    replacer = ($0, $1) => process.env[$1] || ''

    args.forEach((x, i) => {
        args[i] = x.replace(re, replacer)
    })

    return args
}

function isProcessAlive(pid){
    return isRunning(pid)
}
