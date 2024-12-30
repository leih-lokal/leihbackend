// Important: every write operation run as part of a transactional event hook must use the event's txApp instead of global $app. See reservation.pb.js for details.

function setStatus(item, status, app = $app) {
    item.set('status', status)
    app.save(item)
    app.logger().info(`Updated status of item ${item.id} to ${status}`)
}

module.exports = {
    setStatus
}