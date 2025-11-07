onBootstrap((e) => {
    const { DRY_MODE } = require(`${__hooks}/constants.js`)

    $app.logger().info('Initializing custom hooks ...')
    if (DRY_MODE) $app.logger().info('Running in dry mode ...')
    else $app.logger().warn('Running in wet mode!')

    e.next()

    // const { clearReservations } = require(`${__hooks}/jobs/reservation.js`)
    // clearReservations()
})