// Important: every write operation run as part of a transactional event hook must use the event's txApp instead of global $app. See reservation.pb.js for details.

function countActiveByItem(itemId, app = $app) {
    const result = new DynamicModel({ cnt: 0 })
    app.db()
        .select('count(*) as cnt')
        .from('reservation')
        .where($dbx.exists($dbx.exp('select 1 from json_each(items) where json_each.value = {:itemId}', { itemId })))
        .andWhere($dbx.exp('done = false'))
        .one(result)
    return result.cnt
}

function getTodaysReservations(app = $app) {
    const records = app.findAllRecords('reservation',
        $dbx.exp('substr(pickup, 0, 11) = current_date'),
        $dbx.hashExp({ done: false })
    )
    return records
}

function remove(r, app = $app) {
    app.delete(r)
    app.logger().info(`Deleted reservation ${r.id} (${r.getString('iid')}).`)
}

function markAsDone(r, app = $app) {
    r.set('done', true)
    app.save(r)
    app.logger().info(`Marked reservation ${r.id} as done.`)
}

function exportCsv(app = $app) {
    // exports active reservations only
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

    const result = arrayOf(new Record())
    app.recordQuery('reservation')
        .andWhere($dbx.hashExp({ done: false }))
        .andWhere($dbx.exp('pickup >= DATE("now", "localtime", "start of day", "-1 day")'))
        .orderBy('pickup desc')
        .all(result)
    app.expandRecords(result, ['items'])

    const records = result
        .map((r) => r.publicExport())
        .map((r) => {
            const items = r.expand.items.map((e) => e.publicExport())
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
                items: items.map((i) => `${i.iid} (${i.name})`).join(', '),
            }
        })

    return CSV.serialize({ fields, records })
}

// Validation

function validate(r, force = false) {
    validateFields(r)
    validateStatus(r)
    if (!force) validateProtected(r)
    if (!force) validatePickup(r)
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
    const itemService = require(`${__hooks}/services/item.js`)

    // Items with multiple copies can be reserved multiple times. Every reservation reserves one copy of each item.
    // 'reserved' (all remaining copies reserved) is allowed here, too, in case the status doesn't reflect the actual number of copies anymore.
    const isUnavailable = (item) => !['instock', 'reserved'].includes(item.getString('status')) || itemService.countFreeCopies(item) < 1

    $app.expandRecord(r, ['items'], null)

    const unavailableItems = r
        .expandedAll('items')
        .filter(isUnavailable)
        .map((i) => i.getInt('iid'))

    if (unavailableItems.length) {
        throw new BadRequestError(`Items ${unavailableItems} not available.`)
    }
}

function validateProtected(r) {
    $app.expandRecord(r, ['items'], null)

    const protectedItems = r
        .expandedAll('items')
        .filter(i => i.getBool('is_protected'))
        .map(i => i.getInt('iid'))

    if (protectedItems.length) {
        throw new BadRequestError(`Items ${protectedItems} cannot be reserved.`)
    }
}

function validatePickup(r) {
    const { WEEKDAYS } = require(`${__hooks}/constants.js`)
    const { getOpeningHours } = require(`${__hooks}/services/settings.js`)

    const OPENING_HOURS = getOpeningHours()

    const pickupRaw = r.getDateTime('pickup')
    const pickup = new Date(pickupRaw.unix() * 1000)
    if (pickupRaw.before(new DateTime())) {
        throw new BadRequestError('Pickup date must be in the future')
    }

    if (
        !OPENING_HOURS.filter((d) => WEEKDAYS[d[0]] === pickup.getDay())
            .map((d) => [new Date(1970, 0, 1, d[1].split(':')[0], d[1].split(':')[1]), new Date(1970, 0, 1, d[2].split(':')[0], d[2].split(':')[1])])
            .filter((d) => {
                const d1 = new Date(1970, 0, 1, pickup.getHours(), pickup.getMinutes())
                return d1 >= d[0] && d1 < d[1]
            }).length
    ) {
        throw new BadRequestError('Pickup date outside opening hours')
    }
}

// Business logic

