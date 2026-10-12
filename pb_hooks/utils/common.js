function fmtDateTime(dt) {
    const date = new Date(dt.unix() * 1000)
    return `${date.getDate().toString().padStart(2, '0')}.${(date.getMonth() + 1).toString().padStart(2, '0')}.${date.getFullYear()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')} Uhr`
}

function fmtDate(dt) {
    const date = new Date(dt.unix() * 1000)
    return `${date.getDate().toString().padStart(2, '0')}.${(date.getMonth() + 1).toString().padStart(2, '0')}.${date.getFullYear()}`
}

// e.g. 1234.5 -> '1.234,50 €'
// Format money in JS rather than in Go templates: integer values arrive there as int64 and break printf "%.2f" or comparisons against floats.
function fmtCurrency(value) {
    const [int, dec] = value.toFixed(2).split('.')
    return `${int.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${dec} €`
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

function tryParseJson(str, fallback = null) {
    try {
        return JSON.parse(str)
    } catch(e) {
        return fallback
    }
}

module.exports = {
    fmtDateTime,
    fmtDate,
    fmtCurrency,
    uniqueBy,
    tryParseJson,
}