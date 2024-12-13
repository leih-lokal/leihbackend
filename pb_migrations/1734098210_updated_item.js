/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_940982958")

  // update field
  collection.fields.addAt(4, new Field({
    "hidden": false,
    "id": "select2063623452",
    "maxSelect": 1,
    "name": "status",
    "presentable": false,
    "required": true,
    "system": false,
    "type": "select",
    "values": [
      "instock",
      "deleted",
      "outofstock",
      "onbackorder",
      "reserved",
      "lost",
      "repairing",
      "forsale",
      "deleted",
      "reserved"
    ]
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_940982958")

  // update field
  collection.fields.addAt(4, new Field({
    "hidden": false,
    "id": "select2063623452",
    "maxSelect": 1,
    "name": "status",
    "presentable": false,
    "required": true,
    "system": false,
    "type": "select",
    "values": [
      "instock",
      "deleted",
      "outofstock",
      "onbackorder",
      "reserved",
      "lost",
      "repairing",
      "forsale",
      "deleted"
    ]
  }))

  return app.save(collection)
})
