/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_554352435")

  // add field
  collection.fields.addAt(14, new Field({
    "hidden": false,
    "id": "json3264819232",
    "maxSize": 0,
    "name": "requested_copies",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "json"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_554352435")

  // remove field
  collection.fields.removeById("json3264819232")

  return app.save(collection)
})
