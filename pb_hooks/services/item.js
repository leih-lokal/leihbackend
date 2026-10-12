// Important: every write operation run as part of a transactional event hook must use the event's txApp instead of global $app. See reservation.pb.js for details.

// Statuses derived from active rentals and reservations. They can be set by hand anyway (e.g. to fix an item that got stuck), which lasts until the item's next rental or reservation change.
// Other statuses (e.g. repairing, lost, deleted) are set by hand only and never changed automatically.
const AVAILABILITY_STATUSES = ['instock', 'reserved', 'outofstock']

function setStatus(item, status, app = $app) {
    item.set('status', status)
    app.save(item)
    app.logger().info(`Updated status of item ${item.id} to ${status}.`)
}

// Derive an item's availability status from its number of copies, rented copies and active reservations:
// outofstock if all copies are rented, reserved if all remaining copies are reserved, instock otherwise.
function refreshStatus(item, app = $app) {
    const rentalService = require(`${__hooks}/services/rental.js`)
    const reservationService = require(`${__hooks}/services/reservation.js`)

    const status = item.getString('status')
    if (!AVAILABILITY_STATUSES.includes(status)) return

    const numCopies = item.getInt('copies')
    const numRented = rentalService.countCopiesActiveByItem(item.id, app)
    const numReserved = reservationService.countActiveByItem(item.id, app)

    let newStatus = 'instock'
    if (numRented >= numCopies) newStatus = 'outofstock'
    else if (numRented + numReserved >= numCopies) newStatus = 'reserved'

    if (newStatus === status) return

    app.logger().info(`Setting item ${item.id} (${item.getInt('iid')}) to ${newStatus} (${numCopies} copies, ${numRented} rented, ${numReserved} reserved)`)
    setStatus(item, newStatus, app)
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
    refreshStatus,
    exportCsv,
}