function autofillCustomer(record, app = $app) {
    function getByIid() {
        const customerIid = record.getInt('customer_iid')
        if (!customerIid) return null
        try {
            return app.findFirstRecordByData('customer', 'iid', customerIid)
        } catch (e) {
            return null
        }
    }

    function getByEmail() {
        const customerEmail = record.getString('customer_email')?.toLowerCase()
        if (!customerEmail) return null
        try {
            const count = app.countRecords('customer', $dbx.hashExp({ email: customerEmail }))
            if (count !== 1) return null // emails are not enforced to be unique currently
            return app.findFirstRecordByData('customer', 'email', customerEmail)
        } catch (e) {
            return null
        }
    }

    // try to get customer by given iid, otherwise by email, otherwise leave fields empty
    let customer = getByIid() || getByEmail()
    if (!customer) return record

    if (!record.getString('customer_name')) record.set('customer_name', `${customer.getString('firstname')} ${customer.getString('lastname')}`)
    if (!record.getString('customer_phone')) record.set('customer_phone', customer.getString('phone'))
    if (!record.getString('customer_email')) record.set('customer_email', customer.getString('email'))
    if (!record.getInt('customer_iid')) record.set('customer_iid', customer.getInt('iid'))
    record.set('is_new_customer', false)

    return record
}

// update item statuses
// meant to be called right after reservation is saved (or deleted)
function updateItems(reservation, oldReservation = null, isDelete = false, app = $app) {
    // Every active (not done) reservation reserves one copy of each of its items, see itemService.refreshStatus() for how this affects item status.

    const itemService = require(`${__hooks}/services/item.js`)

    if (isDelete) oldReservation = reservation

    const isActive = (r) => r && !r.getBool('done')
    const itemIdsNew = !isDelete && isActive(reservation) ? reservation.getStringSlice('items') : [] // explicitly not using record expansion here, because would yield empty result for whatever reason
    const itemIdsOld = isActive(oldReservation) ? oldReservation.getStringSlice('items') : []

    const itemIdsAdded = itemIdsNew.filter((id) => !itemIdsOld.includes(id))
    const itemIdsRemoved = itemIdsOld.filter((id) => !itemIdsNew.includes(id))

    app.findRecordsByIds('item', [...itemIdsAdded, ...itemIdsRemoved]).forEach((item) => {
        // reservation is saved already, i.e. counted as reserving a copy
        if (itemIdsAdded.includes(item.id) && (!['instock', 'reserved'].includes(item.getString('status')) || itemService.countFreeCopies(item, app) < 0)) {
            throw new BadRequestError(`Item ${item.getInt('iid')} not available.`)
        }
        itemService.refreshStatus(item, app)
    })
}

// E-Mail Sending

function sendConfirmationMail(r) {
    const { fmtDate, fmtCurrency } = require(`${__hooks}/utils/common.js`)
    const { sendMail } = require(`${__hooks}/services/mail.js`)

    // Skip email if on_premises is true
    if (r.getBool('on_premises')) {
        return
    }

    $app.expandRecord(r, ['items'], null)

    const items = r.expandedAll('items')
    const depositTotal = items.reduce((sum, i) => sum + i.getFloat('deposit'), 0)

    sendMail('reservation_confirmation', r.getString('customer_email'), {
        pickup: fmtDate(r.getDateTime('pickup')),
        customer_name: r.getString('customer_name'),
        customer_iid: r.getInt('customer_iid'),
        customer_email: r.getString('customer_email'),
        customer_phone: r.getString('customer_phone'),
        comments: r.getString('comments'),
        // deposits are passed preformatted, empty if zero
        items: items.map((i) => ({
            iid: i.getInt('iid'),
            name: i.getString('name'),
            deposit: i.getFloat('deposit') > 0 ? fmtCurrency(i.getFloat('deposit')) : '',
        })),
        deposit_total: depositTotal > 0 ? fmtCurrency(depositTotal) : '',
        cancel_link: `${$app.settings().meta.appURL}/reservation/cancel?token=${r.getString('cancel_token')}`,
        otp: r.getString('otp'),
    })
}

function sendCancellationMail(r) {
    const { fmtDate } = require(`${__hooks}/utils/common.js`)
    const { sendMail } = require(`${__hooks}/services/mail.js`)

    // Skip email if on_premises is true
    if (r.getBool('on_premises')) {
        return
    }

    sendMail('reservation_cancellation', r.getString('customer_email'), {
        pickup: fmtDate(r.getDateTime('pickup')),
    })
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
    getTodaysReservations,
}
