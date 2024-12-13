function validate(r) {
    validateStatus(r)
    validatePickup(r)
}

// update item statuses
// meant to be called right before reservation is saved
function onReserveItems(r) {
    const itemService = require(`${__hooks}/services/item.js`)
    const rentalService = require(`${__hooks}/services/rental.js`)
    const reservationService = require(`${__hooks}/services/reservation.js`)
    
    const items = r.getStringSlice('items').map(id => $app.findRecordById('item', id))

    items.forEach(item => {
        const status = item.getString('status')
        const copies = item.getInt('copies')

        if (status !== 'instock') throw new InternalServerError(`Invalid status of item ${item.id}`)

        if (copies === 1) {
            return itemService.setStatus(item, 'reserved')
        }

        const activeRentals = rentalService.countActiveByItem(item.id)
        const activeReservations = reservationService.countActiveByItem(item.id)
        const copiesLeft = copies - activeRentals - activeReservations

        if (copiesLeft < 1) throw new InternalServerError(`Invalid reservation state of item ${item.id}`)

        if (copiesLeft == 1) {
            return itemService.setStatus(item, 'reserved')
        }
    })
}

function validateStatus(r) {
    const { isAvailable: isItemAvailable } = require(`${__hooks}/utils/item.js`)

    const items = r.getStringSlice('items').map(id => $app.findRecordById('item', id))
    const unavailableItems = items.filter(i => !isItemAvailable(i)).map(i => i.getInt('iid'))
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

module.exports = {
    validate, onReserveItems,
}