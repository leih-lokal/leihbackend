/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_3739050959")

  // update collection data
  unmarshal({
    "viewQuery": "WITH item_rentals AS\n  (SELECT items.value AS item,\n          count(*) AS num_rentals\n   FROM rental r,\n        json_each(items) items\n   GROUP BY item),\n     item_rentals_active AS\n  (SELECT items.value AS item,\n          count(*) AS num_active_rentals\n   FROM rental r,\n        json_each(items) items\n   WHERE NOT returned_on\n   GROUP BY item)\nSELECT t1.item AS id,\n       num_rentals,\n       coalesce(num_active_rentals, 0) AS num_active_rentals\nFROM item_rentals t1\nLEFT JOIN item_rentals_active t2 ON t1.item = t2.item;"
  }, collection)

  // remove field
  collection.fields.removeById("json4038050209")

  // add field
  collection.fields.addAt(1, new Field({
    "hidden": false,
    "id": "_clone_9Tgy",
    "maxSize": 1,
    "name": "num_rentals",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "json"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_3739050959")

  // update collection data
  unmarshal({
    "viewQuery": "with\nitem_rentals as (select items.value as item, count(*) as num_rentals from rental r, json_each(items) items group by item),\nitem_rentals_active as (select items.value as item, count(*) as num_active_rentals from rental r, json_each(items) items where not returned_on group by item)\nselect t1.item as id, num_rentals, coalesce(num_active_rentals, 0) as num_active_rentals from item_rentals t1 left join item_rentals_active t2 on t1.item = t2.item;"
  }, collection)

  // add field
  collection.fields.addAt(1, new Field({
    "hidden": false,
    "id": "json4038050209",
    "maxSize": 1,
    "name": "num_rentals",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "json"
  }))

  // remove field
  collection.fields.removeById("_clone_9Tgy")

  return app.save(collection)
})
