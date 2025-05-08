/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = new Collection({
    "createRule": null,
    "deleteRule": null,
    "fields": [
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text3208210256",
        "max": 0,
        "min": 0,
        "name": "id",
        "pattern": "^[a-z0-9]+$",
        "presentable": false,
        "primaryKey": true,
        "required": true,
        "system": true,
        "type": "text"
      },
      {
        "hidden": false,
        "id": "json4038050209",
        "maxSize": 1,
        "name": "num_rentals",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "json"
      },
      {
        "hidden": false,
        "id": "json2225521035",
        "maxSize": 1,
        "name": "num_active_rentals",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "json"
      }
    ],
    "id": "pbc_3739050959",
    "indexes": [],
    "listRule": null,
    "name": "item_rentals",
    "system": false,
    "type": "view",
    "updateRule": null,
    "viewQuery": "with\nitem_rentals as (select items.value as item, count(*) as num_rentals from rental r, json_each(items) items group by item),\nitem_rentals_active as (select items.value as item, count(*) as num_active_rentals from rental r, json_each(items) items where not returned_on group by item)\nselect t1.item as id, num_rentals, coalesce(num_active_rentals, 0) as num_active_rentals from item_rentals t1 left join item_rentals_active t2 on t1.item = t2.item;",
    "viewRule": null
  });

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_3739050959");

  return app.delete(collection);
})
