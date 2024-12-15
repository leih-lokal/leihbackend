/// <reference path="../pb_data/types.d.ts" />

onRecordCreateRequest((e) => {
    const {validate, sendConfirmationMail} = require(`${__hooks}/utils/reservation.js`)

    validate(e.record)
    e.next()
    sendConfirmationMail(e.record)
}, 'reservation')

onRecordAfterCreateSuccess((e) => {
    const {updateItems} = require(`${__hooks}/utils/reservation.js`)

    updateItems(e.record, true)
    e.next()
}, 'reservation')

onRecordAfterUpdateSuccess((e) => {
    const {updateItems} = require(`${__hooks}/utils/reservation.js`)

    if (e.record.getBool('done')) updateItems(e.record, false)
    e.next()
}, 'reservation')

onRecordDeleteExecute((e) => {
    const {updateItems} = require(`${__hooks}/utils/reservation.js`)

    updateItems(e.record, false)
    e.next()
}, 'reservation')

// Scheduled jobs

cronAdd('clear_reservations', "0 22 * * *", () => {
    const {clearReservations} = require(`${__hooks}/jobs/reservations.js`)
    clearReservations()
})