function handleGetCancel(e) {
    const {remove: deleteReservation} = require(`${__hooks}/services/reservation`)
    const {fmtDateTime} = require(`${__hooks}/utils/common.js`)

    const token = e.request.url.query().get('token')
    if (!token) throw new BadRequestError('No token provided')

    const reservation = $app.findFirstRecordByFilter(
        'reservation',
        'cancel_token = {:token} && done = false',
        {token}
    )
    const date = fmtDateTime(reservation.getDateTime('pickup'))
    deleteReservation(reservation)

    const html = $template.loadFiles(
        `${__hooks}/views/layout.html`,
        `${__hooks}/views/reservation_cancellation.html`,
    ).render({date})

    return e.html(200, html)
}

module.exports = {
    handleGetCancel,
}