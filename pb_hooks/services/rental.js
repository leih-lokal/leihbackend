// Important: every write operation run as part of a transactional event hook must use the event's txApp instead of global $app. See reservation.pb.js for details.

function countActiveByItem(itemId, app = $app) {
    return 0  // TODO: implement
}

module.exports = {
    countActiveByItem,
}