function isAvailable(item) {
    const rentalService = require(`${__hooks}/services/rental.js`)
    const reservationService = require(`${__hooks}/services/reservation.js`)

    const status = item.getString('status')
    const copies = item.getInt('copies')

    if (status !== 'instock') return false
    if (copies === 1) return true

    const activeRentals = rentalService.countActiveByItem(item.id)
    const activeReservations = reservationService.countActiveByItem(item.id)

    return (copies - activeRentals - activeReservations) > 0;
}

module.exports = {
    isAvailable,
}