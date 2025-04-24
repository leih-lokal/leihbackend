function getUniqueStreets(query, app = $app) {
    const result = arrayOf(new DynamicModel({
        street: ''
    }))

    let sql = app.db()
        .select('street')
        .from('customer')
        .distinct(true)
        
    if (query) sql = sql.where($dbx.like('street', query))

    sql.all(result)

    const streets = result
        .map(({ street }) => street)
        .map((street) => street.replace(/[0-9]+.*$/g, '').trim())
        .filter(street => street.length > 3)
    return [...new Set(streets)]
}

module.exports = {
    getUniqueStreets,
}