/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_554352435")

  // add field
  collection.fields.addAt(15, new Field({
    "hidden": false,
    "id": "json978603664",
    "maxSize": 0,
    "name": "returned_items",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "json"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_554352435")

  // remove field
  collection.fields.removeById("json978603664")

  return app.save(collection)
})
