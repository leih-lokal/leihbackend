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
    const { IMPORT_MODE } = require(`${__hooks}/constants.js`)
    const { wrapTransactional } = require(`${__hooks}/utils/db.js`)
    const { updateItems } = require(`${__hooks}/services/rental.js`)

    wrapTransactional(e, (e) => {
        e.next()

        const customer = e.app.findRecordById('customer', e.record.getString('customer'))
        e.app.logger().info(`Created rental ${e.record.id} for customer ${customer.getInt('iid')}.`)

        if (!IMPORT_MODE) updateItems(e.record, null, false, e.app)
    })
}, 'rental')

onRecordUpdateExecute((e) => {
    const { IMPORT_MODE } = require(`${__hooks}/constants.js`)
    const { wrapTransactional } = require(`${__hooks}/utils/db.js`)
    const { updateItems } = require(`${__hooks}/services/rental.js`)

    wrapTransactional(e, (e) => {
        const oldRecord = e.app.findRecordById('rental', e.record.id)
        e.next()

        const customer = e.app.findRecordById('customer', e.record.getString('customer'))
        e.app.logger().info(`Updated rental ${e.record.id} of customer ${customer.getInt('iid')}.`)

        if (!IMPORT_MODE) updateItems(e.record, oldRecord, false, e.app)
    })

}, 'rental')

onRecordDeleteExecute((e) => {
    const { IMPORT_MODE } = require(`${__hooks}/constants.js`)
    const { wrapTransactional } = require(`${__hooks}/utils/db.js`)
    const { updateItems } = require(`${__hooks}/services/rental.js`)

    wrapTransactional(e, (e) => {
        const oldRecord = e.app.findRecordById('rental', e.record.id)

        let customerIdentity = e.record.getString('customer')
        try {
            customerIdentity = e.app.findRecordById('customer', e.record.getString('customer')).getInt('iid')
        } catch (e) { /* e.g. in cascade customer deletion cascades to rental deletion (-> customer not existing anymore) */ }

        e.next()

        e.app.logger().info(`Deleted rental ${e.record.id} of customer ${customerIdentity}.`)

        if (!IMPORT_MODE) updateItems(e.record, oldRecord, true, e.app)
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
