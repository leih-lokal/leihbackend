/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_108570809")

  // remove field
  collection.fields.removeById("text623740637")

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_108570809")

  // add field
  collection.fields.addAt(6, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text623740637",
    "max": 0,
    "min": 0,
    "name": "house_number",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  return app.save(collection)
})
