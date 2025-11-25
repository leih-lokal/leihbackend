function prepareEmergencyClosing(app = $app) {
    const { getDueTodayRentals } = require(`${__hooks}/services/rental.js`)
    const { sendEmergencyClosingMail } = require(`${__hooks}/services/customer.js`)
    const { uniqueBy } = require(`${__hooks}/utils/common.js`)

    app.logger().info(`Preparing emergency closing.`)

    const rentals = getDueTodayRentals(app)
    app.expandRecords(rentals, ['customer'])

    const customers = uniqueBy(rentals.map(r => r.expandedOne('customer')), c => c.getString('email'))
    app.logger().info(`Got ${customers.length} customers with rentals that would have been due today.`)

    let countSuccess = 0
    customers.forEach(c => {
        const customerEmail = c.getString('email')
        try {
            app.logger().info(`Sending emergency closing notification mail to ${customerEmail}.`)
            sendEmergencyClosingMail(c)
            countSuccess++
            sleep(1000)
        } catch (e) {
            app.logger().error(`Failed to send emergency closing notification to ${customerEmail} - ${e}.`)
        }
    })

    // TODO (minor): update return date to next opening day

    return { successful: countSuccess, failed: customers.length - countSuccess }
}

module.exports = {
    prepareEmergencyClosing,
}
