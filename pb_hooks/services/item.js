function setStatus(item, status) {
    item.set('status', status)
    $app.save(item)
    $app.logger().info(`Updated status of item ${item.id} to ${status}`)
}

module.exports = {
    setStatus
}