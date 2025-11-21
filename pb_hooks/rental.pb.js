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
    const { validate, updateItems } = require(`${__hooks}/services/rental.js`)

    wrapTransactional(e, (e) => {
        validate(e.record)
        e.next()
        updateItems(e.record, null, false, e.app)
    })
}, 'rental')

onRecordUpdateExecute((e) => {
    const { wrapTransactional } = require(`${__hooks}/utils/db.js`)
    const { updateItems } = require(`${__hooks}/services/rental.js`)

    wrapTransactional(e, (e) => {
        // TODO: validate status of potentially newly added items
        const oldRecord = $app.findRecordById('rental', e.record.id)
        e.next()
        updateItems(e.record, oldRecord, false, e.app)
    })

}, 'rental')

onRecordDeleteExecute((e) => {
    const { wrapTransactional } = require(`${__hooks}/utils/db.js`)
    const { updateItems } = require(`${__hooks}/services/rental.js`)

    wrapTransactional(e, (e) => {
        const oldRecord = $app.findRecordById('rental', e.record.id)
        e.next()
        updateItems(e.record, oldRecord, true, e.app)
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