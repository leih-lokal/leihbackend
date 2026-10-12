/// <reference path="../pb_data/types.d.ts" />

// Item availability statuses (instock, reserved, outofstock) are derived from the number of copies, rented copies (minus partially returned ones)
// and active reservations (one copy each) now. Existing items still carry statuses derived the old way (e.g. reserved as soon as one copy was reserved,
// or outofstock despite partially returned copies), so derive them once. Manually set statuses (e.g. repairing) are left as is.
migrate((app) => {
  const items = app.findAllRecords('item')
  if (!items.length) return

  const { refreshStatus } = require(`${__hooks}/services/item.js`)
  items.forEach((item) => refreshStatus(item, app))
}, (app) => {
  // nothing to revert, statuses derived the old way can't be restored
})
