/// <reference path="../pb_data/types.d.ts" />

onRecordCreate((e) => {
    throw new BadRequestError('Just a test', {'a': 'b'})
    // const { validate, onReserveItems } = require(`${__hooks}/utils/reservation.js`)

    // validate(e.record)
    // onReserveItems(e.record)

    e.next()
}, 'reservation')


// Scheduled jobs

cronAdd('clear_reservations', "0 22 * * *", () => {
    const { clearReservations } = require(`${__hooks}/jobs/reservations.js`)
    clearReservations()
})