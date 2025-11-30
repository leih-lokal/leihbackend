// Important: every write operation run as part of a transactional event hook must use the event's txApp instead of global $app. See reservation.pb.js for details.

function countActiveByItem(itemId, app = $app) {
    const result = new DynamicModel({ cnt: 0 })
    app.db()
        .select("count(*) as cnt")
        .from("reservation")
        .where($dbx.exists($dbx.exp(
            "select 1 from json_each(items) where json_each.value = {:itemId}", { itemId }
        )))
        .andWhere($dbx.exp("done = false"))
        .one(result)
    return result.cnt
}

function remove(r, app = $app) {
    app.delete(r)
    app.logger().info(`Deleted reservation ${r.id} (${r.getString("iid")}).`)
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

// Validation

function validate(r) {
    validateFields(r)
    validateStatus(r)
    validatePickup(r)
}

function validateFields(r) {
    // actual validation will be done during record creation, this is only to raise a specific error in case customer data couldn't be filled from iid
    const customerIid = r.getInt('customer_iid')
    if (customerIid) {
        if (!r.getString('customer_name') || !r.getString('customer_phone') || !r.getString('customer_email')) {
            throw new BadRequestError(`Invalid ID ${customerIid}, no corresponding customer found`)
        }
    }
}

function validateStatus(r) {
    // We currently don't consider number of copies here, see comment below for details.
    const isUnavailable = (item) => item.getString('status') !== 'instock'

    $app.expandRecord(r, ['items'], null)

    const unavailableItems = r.expandedAll('items').filter(isUnavailable).map(i => i.getInt('iid'))
    if (unavailableItems.length) {
        throw new BadRequestError(`Items ${unavailableItems} not available.`)
    }
}

function validatePickup(r) {
    const { OPENING_HOURS, WEEKDAYS } = require(`${__hooks}/constants.js`)

    const pickup = new Date(r.getDateTime('pickup').string().replace(' ', 'T'))
    if (pickup < new Date()) {
        throw new BadRequestError('Pickup date must be in the future')
    }

    if (!OPENING_HOURS
        .filter(d => WEEKDAYS[d[0]] === pickup.getDay())
        .map(d => [
            new Date(1970, 0, 1, d[1].split(':')[0], d[1].split(':')[1]),
            new Date(1970, 0, 1, d[2].split(':')[0], d[2].split(':')[1]),
        ])
        .filter(d => {
            const d1 = new Date(1970, 0, 1, pickup.getHours(), pickup.getMinutes())
            return d1 >= d[0] && d1 < d[1]
        })
        .length
    ) {
        throw new BadRequestError('Pickup date outside opening hours')
    }
}

// Business logic

function autofillCustomer(record, app = $app) {
    const customerIid = record.getInt('customer_iid')
    if (!customerIid) return record

    let customer
    try {
        customer = app.findFirstRecordByData('customer', 'iid', customerIid)
    } catch (e) {
        return record
    }

    if (!record.getString('customer_name')) record.set('customer_name', `${customer.getString('firstname')} ${customer.getString('lastname')}`)
    if (!record.getString('customer_phone')) record.set('customer_phone', customer.getString('phone'))
    if (!record.getString('customer_email')) record.set('customer_email', customer.getString('email'))
    record.set('is_new_customer', false)

    return record
}

// update item statuses
// meant to be called right before reservation is saved
function updateItems(reservation, oldReservation = null, isDelete = false, app = $app) {
    // Note: for simplicity, we're currently not considering the number of copies of an item. If an item is reserved, we simply assume all instance of it to be reserved.
    // Otherwise things get confusing (e.g. customer reserves an item, but status on the website is still shown as available, etc.).

    // TODO: handle (or forbid) the case where a reservation is marked as doen and it's item list is updated at the same time (currently unhandled)

    const itemService = require(`${__hooks}/services/item.js`)

    const isDone = reservation.getBool('done') || isDelete
    const itemIdsNew = reservation.getStringSlice('items') // explicitly not using record expansion here, because would yield empty result for whatever reason
    const itemIdsOld = oldReservation?.getStringSlice('items') || []
    const itemsNew = app.findRecordsByIds('item', itemIdsNew)
    const itemsRemoved = itemIdsOld.length ? app.findRecordsByIds('item', itemIdsOld.filter(id => !(id in itemIdsNew))) : []


    const items = [...itemsNew, ...itemsRemoved]
    items.forEach(item => {
        const [itemIid, itemStatus] = [item.getInt('iid'), item.getString('status')]
        const wasRemoved = !itemIdsNew.includes(item.id)

        if (isDone || wasRemoved) {
            if (itemStatus === 'reserved') return itemService.setStatus(item, 'instock', app)  // was reserved -> reservation cleared -> available again
            app.logger().warn(`Not resetting availability status of item ${item.id} (${itemIid}) upon cleared reservation, because was not marked as reserved (${itemStatus} instead).`)
        } else {
            if (itemStatus !== 'instock') throw new InternalServerError(`Can't set status of item ${item.id} (${itemIid}) to 'reserved', because currently not available (${itemStatus} instead).`)
            itemService.setStatus(item, 'reserved', app)
        }
    })
}

// E-Mail Sending

function sendConfirmationMail(r) {
    const { fmtDateTime } = require(`${__hooks}/utils/common.js`)
    const { DRY_MODE } = require(`${__hooks}/constants.js`)

    // Skip email if on_premises is true
    if (r.getBool('on_premises')) {
        return
    }

    $app.expandRecord(r, ['items'], null)

    const customerEmail = r.getString('customer_email')
    const pickupDateStr = fmtDateTime(r.getDateTime('pickup'))
    const cancelLink = `${$app.settings().meta.appURL}/reservation/cancel?token=${r.getString("cancel_token")}`

    const html = $template.loadFiles(`${__hooks}/views/mail/reservation_confirmation.html`).render({
        pickup: pickupDateStr,
        customer_name: r.getString('customer_name'),
        customer_iid: r.getInt('customer_iid'),
        customer_email: customerEmail,
        customer_phone: r.getString('customer_phone'),
        comments: r.getString('comments'),
        items: r.expandedAll('items').map(i => ({
            iid: i.getInt('iid'),
            name: i.getString('name'),
        })),
        cancel_link: cancelLink,
        otp: r.getString('otp')
    })

    const message = new MailerMessage({
        from: {
            address: $app.settings().meta.senderAddress,
            name: $app.settings().meta.senderName,
        },
        to: [{ address: customerEmail }],
        subject: `Wir haben deine Reservierung für ${pickupDateStr} erhalten`,
        html,
    })

    if (!DRY_MODE) $app.newMailClient().send(message)
}

function sendCancellationMail(r) {
    const { fmtDateTime } = require(`${__hooks}/utils/common.js`)
    const { DRY_MODE } = require(`${__hooks}/constants.js`)

    // Skip email if on_premises is true
    if (r.getBool('on_premises')) {
        return
    }

    const customerEmail = r.getString('customer_email')
    const pickupDateStr = fmtDateTime(r.getDateTime('pickup'))

    const html = $template.loadFiles(`${__hooks}/views/mail/reservation_cancellation.html`).render({
        pickup: pickupDateStr,
    })

    const message = new MailerMessage({
        from: {
            address: $app.settings().meta.senderAddress,
            name: $app.settings().meta.senderName,
        },
        to: [{ address: customerEmail }],
        subject: `Deine Reservierung für ${pickupDateStr} wurde storniert`,
        html,
    })

    if (!DRY_MODE) $app.newMailClient().send(message)
}

module.exports = {
    markAsDone,
    remove,
    exportCsv,
    sendConfirmationMail,
    sendCancellationMail,
    validate,
    autofillCustomer,
    updateItems,
    countActiveByItem,
}