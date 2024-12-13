function isAvailable(item) {
    const itemService = require(`${__hooks}/services/item.js`)
    const rentalService = require(`${__hooks}/services/rental.js`)
    const reservationService = require(`${__hooks}/services/reservation.js`)

    const status = item.getString('status')
    const copies = item.getInt('copies')

    if (status !== 'instock') return false
    if (copies === 1) return true

    const activeRentals = rentalService.countActiveByItem(item.id)
    const activeReservations = reservationService.countActiveByItem(item.id)

    if ((copies - activeRentals - activeReservations) > 0) return true

    return false
}

module.exports = {
    isAvailable,
}