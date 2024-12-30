/* Wrap an event record hook inside a transaction, see https://github.com/pocketbase/pocketbase/discussions/6100#discussioncomment-11549632 */
function wrapTransactional(e, fn) {
    let app = e.app
    try {
        e.app.runInTransaction((txApp) => {
            e.app = txApp
            return fn(e)
        })
    } finally {
        e.app = app
    }
}

module.exports = {
    wrapTransactional,
}