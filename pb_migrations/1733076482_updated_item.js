/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_940982958")

  // update field
  collection.fields.addAt(6, new Field({
    "hidden": false,
    "id": "file3760176746",
    "maxSelect": 99,
    "maxSize": 20000000,
    "mimeTypes": [
      "image/png",
      "image/jpeg",
      "image/webp"
    ],
    "name": "images",
    "presentable": false,
    "protected": false,
    "required": false,
    "system": false,
    "thumbs": [],
    "type": "file"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_940982958")

  // update field
  collection.fields.addAt(6, new Field({
    "hidden": false,
    "id": "file3760176746",
    "maxSelect": 99,
    "maxSize": 20000,
    "mimeTypes": [
      "image/png",
      "image/jpeg",
      "image/webp"
    ],
    "name": "images",
    "presentable": false,
    "protected": false,
    "required": false,
    "system": false,
    "thumbs": [],
    "type": "file"
  }))

  return app.save(collection)
})
