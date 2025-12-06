function clearReservations() {
    const itemService = require(`${__hooks}/services/item.js`)
    const reservationService = require(`${__hooks}/services/reservation.js`)

    const pastReservations = $app.findRecordsByFilter('reservation', `pickup < '${new DateTime().string()}' && done = false`)  // expired reservations that haven't been marked as done
    const pendingReservations = $app.findRecordsByFilter('reservation', `pickup > '${new DateTime().string()} && done = false'`)  // active, pending reservations

    const pastItems = new Set(pastReservations.map(r => r.getStringSlice('items')).flat())
    const reservedItems = new Set(pendingReservations.map(r => r.getStringSlice('items')).flat())
    const resetItems = [...pastItems].filter(i => !reservedItems.has(i))

    $app.logger().info(`Resetting rental status of ${resetItems.length} previously reserved items.`)

    resetItems
        .map(id => $app.findRecordById('item', id))
        .filter(i => i.getString('status') === 'reserved')
        .forEach(i => {
            $app.logger().info(`Resetting status of item ${i.getInt('iid')} to 'instock'.`)
            itemService.setStatus(i, 'instock')
        })

    pastReservations.forEach((r) => reservationService.markAsDone(r))
}

module.exports = {
    clearReservations
}
