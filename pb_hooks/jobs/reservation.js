function clearReservations() {
    const { setStatus } = require(`${__hooks}/utils/item.js`)

    const pastItems = new Set($app.findRecordsByFilter('reservation', `pickup < '${new Date().toISOString()}'`)
        .map(r => r.getStringSlice('items'))
        .flat())
    const reservedItems = new Set($app.findRecordsByFilter('reservation', `pickup > '${new Date().toISOString()}'`)
        .map(r => r.getStringSlice('items'))
        .flat())
    const instockItems = [...pastItems].filter(i => !reservedItems.has(i))

    $app.logger().info(`Resetting rental status of ${instockItems.length} previously reserved items`)

    instockItems
        .map(id => $app.findRecordById('item', id))
        .filter(i => i.getString('status') === 'reserved')
        .forEach(i => setStatus(i, 'instock'))
}

module.exports = {
    clearReservations
}