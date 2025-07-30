// Important: every write operation run as part of a transactional event hook must use the event's txApp instead of global $app. See reservation.pb.js for details.

function countActiveByItem(itemId, app = $app) {
    return 0  // TODO: implement
}

function getDueTodayRentals(app = $app) {
    const records = app.findAllRecords('rental',
        $dbx.exp('substr(expected_on, 0, 11) = current_date')
    )
    return records    
}

function exportCsv(app = $app) {
    const CSV = require(`${__hooks}/utils/csv.js`)

    const fields = [
        { id: 'id', label: '_id', empty: '' },
        { id: 'customer_id', label: 'Nutzer ID', empty: '' },
        { id: 'customer_name', label: 'Nutzer', empty: '' },
        { id: 'items', label: 'Gegenstände', empty: [] },
        { id: 'deposit', label: 'Pfand', empty: 0 },
        { id: 'deposit_back', label: 'Pfand zurück', empty: 0 },
        { id: 'rented_on', label: 'Verliehen am', empty: '' },
        { id: 'returned_on', label: 'Zurück am', empty: '' },
        { id: 'expected_on', label: 'Erwartet am', empty: '' },
        { id: 'extended_on', label: 'Verlängert am', empty: '' },
        { id: 'remark', label: 'Anmerkung', empty: '' },
        { id: 'employee', label: 'Mitarbeiter:in', empty: '' },
        { id: 'employee_back', label: 'Mitarbeiter:in zurück', empty: '' },
    ]

    const result = app.findAllRecords('rental').orderBy('rented_on desc')
    app.expandRecords(result, ['customer', 'items'])

    const records = result
        .map(r => r.publicExport())
        .map(r => {
            const customer = r.expand.customer.publicExport()
            const items = r.expand.items.map(e => e.publicExport())

            return {
                id: r.id,
                customer_id: r.expand.customer.id,
                customer_name: `${customer.firstname} ${customer.lastname}`,
                items: items.map(i => i.iid).join(', '),
                deposit: r.deposit,
                deposit_back: r.deposit_back,
                rented_on: r.rented_on,
                returned_on: r.returned_on,
                expected_on: r.expected_on,
                extended_on: r.extended_on,
                remark: r.remark,
                employee: r.employee,
                employee_back: r.employee_back,
            }
        })

    return CSV.serialize({ fields, records })
}

module.exports = {
    countActiveByItem,
    getDueTodayRentals,
    exportCsv,
}