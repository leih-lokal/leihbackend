/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1931900333")

  // update collection data
  unmarshal({
    "viewQuery": "WITH customer_rentals AS\n  (SELECT customer,\n          count(*) AS num_rentals\n   FROM rental\n   GROUP BY customer),\n     customer_rentals_active AS\n  (SELECT customer,\n          count(*) AS num_active_rentals\n   FROM rental\n   WHERE NOT returned_on\n   GROUP BY customer)\nSELECT t1.customer AS id,\n       num_rentals,\n       coalesce(num_active_rentals, 0) AS num_active_rentals\nFROM customer_rentals t1\nLEFT JOIN customer_rentals_active t2 ON t1.customer = t2.customer;"
  }, collection)

  // remove field
  collection.fields.removeById("json4038050209")

  // add field
  collection.fields.addAt(1, new Field({
    "hidden": false,
    "id": "_clone_NsOe",
    "maxSize": 1,
    "name": "num_rentals",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "json"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1931900333")

  // update collection data
  unmarshal({
    "viewQuery": "with\ncustomer_rentals as (select customer, count(*) as num_rentals from rental group by customer),\ncustomer_rentals_active as (select customer, count(*) as num_active_rentals from rental where not returned_on group by customer)\nselect t1.customer as id, num_rentals, coalesce(num_active_rentals, 0) as num_active_rentals from customer_rentals t1 left join customer_rentals_active t2 on t1.customer = t2.customer;"
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
  collection.fields.removeById("_clone_NsOe")

  return app.save(collection)
})
