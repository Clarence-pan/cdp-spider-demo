process.env.DEBUG = process.env.DEBUG || 'crawl-yidianzixun'
require('./init-env')

const EventEmitter = require('events')

const initCDP = require('./init-cdp')
const dbg = require('./dbg')
const {sleep, newTimeoutPromise} = require('./util')

const NetworkResponseReceivedEvent = 'network:responseReceived'
const PageLoadEventFiredEvent = 'page:loadEventFired'

const startUrl = process.argv[2] || 'http://www.yidianzixun.com/channel/m99376'

main().catch(err => {
    console.error("main() quit with error:")
    console.error(err)
})

async function main() {
    const cdp = await initCDP()

    const { Page, Runtime, Network } = cdp

    dbg.log.info("registering network listeners...")
    await Network.enable()
    await Page.enable()

    const events = new EventEmitter()
    Network.responseReceived(({ requestId, loaderId, timestamp, type, response, frameId }) => {
        events.emit(NetworkResponseReceivedEvent, { requestId, loaderId, timestamp, type, response, frameId })
    })

    Page.loadEventFired((...args) => {
        events.emit(PageLoadEventFiredEvent, ...args)
    })

    dbg.log.info(`start spider from "${startUrl}" ...`)

    try {
        const articles = await crawlListPage({ url: startUrl })
        dbg.log.info(`crawled ${articles.length} articles.`)
    } finally {
        dbg.log.info("close cdp.")
        cdp.close()
    }

    // 抓取列表页面:
    async function crawlListPage({ url, timeout = 240 * 1000 }) {
        dbg.log.info("crawling list page: ", url)
        await Page.navigate({ url })

        return newTimeoutPromise({ timeout, error: new Error('Crawl list page timeout!') }, async (resolve, reject) => {
            dbg.log.info("waiting loaded...")
            events.once(PageLoadEventFiredEvent, async () => {
                const js = `document.querySelector('title').textContent`
                const result = await Runtime.evaluate({ expression: js })
                dbg.log.info("Title of list page: ", result.result.value)
            })

            let networkResponseReceivedHandler = async ({ requestId, loaderId, timestamp, type, response, frameId }) => {
                dbg.log.info("response received from ", response.url, " reqId=", requestId)
                if (response.url.indexOf('home/q/news_list_for_channel') >= 0) {
                    events.removeListener(NetworkResponseReceivedEvent, networkResponseReceivedHandler)

                    try {
                        // dbg.log.info("response received from ", response.url, " reqId=", requestId)
                        let { body, base64Encoded } = await Network.getResponseBody({ requestId })
                        // dbg.log.info("response body: ", {body, base64Encoded})
                        if (base64Encoded) {
                            body = new Buffer(body, 'base64').toString('utf8')
                        }

                        try {
                            body = JSON.parse(body)
                        } catch (e) {
                            throw Object.assign(new Error("Failed to parse list data as JSON"), { inner: e })
                        }

                        const articles = body.result.map(x => ({
                            id: x.itemid,
                            title: x.title,
                            category: x.category,
                            source: x.source,
                            time: x.date,
                            cover_img: x.image ? `http://i1.go2yd.com/image.php?type=thumbnail_336x216&url=${x.image}` : '',
                            detail_url: `http://www.yidianzixun.com/article/${x.itemid}`,
                            detail_html: '',
                        }))

                        for (let article of articles) {
                            try {
                                await sleep(2 * 1000)

                                article.detail_html = await crawlDetailPage({ url: article.detail_url })

                                dbg.log.info("crawled article: ", article)

                                recordCrawledArticle(article)
                            } catch (e) {
                                // ignore
                                console.error("Failed to process ", article, ' --- error: ', e)
                            }
                        }

                        resolve(articles)
                    } catch (e) {
                        reject(e)
                    }
                }
            }

            events.on(NetworkResponseReceivedEvent, networkResponseReceivedHandler)
        })
    }

    // 抓取详情页面
    async function crawlDetailPage({ url, timeout = 10 * 1000 }) {
        dbg.log.info("crawling detail page: ", url)
        await Page.navigate({ url })
        return newTimeoutPromise({ timeout, error: new Error("Crawl detail page timeout!") }, async (resolve, reject) => {
            dbg.log.info("waiting loaded...")
            events.once(PageLoadEventFiredEvent, async () => {
                try {
                    const js = `document.querySelector('.content-bd').innerHTML`
                    const { result } = await Runtime.evaluate({ expression: js })

                    if (result.value) {
                        resolve(result.value)
                    } else {
                        reject(new Error("Failed to get .content-bd"))
                    }
                } catch (e) {
                    reject(e)
                }
            })
        })
    }
}

function recordCrawledArticle(article){
    require('fs').writeFileSync(
        require('path').join(__dirname, 'crawled-articles.log'), 
        JSON.stringify(article, null, '  ') + "\n", 
        {
            encoding: 'utf8',
            flag: 'a',
        }
    )
}