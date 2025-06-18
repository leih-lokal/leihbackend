// Business Logic

// update item statuses
// meant to be called right before rental is saved
function updateItems(recordOrItems, outOfStock, app = $app) {
    const itemService = require(`${__hooks}/services/item.js`)
    const { isAvailable } = require(`${__hooks}/utils/item.js`)

    // explicitly not using record expansion here, because would yield empty result for whatever reason
    const items = !(recordOrItems instanceof Array)
        ? app.findRecordsByIds('item', recordOrItems.getStringSlice('items'))
        : app.findRecordsByIds('item', recordOrItems)

    items.forEach(item => {
        if (outOfStock && !isAvailable(item)) throw new InternalServerError(`Can't set status of item ${item.id} to (outofstock: ${outOfStock}), because invalid state`)

        const status = item.getString('status')

        if (outOfStock) return itemService.setStatus(item, 'outofstock', app)
        else if (status === 'outofstock') return itemService.setStatus(item, 'instock', app)
        else app.logger().info(`Not updating status of item ${item.id}, because is not currently out of stock`)
    })
}

module.exports = {
    updateItems,
}