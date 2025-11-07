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

const INACTIVE_MONTHS = $os.getenv('LL_INACTIVE_MONTHS')
    ? parseInt($os.getenv('LL_INACTIVE_MONTHS'))
    : 24
const DELETION_GRACE_PERIOD_DAYS = $os.getenv('LL_DELETION_GRACE_PERIOD_DAYS')
    ? parseInt($os.getenv('LL_DELETION_GRACE_PERIOD_DAYS'))
    : 7
const NO_WELCOME = $os.getenv('LL_NO_WELCOME') === 'true'
const NO_DELETE_INACTIVE = $os.getenv('LL_NO_DELETE_INACTIVE') === 'true'
const DRY_MODE = $os.getenv('DRY_MODE') !== 'false'

module.exports = {
    OPENING_HOURS, WEEKDAYS, INACTIVE_MONTHS, DELETION_GRACE_PERIOD_DAYS, NO_WELCOME, NO_DELETE_INACTIVE, DRY_MODE
}