function runDeleteInactive(app = $app) {
    const { INACTIVE_MONTHS, DELETION_GRACE_PERIOD_DAYS, DRY_MODE } = require(`${__hooks}/constants.js`)
    const customerService = require(`${__hooks}/services/customer.js`)

    app.logger().info('Running inactive customer deletion routine')

    const inactiveCustomers = customerService.getInactive(INACTIVE_MONTHS)
    for (const c of inactiveCustomers) {
        const email = c.getString('email')
        const refDate = new DateTime().addDate(0, 0, -DELETION_GRACE_PERIOD_DAYS)
        const remindedOn = c.getDateTime('delete_reminder_sent')

        if (remindedOn.isZero() || remindedOn.before(refDate.addDate(0, 0, -30))) {
            // never reminded or last reminded long time (x + 30 days) ago
            app.logger().info(`Sending deletion reminder mail to ${email} (${c.id})`)
            customerService.sendDeletionReminderMail(c)
        } else if (remindedOn.before(refDate)) {
            // reminded longer than x days ago
            app.logger().warn(`Deleting ${email} (${c.id}) after they have not responded to reminder mail within ${DELETION_GRACE_PERIOD_DAYS} days`)
            if (!DRY_MODE) app.delete(c)
            else app.logger().info(`Skipping deletion of ${c.id}, because running in dry mode`)
        } else {
            // reminded, but less than x days ago
            app.logger().info(`Currently waiting for reply to deletion reminder from ${email} (${c.id})`)
        }
    }
}

module.exports = {
    runDeleteInactive,
}