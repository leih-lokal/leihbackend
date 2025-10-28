/// <reference path="../pb_data/types.d.ts" />

/*
 Developer Notes:
 Most hooks are manually wrapped inside a transaction so that everything will be rolled back if one part fails.
 For example, if a new reservation can't be inserted, the according item statuses must not be updated either.
 Vice versa, if updating the item status fails for whatever reason, there shouldn't be a valid reservation present.
 To ensure valid transaction and prevent deadlocks, all write operations within the call MUST use the transaction all (txApp aka. e.app) provided by wrapTransactional.
 Hopefully, there will be a more convenient way to accomplish this in future releases of Pocketbase.
*/

const { handleGetCancel, handleGetReservationsCsv } = require(`${__hooks}/routes/reservation`)

// Request hooks
// ----- //

onRecordCreateRequest((e) => {
    const { validate, autofillCustomer, sendConfirmationMail } = require(`${__hooks}/services/reservation.js`)

    // hide record information for non-authenticated users
    // especially hide customer data to prevent leaking personal information by enumerating customer ids
    if (!e.requestEvent.auth) {
        e.record.hide(
            'customer_iid',
            'customer_name',
            'customer_email',
            'customer_phone',
            'comments', 
            'done',
            'is_new_customer',
            'pickup',
            'items',
            'collectionId', 
            'collectionName',
            'id',
            'updated',
            'expand',
        )
    }

    autofillCustomer(e.record)
    validate(e.record)
    
    e.next()

    const recordId = e.record.get('id')
    try {
        sendConfirmationMail(e.record)
    } catch(e) {
        console.error(`Failed to send confirmation for reservation ${recordId} – ${e}`)
    }
}, 'reservation')

onRecordUpdateRequest((e) => {
    if (!e.record.getBool('done')) {
        const oldRecord = $app.findRecordById('reservation', e.record.id)
        if (oldRecord.getBool('done')) throw new BadRequestError('Can\'t undo a closed reservation')
    }
    e.next()
}, 'reservation')


// Record hooks
// ----- //

onRecordCreateExecute((e) => {
    const { wrapTransactional } = require(`${__hooks}/utils/db.js`)
    const { updateItems } = require(`${__hooks}/services/reservation.js`)

    wrapTransactional(e, (e) => {
        e.next()
        updateItems(e.record, true, e.app)
    })
}, 'reservation')

onRecordUpdateExecute((e) => {
    const { wrapTransactional } = require(`${__hooks}/utils/db.js`)
    const { updateItems } = require(`${__hooks}/services/reservation.js`)

    wrapTransactional(e, (e) => {
        const oldRecord = $app.findRecordById('reservation', e.record.id)

        e.next()

        // Note: "undoing" a closed transaction will not update item statuses accordingly.
        // Instead, undoing should be prevented beforehand on a request level
        const done = e.record.getBool('done')

        const itemIdsOld = oldRecord.getStringSlice('items')
        const itemIdsNew = e.record.getStringSlice('items')
        const itemsRemoved = itemIdsOld.filter(id => !itemIdsNew.includes(id))
        const itemsAdded = itemIdsNew.filter(id => !itemIdsOld.includes(id))

        $app.logger().info(`Removed ${itemsRemoved.length} items (${itemsRemoved}) and added ${itemsAdded.length} items (${itemsAdded}) to reservation ${e.record.id} as part of update`)

        if (itemsRemoved.length) updateItems(itemsRemoved, false, e.app)
        if (itemsAdded.length) updateItems(itemsAdded, !done, e.app)
        if (done) updateItems(e.record, false, e.app)
    })

}, 'reservation')

onRecordDeleteExecute((e) => {
    const { wrapTransactional } = require(`${__hooks}/utils/db.js`)
    const { updateItems } = require(`${__hooks}/services/reservation.js`)

    wrapTransactional(e, (e) => {
        e.next()
        updateItems(e.record, false, e.app)
    })
}, 'reservation')


// Routes
// ----- //
routerAdd('get', '/reservation/cancel', handleGetCancel)
routerAdd('get', '/api/reservation/csv', handleGetReservationsCsv, $apis.requireSuperuserAuth())

// Scheduled jobs
// ----- //

// note: cron dates are UTC
cronAdd('clear_reservations', "0 22 * * *", () => {
    const { clearReservations } = require(`${__hooks}/jobs/reservations.js`)
    clearReservations()
})