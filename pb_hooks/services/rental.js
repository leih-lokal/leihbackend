// Important: every write operation run as part of a transactional event hook must use the event's txApp instead of global $app. See reservation.pb.js for details.

function countActiveByItem(itemId, app = $app) {
    try {
        const result = new DynamicModel({ num_active_rentals: 0 })
        app.db().select('num_active_rentals').from('item_rentals').where($dbx.exp('id = {:itemId}', { itemId })).one(result)
        return result.num_active_rentals
    } catch (e) {
        return -1
    }
}

// Number of copies of each item that a rental currently has out, i.e. requested copies minus copies already returned (partial return, see `returned_items`).
// Returned rentals (`returned_on` set) have no copies out.
function getCopiesOut(rental) {
    const { tryParseJson } = require(`${__hooks}/utils/common.js`)

    if (!rental.getDateTime('returned_on').isZero()) return {}

    const requestedCopies = tryParseJson(rental.getString('requested_copies')) || {}
    const returnedCopies = tryParseJson(rental.getString('returned_items')) || {}

    return rental.getStringSlice('items').reduce((acc, itemId) => {
        const numOut = (parseInt(requestedCopies[itemId]) || 1) - (parseInt(returnedCopies[itemId]) || 0) // 1 for legacy support
        return numOut > 0 ? { ...acc, [itemId]: numOut } : acc
    }, {})
}

function countCopiesActiveByItem(itemId, app = $app) {
    return app
        .findRecordsByFilter('rental', "items ~ {:itemId} && returned_on = ''", '', 0, 0, { itemId })
        .reduce((acc, r) => acc + (getCopiesOut(r)[itemId] || 0), 0)
}

function getDueTodayRentals(app = $app) {
    const records = app.findAllRecords('rental',
        $dbx.exp('substr(expected_on, 0, 11) = current_date'),
        $dbx.or($dbx.hashExp({ returned_on: '' }), $dbx.hashExp({ returned_on: null }))
    )
    return records
}

function getDueTomorrowRentals(app = $app) {
    const records = app.findAllRecords('rental',
        $dbx.exp("substr(expected_on, 0, 11) = date(current_date, '+1 day')"),
        $dbx.or($dbx.hashExp({ returned_on: '' }), $dbx.hashExp({ returned_on: null }))
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
        .map((r) => r.publicExport())
        .map((r) => {
            const customer = r.expand.customer.publicExport()
            const items = r.expand.items.map((e) => e.publicExport())

            const requestedCopies = r.requested_copies || {}
            const itemsDisplay = items
                .map((i) => {
                    const copyCount = requestedCopies[i.id] || 1
                    return copyCount > 1 ? `${i.iid} (×${copyCount})` : i.iid
                })
                .join(', ')

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
// meant to be called right after rental is saved (or deleted)
function updateItems(rental, oldRental = null, isDelete = false, app = $app) {
    // TODO: handle (or forbid) the case where a rental is returned and it's item list is updated at the same time (currently unhandled)

    const itemService = require(`${__hooks}/services/item.js`)

    const copiesOutNew = isDelete ? {} : getCopiesOut(rental)
    const copiesOutOld = oldRental ? getCopiesOut(oldRental) : {}

    // only touch items whose number of rented copies actually changed, e.g. don't retroactively update items of already returned rentals
    const itemIds = [...new Set([...Object.keys(copiesOutNew), ...Object.keys(copiesOutOld)])]
        .filter((itemId) => copiesOutNew[itemId] !== copiesOutOld[itemId])

    app.findRecordsByIds('item', itemIds).forEach((item) => {
        const numAdded = (copiesOutNew[item.id] || 0) - (copiesOutOld[item.id] || 0)
        if (numAdded > 0) {
            validateAvailable(item, numAdded, app)
            closeReservations(item, rental, numAdded, app)
        }
        itemService.refreshStatus(item, app)
    })
}

// meant to be called right after rental is saved, i.e. the rental's copies are already counted
function validateAvailable(item, numAdded, app = $app) {
    const itemStatus = item.getString('status')

    // Reserved items can be rented, too, even to someone other than the reserver. Reservations will be closed accordingly (see below).
    if (!['instock', 'reserved'].includes(itemStatus)) {
        throw new BadRequestError(`Item ${item.getInt('iid')} is not available for rental (status: ${itemStatus}).`)
    }

    const numTotal = item.getInt('copies')
    const numRented = countCopiesActiveByItem(item.id, app)
    if (numRented > numTotal) {
        throw new BadRequestError(`Item ${item.getInt('iid')} is not available for rental (${numTotal - numRented + numAdded} of ${numTotal} copies available).`)
    }
}

// Close active reservations of an item that is being rented out:
// - the renting customer's own reservations, because they are being picked up
// - others (earliest pickup first) if their reserved copies are rented out now, i.e. if there are more active reservations than copies left
function closeReservations(item, rental, numAdded, app = $app) {
    const reservations = app.findRecordsByFilter('reservation', 'items ~ {:itemId} && done = false', 'pickup', 0, 0, { itemId: item.id })
    if (!reservations.length) return

    const customer = app.findRecordById('customer', rental.getString('customer'))
    const customerEmail = customer.getString('email').toLowerCase()
    const isOwn = (r) => (customerEmail && r.getString('customer_email').toLowerCase() === customerEmail) || (r.getInt('customer_iid') > 0 && r.getInt('customer_iid') === customer.getInt('iid'))

    const ownReservations = reservations.filter(isOwn).slice(0, numAdded)
    const otherReservations = reservations.filter((r) => !ownReservations.some((o) => o.id === r.id))
    const numFree = item.getInt('copies') - countCopiesActiveByItem(item.id, app) - otherReservations.length

    ownReservations.forEach((r) => {
        r.set('done', true)
        app.save(r)
        app.logger().info(`Closed reservation ${r.id} for item ${item.getInt('iid')} upon rental to the reserver ${customerEmail}.`)
    })

    otherReservations.slice(0, Math.max(0, -numFree)).forEach((r) => {
        r.set('done', true)
        app.save(r)
        app.logger().warn(`Closed reservation ${r.id} for item ${item.getInt('iid')}, because the reserved copy was rented to ${customerEmail} instead of reserver ${r.getString('customer_email')}.`)
    })
}

// E-Mail Sending

function sendReminderMail(r) {
    const { sendMail } = require(`${__hooks}/services/mail.js`)

    $app.expandRecord(r, ['items', 'customer'], null)

    const customerEmail = r.expandedOne('customer').getString('email')
    const copiesOut = getCopiesOut(r)

    $app.logger().info(`Sending reminder mail for rental ${r.id} to customer ${customerEmail}.`)

    sendMail('return_reminder', customerEmail, {
        items: r.expandedAll('items')
            .filter((i) => copiesOut[i.id]) // skip items that were returned already (partial return)
            .map((i) => ({
                iid: i.getInt('iid'),
                name: i.getString('name'),
                copies: copiesOut[i.id],
            })),
    })
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
