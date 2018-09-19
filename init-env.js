process.on('uncaughtException', (e) => {
    console.error("Error: Uncaught Exception: ", e)
    process.exit(11)
})

process.on('unhandledRejection', (e) => {
    console.error("Error: Unhandled Rejection: ", e)
    process.exit(12)
})

const path = require('path')
const dotEnv = require('dotenv')

dotEnv.config({
    path: path.join(__dirname, '.env')
})

