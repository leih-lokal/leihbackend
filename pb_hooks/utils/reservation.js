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
    const { isAvailable: isItemAvailable } = require(`${__hooks}/utils/item.js`)

    $app.expandRecord(r, ['items'], null)

    const unavailableItems = r.expandedAll('items').filter(i => !isItemAvailable(i)).map(i => i.getInt('iid'))
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

// Business Logic

function autofillCustomer(record, app = $app) {
    const customerIid = record.getInt('customer_iid')
    if (!customerIid) return record

    let customer
    try {
        customer = app.findFirstRecordByData('customer', 'iid', customerIid)
    } catch(e) {
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
function updateItems(recordOrItems, reserved, app = $app) {
    const itemService = require(`${__hooks}/services/item.js`)
    const { isAvailable } = require(`${__hooks}/utils/item.js`)

    // explicitly not using record expansion here, because would yield empty result for whatever reason
    const items = !(recordOrItems instanceof Array)
        ? app.findRecordsByIds('item', recordOrItems.getStringSlice('items'))
        : app.findRecordsByIds('item', recordOrItems)

    items.forEach(item => {
        if (reserved && !isAvailable(item)) throw new InternalServerError(`Can't set status of item ${item.id} to (reserved: ${reserved}), because invalid state`)

        const status = item.getString('status')

        if (reserved) return itemService.setStatus(item, 'reserved', app)
        else if (status === 'reserved') return itemService.setStatus(item, 'instock', app)
        else app.logger().info(`Not updating status of item ${item.id}, because is not currently reserved`)
    })
}

// E-Mail Sending
function sendConfirmationMail(r) {
    const { fmtDateTime } = require(`${__hooks}/utils/common.js`)

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
        cancel_link: cancelLink
    })

    const message = new MailerMessage({
        from: {
            address: $app.settings().meta.senderAddress,
            name: $app.settings().meta.senderName,
        },
        to: [{ address: r.getString('customer_email') }],
        subject: `Deine Reservierung für ${pickupDateStr} erhalten`,
        html,
    })

    $app.newMailClient().send(message)
}

module.exports = {
    validate, autofillCustomer, updateItems, sendConfirmationMail,
}