/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
    const collection = app.findCollectionByNameOrId("pbc_2990107169")

    // add field
    collection.fields.addAt(10, new Field({
        "autogeneratePattern": "[a-z0-9]{32}",
        "hidden": true,
        "id": "text2941508743",
        "max": 0,
        "min": 0,
        "name": "cancel_token",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
    }))

    return app.save(collection)
}, (app) => {
    const collection = app.findCollectionByNameOrId("pbc_2990107169")

    // remove field
    collection.fields.removeById("text2941508743")

    return app.save(collection)
})
