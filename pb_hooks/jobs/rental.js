function sendReturnReminders() {
    const rentalService = require(`${__hooks}/services/rental.js`)

    const rentals = rentalService.getDueTomorrowRentals()
    for (const r of rentals) {
        rentalService.sendReminderMail(r)
        sleep(5000)
    }
}

module.exports = {
    sendReturnReminders,
}