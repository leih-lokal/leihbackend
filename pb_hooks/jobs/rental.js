function sendReturnReminders() {
    const rentalService = require(`${__hooks}/services/rental.js`)

    const rentals = rentalService.getDueTomorrowRentals()
    for (const r of rentals) {
        const iid = r.getInt('iid')
        const email = r.getString('email')
        const dueDate = r.getDateTime('expected_on')

        $app.logger().info(`Sending reminder mail to ${email} (${iid}) concerning their rental due on ${dueDate.string()}.`)
        rentalService.sendReminderMail(r)
        sleep(1000)
    }
}

module.exports = {
    sendReturnReminders,
}