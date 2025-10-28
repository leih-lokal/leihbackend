/// <reference path="../pb_data/types.d.ts" />

/*
 Developer Notes:
 Most hooks are manually wrapped inside a transaction so that everything will be rolled back if one part fails.
 For example, if a new reservation can't be inserted, the according item statuses must not be updated either.
 Vice versa, if updating the item status fails for whatever reason, there shouldn't be a valid reservation present.
 To ensure valid transaction and prevent deadlocks, all write operations within the call MUST use the transaction all (txApp aka. e.app) provided by wrapTransactional.
 Hopefully, there will be a more convenient way to accomplish this in future releases of Pocketbase.
*/


// Record hooks
// ----- //

onRecordCreateExecute((e) => {
    const { wrapTransactional } = require(`${__hooks}/utils/db.js`)
    const { updateItems } = require(`${__hooks}/services/rental.js`)

    wrapTransactional(e, (e) => {
        e.next()
        updateItems(e.record, true, e.app)
    })
}, 'rental')

onRecordUpdateExecute((e) => {
    const { wrapTransactional } = require(`${__hooks}/utils/db.js`)
    const { updateItems } = require(`${__hooks}/services/rental.js`)

    wrapTransactional(e, (e) => {
        const oldRecord = $app.findRecordById('rental', e.record.id)

        e.next()

        const returnDate = e.record.getDateTime('returned_on')
        const hasBeenReturned = !returnDate.isZero() && !returnDate.equal(oldRecord.getDateTime('returned_on')) && returnDate.before(new DateTime())

        const itemIdsOld = oldRecord.getStringSlice('items')
        const itemIdsNew = e.record.getStringSlice('items')
        const itemsRemoved = itemIdsOld.filter(id => !itemIdsNew.includes(id))
        const itemsAdded = itemIdsNew.filter(id => !itemIdsOld.includes(id))

        $app.logger().info(`Removed ${itemsRemoved.length} items (${itemsRemoved}) and added ${itemsAdded.length} items (${itemsAdded}) to rental ${e.record.id} as part of update`)

        if (itemsRemoved.length) updateItems(itemsRemoved, false, e.app)
        if (itemsAdded.length) updateItems(itemsAdded, !hasBeenReturned, e.app)
        if (hasBeenReturned) updateItems(e.record, false, e.app)
    })

}, 'rental')

onRecordDeleteExecute((e) => {
    const { wrapTransactional } = require(`${__hooks}/utils/db.js`)
    const { updateItems } = require(`${__hooks}/services/rental.js`)

    wrapTransactional(e, (e) => {
        e.next()
        updateItems(e.record, false, e.app)
    })
}, 'rental')

// Routes
// ----- //
const { handleGetRentalsCsv } = require(`${__hooks}/routes/rental`)

routerAdd('get', '/api/rental/csv', handleGetRentalsCsv, $apis.requireSuperuserAuth())

// Scheduled jobs
// ----- //

// note: cron dates are UTC
cronAdd('send_return_reminders', "0 9 * * *", () => {
    const { sendReturnReminders } = require(`${__hooks}/jobs/rental.js`)
    sendReturnReminders()
})