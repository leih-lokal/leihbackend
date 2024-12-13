const WEEKDAYS = {
    'sun': 0,
    'mon': 1,
    'tue': 2,
    'wed': 3,
    'thu': 4,
    'fri': 5,
    'sat': 6,
}

// in local timezone
const OPENING_HOURS = [
    ['mon', '15:00', '19:00'],
    ['thu', '15:00', '19:00'],
    ['fri', '15:00', '19:00'],
    ['sat', '10:00', '14:00'],
]

module.exports = {
    OPENING_HOURS, WEEKDAYS
}