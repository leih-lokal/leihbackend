function handlePostEmergencyClosing(e) {
    const { prepareEmergencyClosing } = require(`${__hooks}/services/misc`)

    // Ideally, this would run in the background in a non-blocking fashion.
    // However, that is not supported by JSVM. You'd need Go for this. Perhaps refactor some day? 
    // https://github.com/pocketbase/pocketbase/discussions/6592
    // https://github.com/pocketbase/pocketbase/discussions/5235

    const stats = prepareEmergencyClosing()
    return e.json(200, { ...stats })
}

module.exports = {
    handlePostEmergencyClosing,
}