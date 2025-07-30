function fmtDateTime(dt) {
    const date = new Date(dt.unix() * 1000)
    return `${date.getDate().toString().padStart(2, '0')}.${(date.getMonth() + 1).toString().padStart(2, '0')}.${date.getFullYear()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')} Uhr`
}

function uniqueBy(arr, keyFn) {
    const seen = new Set()
    return arr.filter(item => {
        if (seen.has(keyFn(item))) {
            return false
        } else {
            seen.add(keyFn(item))
            return true;
        }
    })
}

module.exports = {
    fmtDateTime,
    uniqueBy,
}