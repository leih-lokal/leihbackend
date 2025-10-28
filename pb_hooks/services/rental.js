// Important: every write operation run as part of a transactional event hook must use the event's txApp instead of global $app. See reservation.pb.js for details.

function countActiveByItem(itemId, app = $app) {
    try {
        const result = new DynamicModel({ "num_active_rentals": 0 })
        app.db()
            .select("num_active_rentals")
            .from("item_rentals")
            .where($dbx.exp("id = {:itemId}", { itemId }))
            .one(result)
        return result.num_active_rentals
    } catch (e) {
        return -1
    }
}

function getDueTodayRentals(app = $app) {
    const records = app.findAllRecords('rental',
        $dbx.exp('substr(expected_on, 0, 11) = current_date')
    )
    return records
}

function getDueTomorrowRentals(app = $app) {
    const records = app.findAllRecords('rental',
        $dbx.exp("substr(expected_on, 0, 11) = date(current_date, '+1 day')")
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

    const result = app.findRecordsByFilter('rental', null, '-rented_on', -1)
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

// update item statuses
// meant to be called right before rental is saved
function updateItems(recordOrItems, outOfStock, app = $app) {
    const itemService = require(`${__hooks}/services/item.js`)

    // explicitly not using record expansion here, because would yield empty result for whatever reason
    const items = !(recordOrItems instanceof Array)
        ? app.findRecordsByIds('item', recordOrItems.getStringSlice('items'))
        : app.findRecordsByIds('item', recordOrItems)

    items.forEach(item => {
        if (outOfStock && !itemService.isAvailable(item)) throw new InternalServerError(`Can't set status of item ${item.id} to (outofstock: ${outOfStock}), because invalid state`)

        const status = item.getString('status')

        if (outOfStock) return itemService.setStatus(item, 'outofstock', app)
        else if (status === 'outofstock') return itemService.setStatus(item, 'instock', app)
        else app.logger().info(`Not updating status of item ${item.id}, because is not currently out of stock`)
    })
}

// E-Mail Sending

function sendReminderMail(r) {
    $app.expandRecord(r, ['items', 'customer'], null)

    const customerEmail = r.expandedOne('customer').getString('email')

    const html = $template.loadFiles(`${__hooks}/views/mail/return_reminder.html`).render({
        items: r.expandedAll('items').map(i => ({
            iid: i.getInt('iid'),
            name: i.getString('name'),
        })),
    })

    const message = new MailerMessage({
        from: {
            address: $app.settings().meta.senderAddress,
            name: $app.settings().meta.senderName,
        },
        to: [{ address: customerEmail }],
        subject: `[leih.lokal] Rückgabe von Gegenständen morgen fällig`,
        html,
    })

    $app.logger().info(`Sending reminder mail for rental ${r.id} to customer ${customerEmail}.`)
    $app.newMailClient().send(message)
}

module.exports = {
    countActiveByItem,
    getDueTodayRentals,
    getDueTomorrowRentals,
    exportCsv,
    updateItems,
    sendReminderMail,
}