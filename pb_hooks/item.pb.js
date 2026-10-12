/// <reference path="../pb_data/types.d.ts" />

/*
 Developer Notes:
 Most hooks are manually wrapped inside a transaction so that everything will be rolled back if one part fails.
 For example, if a new reservation can't be inserted, the according item statuses must not be updated either.
 Vice versa, if updating the item status fails for whatever reason, there shouldn't be a valid reservation present.
 To ensure valid transaction and prevent deadlocks, all write operations within the call MUST use the transaction all (txApp aka. e.app) provided by wrapTransactional.
 Hopefully, there will be a more convenient way to accomplish this in future releases of Pocketbase.
*/

const { handleGetItemsCsv } = require(`${__hooks}/routes/item`)

// Record hooks
// ----- //

onRecordUpdateExecute((e) => {
    const { IMPORT_MODE } = require(`${__hooks}/constants.js`)
    const { wrapTransactional } = require(`${__hooks}/utils/db.js`)
    const { refreshStatus } = require(`${__hooks}/services/item.js`)

    wrapTransactional(e, (e) => {
        const oldRecord = e.app.findRecordById('item', e.record.id)
        e.next()

        // availability depends on the number of copies
        if (!IMPORT_MODE && e.record.getInt('copies') !== oldRecord.getInt('copies')) refreshStatus(e.record, e.app)
    })
}, 'item')

// Routes
// ----- //
routerAdd('get', '/api/item/csv', handleGetItemsCsv, $apis.requireSuperuserAuth())