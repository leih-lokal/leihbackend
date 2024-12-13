onBootstrap((e) => {
    $app.logger().info('Initializing custom hooks ...')
    e.next()

    // const { clearReservations } = require(`${__hooks}/jobs/reservation.js`)
    // clearReservations()
})