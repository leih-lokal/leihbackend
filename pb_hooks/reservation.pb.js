/// <reference path="../pb_data/types.d.ts" />

/*
 Developer Notes:
 Most hooks are manually wrapped inside a transaction so that everything will be rolled back if one part fails.
 For example, if a new reservation can't be inserted, the according item statuses must not be updated either.
 Vice versa, if updating the item status fails for whatever reason, there shouldn't be a valid reservation present.
 To ensure valid transaction and prevent deadlocks, all write operations within the call MUST use the transaction all (txApp aka. e.app) provided by wrapTransactional.
 Hopefully, there will be a more convenient way to accomplish this in future releases of Pocketbase.
*/

const { handleGetCancel } = require(`${__hooks}/routes/reservation`)

// Request hooks
// ----- //

onRecordCreateRequest((e) => {
    const { validate, sendConfirmationMail } = require(`${__hooks}/utils/reservation.js`)

    validate(e.record)
    e.next()
    sendConfirmationMail(e.record)
}, 'reservation')


// Record hooks
// ----- //

onRecordCreateExecute((e) => {
    const { wrapTransactional } = require(`${__hooks}/utils/db.js`)
    const { updateItems } = require(`${__hooks}/utils/reservation.js`)

    wrapTransactional(e, (e) => {
        e.next()
        updateItems(e.record, true, e.app)
    })
}, 'reservation')

onRecordUpdateExecute((e) => {
    const { wrapTransactional } = require(`${__hooks}/utils/db.js`)
    const { updateItems } = require(`${__hooks}/utils/reservation.js`)

    wrapTransactional(e, (e) => {
        const oldRecord = $app.findRecordById('reservation', e.record.id)

        e.next()

        const reserved = !e.record.getBool('done')
        const itemIdsOld = oldRecord.getStringSlice('items')
        const itemIdsNew = e.record.getStringSlice('items')
        const itemsRemoved = itemIdsOld.filter(id => !itemIdsNew.includes(id))
        const itemsAdded = itemIdsNew.filter(id => !itemIdsOld.includes(id))

        $app.logger().info(`${itemsRemoved.length} items removed (${itemsRemoved}) and ${itemsAdded.length} added (${itemsAdded}) to reservation ${e.record.id} as part of update`)

        updateItems(e.record, reserved, e.app)
        if (itemsRemoved.length) updateItems(itemsRemoved, false, e.app)
    })

}, 'reservation')

onRecordDeleteExecute((e) => {
    const { wrapTransactional } = require(`${__hooks}/utils/db.js`)
    const { updateItems } = require(`${__hooks}/utils/reservation.js`)

    wrapTransactional(e, (e) => {
        e.next()
        updateItems(e.record, false, e.app)
    })
}, 'reservation')


// Routes
// ----- //
routerAdd('get', '/reservation/cancel', handleGetCancel)

// Scheduled jobs
// ----- //

cronAdd('clear_reservations', "0 22 * * *", () => {
    const { clearReservations } = require(`${__hooks}/jobs/reservations.js`)
    clearReservations()
})