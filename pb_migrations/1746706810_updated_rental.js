/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_554352435")

  // add field
  collection.fields.addAt(10, new Field({
    "hidden": false,
    "id": "date405521115",
    "max": "",
    "min": "",
    "name": "extended_on",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "date"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_554352435")

  // remove field
  collection.fields.removeById("date405521115")

  return app.save(collection)
})
