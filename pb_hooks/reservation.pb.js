/// <reference path="../pb_data/types.d.ts" />

const {handleGetCancel} = require(`${__hooks}/routes/reservation`)

// Request hooks
// ----- //

onRecordCreateRequest((e) => {
    const {validate, sendConfirmationMail} = require(`${__hooks}/utils/reservation.js`)

    validate(e.record)
    e.next()
    sendConfirmationMail(e.record)
}, 'reservation')


// Record hooks
// ----- //

onRecordAfterCreateSuccess((e) => {
    const {updateItems} = require(`${__hooks}/utils/reservation.js`)

    updateItems(e.record, true)
    e.next()
}, 'reservation')

onRecordAfterUpdateSuccess((e) => {
    const {updateItems} = require(`${__hooks}/utils/reservation.js`)

    if (e.record.getBool('done')) updateItems(e.record, false)
    // TODO: update reservation status if item was removed from or added to a reservation
    e.next()
}, 'reservation')

onRecordAfterDeleteSuccess((e) => {
    const {updateItems} = require(`${__hooks}/utils/reservation.js`)

    updateItems(e.record, false)
    e.next()
}, 'reservation')


// Routes
// ----- //
routerAdd('get', '/reservation/cancel', handleGetCancel)

// Scheduled jobs
// ----- //

cronAdd('clear_reservations', "0 22 * * *", () => {
    const {clearReservations} = require(`${__hooks}/jobs/reservations.js`)
    clearReservations()
})