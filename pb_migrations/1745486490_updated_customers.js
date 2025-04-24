/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_108570809")

  // add field
  collection.fields.addAt(12, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text747286994",
    "max": 0,
    "min": 0,
    "name": "highlight_color",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(14, new Field({
    "hidden": false,
    "id": "date3339968345",
    "max": "",
    "min": "",
    "name": "renewed_on",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "date"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_108570809")

  // remove field
  collection.fields.removeById("text747286994")

  // remove field
  collection.fields.removeById("date3339968345")

  return app.save(collection)
})
