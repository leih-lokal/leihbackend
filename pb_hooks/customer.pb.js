/// <reference path="../pb_data/types.d.ts" />

/*
 Developer Notes:
 Most hooks are manually wrapped inside a transaction so that everything will be rolled back if one part fails.
 For example, if a new reservation can't be inserted, the according item statuses must not be updated either.
 Vice versa, if updating the item status fails for whatever reason, there shouldn't be a valid reservation present.
 To ensure valid transaction and prevent deadlocks, all write operations within the call MUST use the transaction all (txApp aka. e.app) provided by wrapTransactional.
 Hopefully, there will be a more convenient way to accomplish this in future releases of Pocketbase.
*/

const { handleGetCustomersCsv } = require(`${__hooks}/routes/customer`)

// Record hooks
// ----- //

onRecordAfterCreateSuccess((e) => {
    const { sendWelcomeMail } = require(`${__hooks}/utils/customer.js`)

    e.next()

    const envNoWelcome = $os.getenv('LL_NO_WELCOME')
    if (envNoWelcome === '' || envNoWelcome.toLowerCase() === 'false') {
        $app.logger().info(`Sending welcome mail to ${e.record.getString('email')} ...`)
        sendWelcomeMail(e.record)
    }
}, 'customer')

// Routes
// ----- //

routerAdd('get', '/api/customer/csv', handleGetCustomersCsv, $apis.requireSuperuserAuth())