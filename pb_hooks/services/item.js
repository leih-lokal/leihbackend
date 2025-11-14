// Important: every write operation run as part of a transactional event hook must use the event's txApp instead of global $app. See reservation.pb.js for details.

function setStatus(item, status, app = $app) {
    item.set('status', status)
    app.save(item)
    app.logger().info(`Updated status of item ${item.id} to ${status}.`)
}

function exportCsv(app = $app) {
    const CSV = require(`${__hooks}/utils/csv.js`)

    const fields = [
            { id: 'id', label: '_id', empty: '' },
            { id: 'iid', label: '#', empty: '' },
            { id: 'name', label: 'Gegenstand', empty: '' },
            { id: 'description', label: 'Beschreibung', empty: '' },
            { id: 'status', label: 'Status', empty: '' },
            { id: 'deposit', label: 'Pfand', empty: 0 },
            { id: 'synonyms', label: 'Synonyme', empty: '' },
            { id: 'category', label: 'Kategorie', empty: [] },
            { id: 'brand', label: 'Marke', empty: '' },
            { id: 'model', label: 'Modellbezeichnung', empty: '' },
            { id: 'packaging', label: 'Verpackung', empty: '' },
            { id: 'manual', label: 'Betriebsanleitung', empty: '' },
            { id: 'parts', label: 'Anzahl Teile', empty: 0 },
            { id: 'copies', label: 'Exemplare', empty: 0 },
            { id: 'internal_note', label: 'Interne Notiz', empty: '' },
            { id: 'added_on', label: 'Hinzugefügt am', empty: '' },
        ]
    
    const result = arrayOf(new DynamicModel(fields.reduce((acc, field) => {
        acc[field.id] = field.empty
        return acc;
    }, {})))
    app.db().newQuery('select item.*, coalesce(num_rentals, 0) as num_rentals, coalesce(num_active_rentals, 0) as num_active_rentals from item left join item_rentals using (id) where status != \'deleted\'').all(result)
    const records = JSON.parse(JSON.stringify(result))

    return CSV.serialize({ fields, records })
}

module.exports = {
    setStatus,
    exportCsv,
}