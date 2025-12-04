onBootstrap((e) => {
    const { DRY_MODE } = require(`${__hooks}/constants.js`)

    $app.logger().info('[server] Initializing custom hooks ...')
    if (DRY_MODE) $app.logger().info('[server] Running in dry mode ...')
    else $app.logger().warn('[server] Running in non-dry mode!')

    e.next()

    // const { getDueTomorrowRentals } = require(`${__hooks}/services/rental.js`)
    // const dueRentals = getDueTomorrowRentals()
    // console.log(`${dueRentals.length} rentals are due tomorrow`)
    // console.log(dueRentals.map(r => r.getInt('iid')))
})
