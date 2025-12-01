/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_2990107169")

  // add field
  collection.fields.addAt(11, new Field({
    "autogeneratePattern": "[0-9]{6}",
    "hidden": false,
    "id": "text2812057793",
    "max": 0,
    "min": 0,
    "name": "otp",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(12, new Field({
    "hidden": false,
    "id": "bool3847079189",
    "name": "on_premises",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "bool"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_2990107169")

  // remove field
  collection.fields.removeById("text2812057793")

  // remove field
  collection.fields.removeById("bool3847079189")

  return app.save(collection)
})
