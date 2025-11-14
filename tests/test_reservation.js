#!/usr/bin/env node

import { getAnonymousClient, getClient } from './base.js'
import { assert } from 'chai'
import path from 'path'

let client
let anonymousClient

async function run() {
    client = await getClient()
    anonymousClient = await getAnonymousClient()

    await testCreateReservationExistingCustomer()
    await testCreateReservationNewCustomer()
    await testCreateReservationMissingFields()
    await testReserveUnavailableItem()
    await testCreateReservationMarkAsDone()

    console.log(`${path.basename(import.meta.filename).slice(0, -3)} passed ✅`)
}

async function testCreateReservationExistingCustomer() {
    console.log(`Running testCreateReservationExistingCustomer`)

    let item1 = await client.collection('item').getFirstListItem('iid=1000') // apple pie
    let customer1 = await client.collection('customer').getFirstListItem('iid=1000') // john

    let reservation = await anonymousClient.collection('reservation').create({
        customer_iid: 1000,
        items: [item1.id],
        pickup: new Date(Date.parse('2026-12-25T17:00:00Z')),
    })
    assert.isNotNull(reservation)
    assert.doesNotHaveAnyKeys(reservation, ['customer_iid',
        'customer_name',
        'customer_email',
        'customer_phone',
        'comments',
        'done',
        'is_new_customer',
        'pickup',
        'items',
        'collectionId',
        'collectionName',
        'updated',
        'expand'])

    reservation = await client.collection('reservation').getOne(reservation.id)
    assert.equal(reservation.customer_name, `${customer1.firstname} ${customer1.lastname}`)  // auto-fill
    assert.equal(reservation.customer_phone, customer1.phone)  // auto-fill
    assert.equal(reservation.customer_email, customer1.email)  // auto-fill
    assert.isFalse(reservation.is_new_customer)  // auto-fill

    item1 = await client.collection('item').getOne(item1.id)
    assert.equal(item1.status, 'reserved')

    await client.collection('reservation').delete(reservation.id)

    item1 = await client.collection('item').getOne(item1.id)
    assert.equal(item1.status, 'instock')
}

async function testCreateReservationNewCustomer() {
    console.log(`Running testCreateReservationNewCustomer`)

    let item1 = await client.collection('item').getFirstListItem('iid=1000') // apple pie

    let reservation = await anonymousClient.collection('reservation').create({
        customer_name: 'Bob Bobby',
        customer_phone: '0123456789',
        customer_email: 'bobby@bobbbob.tld',
        items: [item1.id],
        pickup: new Date(Date.parse('2026-12-25T17:00:00Z')),
    })
    assert.isNotNull(reservation)

    await client.collection('reservation').delete(reservation.id)
}

async function testCreateReservationMissingFields() {
    console.log(`Running testCreateReservationMissingFields`)

    let item1 = await client.collection('item').getFirstListItem('iid=1000') // apple pie

    try {
        let reservation = await anonymousClient.collection('reservation').create({
            items: [item1.id],
            pickup: new Date(Date.parse('2026-12-25T17:00:00Z')),
        })
        assert.isTrue(false)
    } catch (e) { }
}

async function testReserveUnavailableItem() {
    console.log(`Running testReserveUnavailableItem`)

    let item1 = await client.collection('item').getFirstListItem('iid=1002') // christmas tree

    try {
        await anonymousClient.collection('reservation').create({
            customer_iid: 1000,
            items: [item1.id],
            pickup: new Date(Date.parse('2026-12-25T17:00:00Z')),
        })
        assert.isTrue(false)
    } catch (e) { }
}

async function testCreateReservationMarkAsDone() {
    console.log(`Running testCreateReservationMarkAsDone`)

    let item1 = await client.collection('item').getFirstListItem('iid=1000') // apple pie

    let reservation = await anonymousClient.collection('reservation').create({
        customer_iid: 1000,
        items: [item1.id],
        pickup: new Date(Date.parse('2026-12-25T17:00:00Z')),
    })
    assert.isNotNull(reservation)

    item1 = await client.collection('item').getOne(item1.id)
    assert.equal(item1.status, 'reserved')

    await client.collection('reservation').update(reservation.id, {
        done: true
    })

    item1 = await client.collection('item').getOne(item1.id)
    assert.equal(item1.status, 'instock')

    await client.collection('reservation').delete(reservation.id)
}

// TODO: test email sending
// TODO: test reservation cancellation

await run()