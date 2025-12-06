function handleGetStats(e) {
    const { getStats } = require(`${__hooks}/services/stats.js`)

    const stats = getStats()
    return e.json(200, stats)
}

module.exports = {
    handleGetStats,
}
