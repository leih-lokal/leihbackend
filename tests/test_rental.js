#!/usr/bin/env node

import { getAnonymousClient, getClient } from './base.js'
import { assert } from 'chai'
import path from 'path'

let client
let anonymousClient

async function run() {
    client = await getClient()
    anonymousClient = await getAnonymousClient()

    await testItemRentals()
    await testCustomerRentals()
    await testRentAvailableItem()
    await testRentAvailableItemAllCopies()
    await testRentMoreCopiesThanAvailable()
    await testRentUnavailableItem()
    await testDoNotMakeRepairingItemsAvailableAgain()
    await testChangeRentedItems()

    console.log(`${path.basename(import.meta.filename).slice(0, -3)} passed ✅`)
}

async function testItemRentals() {
    console.log(`Running testItemRentals`)

    let item1 = await client.collection('item').getFirstListItem('iid=1000') // apple pie

    let stats = await client.collection('item_rentals').getFullList()
    assert.lengthOf(stats, 1)
    assert.equal(stats[0].id, item1.id)
    assert.equal(stats[0].num_rentals, 2)
    assert.equal(stats[0].num_active_rentals, 1)
}

async function testCustomerRentals() {
    console.log(`Running testCustomerRentals`)

    let customer1 = await client.collection('customer').getFirstListItem('iid=1000') // john
    let customer2 = await client.collection('customer').getFirstListItem('iid=1001') // jane

    let stats = await client.collection('customer_rentals').getFullList()
    assert.lengthOf(stats, 2)
    assert.lengthOf(stats.filter(e => e.id === customer1.id), 1)
    assert.equal(stats.filter(e => e.id === customer1.id)[0].num_rentals, 1)
    assert.equal(stats.filter(e => e.id === customer1.id)[0].num_active_rentals, 0)
    assert.lengthOf(stats.filter(e => e.id === customer2.id), 1)
    assert.equal(stats.filter(e => e.id === customer2.id)[0].num_rentals, 1)
    assert.equal(stats.filter(e => e.id === customer2.id)[0].num_active_rentals, 1)
}

async function testRentAvailableItem() {
    console.log(`Running testRentAvailableItem`)

    let item1 = await client.collection('item').getFirstListItem('iid=1000') // apple pie
    let customer1 = await client.collection('customer').getFirstListItem('iid=1000') // john

    let rental = await client.collection('rental').create({
        customer: customer1.id,
        items: [item1.id],
        rented_on: new Date(),
        requested_copies: {
            [item1.id]: 1,
        }
    })
    assert.isNotNull(rental)

    item1 = await client.collection('item').getOne(item1.id)
    assert.equal(item1.status, 'instock')  // item has 4 copies total -> still in stock after renting one

    await client.collection('rental').delete(rental.id)
}

async function testRentAvailableItemAllCopies() {
    console.log(`Running testRentAvailableItemAllCopies`)

    let item1 = await client.collection('item').getFirstListItem('iid=1000') // apple pie
    let customer1 = await client.collection('customer').getFirstListItem('iid=1000') // john

    let rental = await client.collection('rental').create({
        customer: customer1.id,
        items: [item1.id],
        rented_on: new Date(),
        requested_copies: {
            [item1.id]: 3,  // item has 3 copies available (4 total, one rented by jane)
        }
    })
    assert.isNotNull(rental)

    item1 = await client.collection('item').getOne(item1.id)
    assert.equal(item1.status, 'outofstock')  // item should have 3 copies available (4 total, one rented by jane) -> still in stock after renting one

    await client.collection('rental').delete(rental.id)

    item1 = await client.collection('item').getOne(item1.id)
    assert.equal(item1.status, 'instock')
}

async function testRentMoreCopiesThanAvailable() {
    console.log(`Running testRentMoreCopiesThanAvailable`)

    let item1 = await client.collection('item').getFirstListItem('iid=1000') // apple pie
    let customer1 = await client.collection('customer').getFirstListItem('iid=1000') // john

    try {
        await client.collection('rental').create({
            customer: customer1.id,
            items: [item1.id],
            rented_on: new Date(),
            requested_copies: {
                [item1.id]: 4,  // item has 3 copies available (4 total, one rented by jane)
            }
        })
        assert.isTrue(false) // should never get here
    }
    catch (e) { }
}

async function testRentUnavailableItem() {
    console.log(`Running testRentUnavailableItem`)

    let item1 = await client.collection('item').getFirstListItem('iid=1000') // apple pie
    let customer1 = await client.collection('customer').getFirstListItem('iid=1000') // john

    await client.collection('item').update(item1.id, { status: 'repairing' })

    try {
        await client.collection('rental').create({
            customer: customer1.id,
            items: [item1.id],
            rented_on: new Date(),
            requested_copies: {
                [item1.id]: 1,
            }
        })
        assert.isTrue(false) // should never get here
    }
    catch (e) { }
    finally {
        await client.collection('item').update(item1.id, { status: 'instock' }) // clean up
    }
}

async function testDoNotMakeRepairingItemsAvailableAgain() {
    console.log(`Running testDoNotMakeRepairingItemsAvailableAgain`)

    let item1 = await client.collection('item').getFirstListItem('iid=1000') // apple pie
    let customer1 = await client.collection('customer').getFirstListItem('iid=1000') // john

    let rental = await client.collection('rental').create({
            customer: customer1.id,
            items: [item1.id],
            rented_on: new Date(),
            requested_copies: {
                [item1.id]: 1,
            }
        })

    await client.collection('item').update(item1.id, { status: 'repairing' })

    item1 = await client.collection('item').getOne(item1.id)
    assert.equal(item1.status, 'repairing')

    await client.collection('rental').delete(rental.id)
    
    item1 = await client.collection('item').getOne(item1.id)
    assert.equal(item1.status, 'repairing')

    await client.collection('item').update(item1.id, { status: 'instock' })  // clean up
}

async function testChangeRentedItems() {
    console.log(`Running testChangeRentedItems`)

    let item1 = await client.collection('item').getFirstListItem('iid=1000') // apple pie
    let item2 = await client.collection('item').getFirstListItem('iid=1001') // goat cheese
    let customer1 = await client.collection('customer').getFirstListItem('iid=1000') // john

    let rental = await client.collection('rental').create({
            customer: customer1.id,
            items: [item1.id],
            rented_on: new Date(),
            requested_copies: {
                [item1.id]: 3,
            }
        })

    item1 = await client.collection('item').getOne(item1.id)
    item2 = await client.collection('item').getOne(item2.id)
    assert.equal(item1.status, 'outofstock')
    assert.equal(item2.status, 'instock')

    await client.collection('rental').update(rental.id, {
        items: [item2.id]
    })

    item1 = await client.collection('item').getOne(item1.id)
    item2 = await client.collection('item').getOne(item2.id)
    assert.equal(item1.status, 'instock')
    assert.equal(item2.status, 'outofstock')
    
    await client.collection('rental').delete(rental.id)  // clean up

    item2 = await client.collection('item').getOne(item2.id)
    assert.equal(item2.status, 'instock')
}

await run()