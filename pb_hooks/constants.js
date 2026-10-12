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

// defaults for image uploads, same as in llka-verwaltung, where images are actually compressed (client-side)
const IMAGE_COMPRESSION = {
    enabled: true,
    max_dimension_px: 1600, // longest edge
    quality: 82, // 1 - 100, for jpeg / webp output
    output_format: 'keep', // keep, webp or jpeg
    skip_if_smaller_than_kb: 200,
}

const INACTIVE_MONTHS = $os.getenv('LL_INACTIVE_MONTHS')
    ? parseInt($os.getenv('LL_INACTIVE_MONTHS'))
    : 24
const DELETION_GRACE_PERIOD_DAYS = $os.getenv('LL_DELETION_GRACE_PERIOD_DAYS')
    ? parseInt($os.getenv('LL_DELETION_GRACE_PERIOD_DAYS'))
    : 7
const NO_WELCOME = $os.getenv('LL_NO_WELCOME') === 'true'
const NO_DELETE_INACTIVE = $os.getenv('LL_NO_DELETE_INACTIVE') === 'true'
const LOOPS_API_KEY = $os.getenv('LOOPS_API_KEY') || ''
const DRY_MODE = $os.getenv('DRY_MODE') !== 'false'
const IMPORT_MODE = $os.getenv('IMPORT_MODE') === 'true'
const LOG_LEVEL = parseInt($os.getenv('LOG_LEVEL') || '4')  // warning

module.exports = {
    OPENING_HOURS,
    IMAGE_COMPRESSION,
    WEEKDAYS,
    INACTIVE_MONTHS,
    DELETION_GRACE_PERIOD_DAYS,
    NO_WELCOME,
    NO_DELETE_INACTIVE,
    LOOPS_API_KEY,
    DRY_MODE,
    IMPORT_MODE,
    LOG_LEVEL,
}
