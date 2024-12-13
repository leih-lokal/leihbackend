function clearReservations() {
    const itemService = require(`${__hooks}/services/item.js`)
    const reservationService = require(`${__hooks}/services/reservation.js`)

    const pastReservations = $app.findRecordsByFilter('reservation', `pickup < '${new Date().toISOString()}' && done = false`)
    const pendingReservations = $app.findRecordsByFilter('reservation', `pickup > '${new Date().toISOString()}'`)

    const pastItems = new Set(pastReservations.map(r => r.getStringSlice('items')).flat())
    const reservedItems = new Set(pendingReservations.map(r => r.getStringSlice('items')).flat())
    const instockItems = [...pastItems].filter(i => !reservedItems.has(i))

    $app.logger().info(`Resetting rental status of ${instockItems.length} previously reserved items`)

    instockItems
        .map(id => $app.findRecordById('item', id))
        .filter(i => i.getString('status') === 'reserved')
        .forEach(i => itemService.setStatus(i, 'instock'))

    pastReservations.forEach(reservationService.markAsDone)
}

module.exports = {
    clearReservations
}