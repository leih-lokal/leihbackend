const COLOR_RED = 'red',
    COLOR_ORANGE = 'orange',
    COLOR_YELLOW = 'yellow',
    COLOR_GREEN = 'green',
    COLOR_TEAL = 'teal',
    COLOR_BLUE = 'blue',
    COLOR_PURPLE = 'purp',
    COLOR_PINK = 'pink'

const BASE_COLORS = {
    [COLOR_RED]: '#ef4444',
    [COLOR_ORANGE]: '#f97316',
    [COLOR_YELLOW]: '#eab308',
    [COLOR_GREEN]: '#22c55e',
    [COLOR_TEAL]: '#14b8a6',
    [COLOR_BLUE]: '#3b82f6',
    [COLOR_PURPLE]: '#a855f7',
    [COLOR_PINK]: '#ec4899',
}

// Replace existing colors in current data set:
// update customer set highlight_color = 'yellow' where highlight_color = 'rgb(255,255,0)';
// update customer set highlight_color = 'red' where highlight_color = 'rgb(250, 45, 30)';
// update customer set highlight_color = 'green' where highlight_color = 'rgb(131, 235, 52)';
// update customer set highlight_color = 'yellow' where highlight_color = 'rgb(247, 239, 10)';
// update customer set highlight_color = 'blue' where highlight_color = 'rgb(45, 144, 224)';

function rgbStringToHex(rgbString) {
    const match = rgbString.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/)

    if (!match) {
        throw new Error('invalid format')
    }

    const r = parseInt(match[1])
    const g = parseInt(match[2])
    const b = parseInt(match[3])

    if (r < 0 || r > 255 || g < 0 || g > 255 || b < 0 || b > 255) {
        throw new Error('invalid range')
    }

    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

function colorDistance(color1, color2) {
    function hexToRgb(hex) {
        hex = hex.replace('#', '')

        const r = parseInt(hex.substring(0, 2), 16)
        const g = parseInt(hex.substring(2, 4), 16)
        const b = parseInt(hex.substring(4, 6), 16)

        return { r, g, b }
    }

    const rgb1 = hexToRgb(color1)
    const rgb2 = hexToRgb(color2)

    const dr = rgb1.r - rgb2.r
    const dg = rgb1.g - rgb2.g
    const db = rgb1.b - rgb2.b

    return Math.sqrt(dr * dr + dg * dg + db * db)
}

function mapToBaseColor(color) {
    if (!color) return null

    const hexColor = color.startsWith('rgb(') ? rgbStringToHex(color) : color
    return Object.entries(BASE_COLORS).reduce(
        (closest, [name, baseColor]) => {
            const distance = colorDistance(hexColor, baseColor)
            return distance < closest.distance ? { name, distance } : closest
        },
        { name: null, distance: Infinity },
    ).name
}

module.exports = {
    COLOR_RED,
    COLOR_ORANGE,
    COLOR_YELLOW,
    COLOR_GREEN,
    COLOR_TEAL,
    COLOR_BLUE,
    COLOR_PURPLE,
    COLOR_PINK,
    mapToBaseColor,
}
