function handleGetCsv(e) {
    const {exportCsv} = require(`${__hooks}/services/item.js`)

    const result = exportCsv()
    const ts = new DateTime().unix()

    e.response.header().set('content-type', 'text/csv')
    e.response.header().set('content-disposition', `attachment; filename="items_${ts}.csv"`)
    return e.string(200, result)
}

module.exports = {
    handleGetItemsCsv: handleGetCsv,
}
