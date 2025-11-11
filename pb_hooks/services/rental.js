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

function countCopiesActiveByItem(itemId, app = $app) {
    // TODO: implement in sql instead of js
    const activeRentals = app.findRecordsByFilter('rental', `items ~ '${itemId}' && returned_on = ''`)
    return activeRentals
        .map(r => r.get('requested_copies')[itemId] || 1) // 1 for legacy support
        .reduce((acc, count) => acc + count, 0)
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

            const requestedCopies = r.requested_copies || {}
            const itemsDisplay = items.map(i => {
                const copyCount = requestedCopies[i.id] || 1
                return copyCount > 1 ? `${i.iid} (×${copyCount})` : i.iid
            }).join(', ')

            return {
                id: r.id,
                customer_id: r.expand.customer.id,
                customer_name: `${customer.firstname} ${customer.lastname}`,
                items: itemsDisplay,
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
function updateItems(rental, oldRental = null, isDelete = false, app = $app) {
    const itemService = require(`${__hooks}/services/item.js`)
    const reservationService = require(`${__hooks}/services/reservation.js`)

    const returnDate = rental.getDateTime('returned_on')
    const isReturn = oldRental && !returnDate.isZero() && !returnDate.equal(oldRental.getDateTime('returned_on')) && returnDate.before(new DateTime())
    const returnItems = isReturn || isDelete

    const requestedCopiesNew = JSON.parse(rental.getRaw('requested_copies')) || {}
    const requestedCopiesOld = oldRental ? JSON.parse(oldRental.getRaw('requested_copies')) || {} : {}

    const itemCountsNew = rental.getStringSlice('items').reduce((acc, id) => ({ ...acc, [id]: requestedCopiesNew[id] || 1 }), {})
    const itemCountsOld = (oldRental?.getStringSlice('items') || []).reduce((acc, id) => ({ ...acc, [id]: requestedCopiesOld[id] || 1 }), {})

    const itemCountsDiff = {}
    Object.entries(itemCountsNew).forEach(([itemId, count]) => {
        itemCountsDiff[itemId] = !returnItems ? count : -count
    })
    Object.entries(itemCountsOld).forEach(([itemId, count]) => {
        if (!(itemId in itemCountsDiff)) itemCountsDiff[itemId] = -count
    })

    const itemsAll = app.findRecordsByIds('item', Object.keys(itemCountsDiff))  // explicitly not using record expansion here, because would yield empty result for whatever reason

    itemsAll.forEach(item => {
        const itemId = item.id

        const numTotal = item.getInt('copies')
        const numRequested = itemCountsDiff[itemId]
        const numReserved = reservationService.countActiveByItem(itemId, app)
        const numRented = app.findRecordsByFilter('rental', `items ~ '${itemId}' && returned_on = ''`)
            .filter(r => r.id !== rental.id)  // exclude self
            .map(r => r.get('requested_copies')[itemId] || 1) // 1 for legacy support
            .reduce((acc, count) => acc + count, 0)
        const numAvailable = numTotal - numReserved - numRented
        const numNew = numAvailable - numRequested

        if (numNew == 0) {
            app.logger().info(`Setting item ${item.id} to outofstock (${numRented} copies rented, ${numReserved} reserved, ${numAvailable} available)`)
            itemService.setStatus(item, 'outofstock', app)
        } else if (numNew > 0) {
            app.logger().info(`Setting item ${item.id} to instock (${numRented} copies rented, ${numReserved} reserved, ${numAvailable} available)`)
            itemService.setStatus(item, 'instock', app)
        } else {
            throw new InternalServerError(`Can't set status of item ${item.id}, because invalid state`)
        }
    })
}

// E-Mail Sending

function sendReminderMail(r) {
    $app.expandRecord(r, ['items', 'customer'], null)

    const customerEmail = r.expandedOne('customer').getString('email')

    // Get requested_copies to show copy counts in email
    const requestedCopies = r.get('requested_copies') || {}

    const html = $template.loadFiles(`${__hooks}/views/mail/return_reminder.html`).render({
        items: r.expandedAll('items').map(i => {
            const copyCount = requestedCopies[i.id] || 1
            return {
                iid: i.getInt('iid'),
                name: i.getString('name'),
                copies: copyCount,
            }
        }),
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
    countCopiesActiveByItem,
    getDueTodayRentals,
    getDueTomorrowRentals,
    exportCsv,
    updateItems,
    sendReminderMail,
}
