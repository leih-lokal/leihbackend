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

function exportCsv(app = $app) {
    const CSV = require(`${__hooks}/utils/csv.js`)

    const fields = [
            { id: 'id', label: '_id', empty: '' },
            { id: 'iid', label: 'ID', empty: '' },
            { id: 'email', label: 'E-Mail', empty: '' },
            { id: 'phone', label: 'Telefon', empty: '' },
            { id: 'firstname', label: 'Vorname', empty: '' },
            { id: 'lastname', label: 'Nachname', empty: '' },
            { id: 'street', label: 'Strasse', empty: '' },
            { id: 'city', label: 'Stadt', empty: '' },
            { id: 'postal_code', label: 'PLZ', empty: '' },
            { id: 'heard', label: 'Aufmerksam geworden', empty: '' },
            { id: 'remark', label: 'Anmerkungen', empty: '' },
            { id: 'registered_on', label: 'Registriert am', empty: '' },
            { id: 'renewed_on', label: 'Erneuert am', empty: '' },
            { id: 'newsletter', label: 'Newsletter', empty: false },
            { id: 'num_rentals', label: 'Ausleihen', empty: 0 },
            { id: 'num_active_rentals', label: 'Aktive Ausleihen', empty: 0 },
        ]
    
    const result = arrayOf(new DynamicModel(fields.reduce((acc, field) => {
        acc[field.id] = field.empty
        return acc;
    }, {})))
    app.db().newQuery('select customer.*, coalesce(num_rentals, 0) as num_rentals, coalesce(num_active_rentals, 0) as num_active_rentals from customer left join customer_rentals using (id)').all(result)
    const records = JSON.parse(JSON.stringify(result))

    return CSV.serialize({ fields, records })
}

module.exports = {
    getUniqueStreets,
    exportCsv,
}