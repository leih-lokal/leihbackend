function countActiveByItem(itemId) {
    return 0  // TODO: implement
}

function markAsDone(r) {
    r.set('done', true)
    $app.save(r)
    $app.logger().info(`Marked reservation ${r.id} as done.`)
}

module.exports = {
    markAsDone,
}