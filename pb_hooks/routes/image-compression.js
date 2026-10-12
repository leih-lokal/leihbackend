function handleGetImageCompression(e) {
    const { getImageCompression } = require(`${__hooks}/services/settings.js`)

    return e.json(200, { image_compression: getImageCompression() })
}

module.exports = {
    handleGetImageCompression,
}
