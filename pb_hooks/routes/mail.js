function handleGetDefaults(e) {
    const { getDefaults } = require(`${__hooks}/services/mail.js`)

    return e.json(200, getDefaults())
}

// Render a mail with example data, using the given templates, else the stored custom ones, else the defaults
function handlePostPreview(e) {
    const { MAILS, LAYOUT_KEY, render, getCustomTemplate, validateTemplate } = require(`${__hooks}/services/mail.js`)

    const { key, subject, body, layout } = e.requestInfo().body
    if (!(key in MAILS)) throw new BadRequestError(`Unknown mail ${key}`)

    validateTemplate(key, { subject, body })
    if (layout) validateTemplate(LAYOUT_KEY, { body: layout })

    const templates = { ...getCustomTemplate(key), layout: getCustomTemplate(LAYOUT_KEY)?.body }
    if (subject !== undefined) templates.subject = subject
    if (body !== undefined) templates.body = body
    if (layout !== undefined) templates.layout = layout

    try {
        return e.json(200, render(key, MAILS[key].example, templates))
    } catch (err) {
        throw new BadRequestError(`Invalid template – ${err.message || err}`)
    }
}

module.exports = {
    handleGetDefaults,
    handlePostPreview,
}
