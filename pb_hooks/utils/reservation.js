// Validation

const {isAvailable} = require("./item");

function validate(r) {
    validateStatus(r)
    validatePickup(r)
}

function validateStatus(r) {
    const {isAvailable: isItemAvailable} = require(`${__hooks}/utils/item.js`)

    $app.expandRecord(r, ['items'], null)

    const unavailableItems = r.expandedAll('items').filter(i => !isItemAvailable(i)).map(i => i.getInt('iid'))
    if (unavailableItems.length) {
        throw new BadRequestError(`Items ${unavailableItems} not available.`)
    }
}

function validatePickup(r) {
    const {OPENING_HOURS, WEEKDAYS} = require(`${__hooks}/constants.js`)

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

// update item statuses
// meant to be called right before reservation is saved
function updateItems(r, reserved) {
    const itemService = require(`${__hooks}/services/item.js`)
    const {isAvailable} = require(`${__hooks}/utils/item.js`)

    // explicitly not using record expansion here, because would yield empty result for whatever reason
    const items = $app.findRecordsByIds('item', r.getStringSlice('items'))

    items.forEach(item => {
        if (reserved && !isAvailable(item)) throw new InternalServerError(`Can't set status of item ${item.id} to (reserved: ${reserved}), because invalid state`)

        const status = item.getString('status')

        if (reserved) return itemService.setStatus(item, 'reserved')
        else if (status === 'reserved') return itemService.setStatus(item, 'instock')
        else $app.logger().info(`Not updating status of item ${item.id}, because is not currently reserved`)
    })
}

// E-Mail Sending
function sendConfirmationMail(r) {
    const {fmtDateTime} = require(`${__hooks}/utils/common.js`)

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
        to: [{address: r.getString('customer_email')}],
        subject: `Deine Reservierung für ${pickupDateStr} erhalten`,
        html,
    })

    $app.newMailClient().send(message)
}

module.exports = {
    validate, updateItems, sendConfirmationMail,
}