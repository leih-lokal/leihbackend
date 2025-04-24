function handleGetStreet(e) {
    const {getUniqueStreets} = require(`${__hooks}/services/customer`)

    const q = e.request.url.query().get('q')
    if (!q || q.length < 3) throw new BadRequestError('No query string provided')

    const streets = getUniqueStreets(q)

    e.response.header().set('cache-control', 'max-age=3600')
    return e.json(200, streets)
}

module.exports = {
    handleGetStreet,
}