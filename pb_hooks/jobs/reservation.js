function clearReservations() {
    const reservationService = require(`${__hooks}/services/reservation.js`)

    const pastReservations = $app.findRecordsByFilter('reservation', `pickup < '${new DateTime().string()}' && done = false`)  // expired reservations that haven't been marked as done

    $app.logger().info(`Clearing ${pastReservations.length} expired reservations.`)

    // item statuses are updated by the reservation's update hook
    pastReservations.forEach((r) => reservationService.markAsDone(r))
}

module.exports = {
    clearReservations
}
