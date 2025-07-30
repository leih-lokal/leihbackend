// Important: every write operation run as part of a transactional event hook must use the event's txApp instead of global $app. See reservation.pb.js for details.

function remove(r, app = $app) {
    app.delete(r)
    app.logger().info(`Deleted reservation ${r.id} (${r.getString("iid")})`)
}

function markAsDone(r, app = $app) {
    r.set('done', true)
    app.save(r)
    app.logger().info(`Marked reservation ${r.id} as done.`)
}

function exportCsv(app = $app) {  // exports active reservations only
    const CSV = require(`${__hooks}/utils/csv.js`)

    const fields = [
        { id: 'id', label: '_id', empty: '' },
        { id: 'customer_iid', label: 'Nutzer ID', empty: '' },
        { id: 'customer_name', label: 'Nutzer Name', empty: '' },
        { id: 'customer_phone', label: 'Nutzer Telefon', empty: '' },
        { id: 'customer_email', label: 'Nutzer E-Mail', empty: '' },
        { id: 'is_new_customer', label: 'Neuer Nutzer?', empty: false },
        { id: 'pickup', label: 'Abholdatum', empty: '' },
        { id: 'items', label: 'Gegenstände', empty: [] },
        { id: 'comments', label: 'Kommentare', empty: '' },
        { id: 'created', label: 'Erstellt am', empty: '' },
    ]

    const result = arrayOf(new Record)
    app.recordQuery('reservation')
        .andWhere($dbx.hashExp({ done: false }))
        .andWhere($dbx.exp('pickup >= DATE("now", "localtime", "start of day", "-1 day")'))
        .orderBy('pickup desc')
        .all(result)
    app.expandRecords(result, ['items'])

    const records = result
        .map(r => r.publicExport())
        .map(r => {
            const items = r.expand.items.map(e => e.publicExport())
            return {
                id: r.id,
                customer_iid: r.customer_iid,
                customer_name: r.customer_name,
                customer_phone: r.customer_phone,
                customer_email: r.customer_email,
                is_new_customer: r.is_new_customer,
                pickup: r.pickup,
                comments: r.comments,
                created: r.created,
                items: items.map(i => `${i.iid} (${i.name})`).join(', '),
            }
        })

    return CSV.serialize({ fields, records })
}

module.exports = {
    markAsDone, remove, exportCsv,
}