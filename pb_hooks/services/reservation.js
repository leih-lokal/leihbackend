function countActiveByItem(itemId) {
    return 0  // TODO: implement
}

function remove(r) {
    $app.delete(r)
    $app.logger().info(`Deleted reservation ${r.id} (${r.getString("iid")})`)
}

function markAsDone(r) {
    r.set('done', true)
    $app.save(r)
    $app.logger().info(`Marked reservation ${r.id} as done.`)
}

module.exports = {
    markAsDone, remove,
}