function handleGetCancel(e) {
    const {remove: deleteReservation, sendCancellationMail} = require(`${__hooks}/services/reservation.js`)
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

    try {
        sendCancellationMail(reservation)
    } catch(e) {
        $app.logger().error(`Failed to send cancellation mail for reservation ${reservation.id} – ${e}.`)
    }

    const html = $template.loadFiles(`${__hooks}/views/layout.html`, `${__hooks}/views/reservation_cancelled.html`).render({date})

    return e.html(200, html)
}

function handleGetCsv(e) {
    const {exportCsv} = require(`${__hooks}/services/reservation.js`)

    const result = exportCsv()
    const ts = new DateTime().unix()

    e.response.header().set('content-type', 'text/csv')
    e.response.header().set('content-disposition', `attachment; filename="reservations_${ts}.csv"`)
    return e.string(200, result)
}

module.exports = {
    handleGetCancel,
    handleGetReservationsCsv: handleGetCsv,
}
