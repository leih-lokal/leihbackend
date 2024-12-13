function isAvailable(item) {
    const status = item.getString('status')
    const copies = item.getInt('copies')

    if (status !== 'instock') return false
    if (copies === 1) return true

    const activeRentals = countActiveRentals(item.id)
    const activeReservations = countActiveReservations(item.id)

    if ((copies - activeRentals - activeReservations) > 0) return true

    return false
}

function setStatus(item, status) {
    $app.logger().info(`Updating status of item ${item.id} to ${status}`)
    item.set('status', status)
    $app.save(item)
}

function countActiveRentals(itemId) {
    return 0  // TODO: implement
}

function countActiveReservations(itemId)  {
    return 0  // TODO: implement
}

module.exports = {
    isAvailable, setStatus, countActiveRentals, countActiveReservations
}