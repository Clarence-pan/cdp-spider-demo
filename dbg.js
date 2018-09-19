const l = {
    level: 99999,
    ERROR: 100,
    WARN:  200,
    INFO:  300,    
    DEBUG: 400,
    parseLevel(levelStr){
        if (typeof levelStr === 'number' || /^\d+$/.test(levelStr)){
            return +levelStr
        }

        return log[(levelStr + '').toUpperCase()]
    },
    parseColor(color, level){
        if (color === false || color === 'no' || (color === 'auto' && +process.env.DISABLE_COLOR)){
            return
        }

        return colors[level]
    },
    error(fmt, ...args){
        logEx({level: l.ERROR, format: fmt, args})
    },
    warn(fmt, ...args){
        logEx({level: l.WARN, format: fmt, args})
    },
    info(fmt, ...args){
        logEx({level: l.INFO, format: fmt, args})
    },
    debug(fmt, ...args){
        logEx({level: l.DEBUG, format: fmt, args})
    },
}

const colors = {
    [l.ERROR]: ['\033[31m', ' \033[0m '],
    [l.WARN]:  ['\033[1;33m', ' \033[0m '],
    [l.INFO]:  ['\033[36m', ' \033[0m '],
    [l.DEBUG]: ['\033[1;32m', ' \033[0m '],
}

l.level = +l.parseLevel(process.env.LOG_LEVEL) || 99999


module.exports = {
    log: Object.assign(log, l),
    logEx,
    error,
}

function log(fmt, ...args){
    console.log(now() + ' ' + fmt, ...args)
}

function logEx({level=l.DEBUG, color='auto', format='', args=[]}={}){
    const levelVal = +l.parseLevel(level)
    if (isNaN(levelVal)){
        error("invalid log level: ", level)
        return
    }

    if (l.level > levelVal){
        color = l.parseColor(color, levelVal)
        if (!color){
            log(format, ...args)
        } else {
            log(color[0] + format + color[1], ...args)
        }
    }
}

function error(fmt, ...args){
    logEx({
        level: l.ERROR,
        format: fmt,
        args,
    })
}

function now(){
    return new Date(Date.now() + 8*3600*1000).toISOString().replace(/^2018-|\d{2}Z$/g,'').replace('T', ' ')
}
