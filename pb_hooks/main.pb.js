onBootstrap((e) => {
    const { DRY_MODE, IMPORT_MODE } = require(`${__hooks}/constants.js`)

    $app.logger().info('[server] Initializing custom hooks ...')
    if (DRY_MODE) $app.logger().info('[server] Running in dry mode ...')
    else $app.logger().warn('[server] Running in non-dry mode!')
    if (IMPORT_MODE) $app.logger().warn('[server] Skipping item status validation and updates because running in import mode ...')

    e.next()

    // const { clearReservations } = require(`${__hooks}/jobs/reservation.js`)
    // clearReservations()
})

// https://pocketbase.io/docs/js-logging/#intercepting-logs-write
onModelCreate((e) => {
    const { LOG_LEVEL } = require(`${__hooks}/constants.js`)

    // only log at relevant level and don't log requests
    if (e.model.level >= LOG_LEVEL && JSON.parse(e.model.data)?.type !== 'request') {
        function getLevelText(level) {
            if (level < 4) return 'INFO'
            if (level < 8) return 'WARN'
            return 'ERROR'
        }
        console.log(`[${getLevelText(e.model.level)}] ${e.model.message}`)
    }

    e.next()
}, '_logs')
