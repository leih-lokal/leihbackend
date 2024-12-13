function clearReservations() {
    const { setStatus } = require(`${__hooks}/utils/item.js`)
    const { markAsDone } = require(`${__hooks}/utils/reservation.js`)

    const pastReservations = $app.findRecordsByFilter('reservation', `pickup < '${new Date().toISOString()}' && done = false`)
    const pendingReservations = $app.findRecordsByFilter('reservation', `pickup > '${new Date().toISOString()}'`)

    const pastItems = new Set(pastReservations.map(r => r.getStringSlice('items')).flat())
    const reservedItems = new Set(pendingReservations.map(r => r.getStringSlice('items')).flat())
    const instockItems = [...pastItems].filter(i => !reservedItems.has(i))

    $app.logger().info(`Resetting rental status of ${instockItems.length} previously reserved items`)

    instockItems
        .map(id => $app.findRecordById('item', id))
        .filter(i => i.getString('status') === 'reserved')
        .forEach(i => setStatus(i, 'instock'))

    pastReservations.forEach(markAsDone)
}

module.exports = {
    clearReservations
}