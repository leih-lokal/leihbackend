const { OPENING_HOURS, IMAGE_COMPRESSION } = require(`${__hooks}/constants.js`)

/**
 * Read a JSON field from the settings record.
 * Returns null if the settings collection (created by llka-verwaltung on demand), the record or the field doesn't exist.
 */
function getSettingsValue(field, app = $app) {
    const { tryParseJson } = require(`${__hooks}/utils/common.js`)

    try {
        const records = app.findAllRecords('settings')
        if (!records.length) return null

        // getString() returns the field's JSON, whereas get() would return its raw bytes
        return tryParseJson(records[0].getString(field))
    } catch (e) {
        // Collection doesn't exist yet
        return null
    }
}

/**
 * Read opening hours from the settings collection.
 * Falls back to the hardcoded OPENING_HOURS from constants.js
 * if no settings record exists or the field is empty.
 */
function getOpeningHours(app = $app) {
    const value = getSettingsValue('opening_hours', app)
    if (!Array.isArray(value)) return OPENING_HOURS

    // list of [day, open, close] triples, drop malformed entries
    const hours = value
        .filter((entry) => Array.isArray(entry) && entry.length >= 3 && entry.slice(0, 3).every((part) => typeof part === 'string'))
        .map((entry) => entry.slice(0, 3))

    return hours.length ? hours : OPENING_HOURS
}

/**
 * Read image compression settings from the settings collection.
 * Stored values are merged key by key over the defaults (IMAGE_COMPRESSION from constants.js), the same way llka-verwaltung does it:
 * values are kept only if they have the default's type, unknown keys are dropped.
 *
 * Note: images are compressed client-side (llka-verwaltung) only, see https://github.com/leih-lokal/leihbackend/issues/24.
 */
function getImageCompression(app = $app) {
    const IMAGE_OUTPUT_FORMATS = ['keep', 'webp', 'jpeg']

    const settings = { ...IMAGE_COMPRESSION }

    const value = getSettingsValue('image_compression', app)
    if (!value || typeof value !== 'object' || Array.isArray(value)) return settings

    Object.keys(settings).forEach((key) => {
        const v = value[key]
        if (v !== null && typeof v === typeof settings[key] && (typeof v !== 'number' || Number.isFinite(v))) settings[key] = v
    })
    if (!IMAGE_OUTPUT_FORMATS.includes(settings.output_format)) settings.output_format = IMAGE_COMPRESSION.output_format

    return settings
}

module.exports = {
    getOpeningHours,
    getImageCompression,
}
