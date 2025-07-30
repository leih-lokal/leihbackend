function prepareEmergencyClosing(app = $app) {
    const { getDueTodayRentals } = require(`${__hooks}/services/rental.js`)
    const { sendEmergencyClosingMail } = require(`${__hooks}/utils/customer.js`)
    const { uniqueBy } = require(`${__hooks}/utils/common.js`)

    const rentals = getDueTodayRentals(app)
    app.expandRecords(rentals, ['customer'])

    const customers = uniqueBy(rentals.map(r => r.expandedOne('customer')), c => c.getString('email'))
    app.logger().info(`Got ${customers.length} customers with rentals that are due today.`)

    customers.forEach(c => {
        const customerEmail = c.getString('email')
        try {
            app.logger().info(`Sending emergency closing notification mail to ${customerEmail} ...`)
            sendEmergencyClosingMail(c)
        } catch (e) {
            app.logger().error(`Failed to send emergency closing notification to ${customerEmail}.`)
        }
    })
}

module.exports = {
    prepareEmergencyClosing,
}