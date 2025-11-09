onBootstrap((e) => {
    const { DRY_MODE } = require(`${__hooks}/constants.js`)

    $app.logger().info('[server] Initializing custom hooks ...')
    if (DRY_MODE) $app.logger().info('[server] Running in dry mode ...')
    else $app.logger().warn('[server] Running in non-dry mode!')

    e.next()

    // const { clearReservations } = require(`${__hooks}/jobs/reservation.js`)
    // clearReservations()
})