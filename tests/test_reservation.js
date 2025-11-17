import * as chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import {getAnonymousClient, getClient} from './base.js'
import {assert} from 'chai'
import {describe, it, before} from 'mocha'

chai.use(chaiAsPromised)

describe('Reservations', () => {
    let client
    let anonymousClient
    let item1, item2, item3
    let customer1, customer2

    before(async () => {
        client = await getClient()
        anonymousClient = await getAnonymousClient()
    })

    beforeEach(async () => {
        item1 = await client.collection('item').getFirstListItem('iid=1000') // apple pie
        item2 = await client.collection('item').getFirstListItem('iid=1001') // goat cheese
        item3 = await client.collection('item').getFirstListItem('iid=1002') // christmas tree
        customer1 = await client.collection('customer').getFirstListItem('iid=1000') // john
        customer2 = await client.collection('customer').getFirstListItem('iid=1001') // jane
    })

    describe('Creation', () => {
        it('should create a reservation for an existing customer', async () => {
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
            assert.equal(reservation.customer_name, `${customer1.firstname} ${customer1.lastname}`) // auto-fill
            assert.equal(reservation.customer_phone, customer1.phone) // auto-fill
            assert.equal(reservation.customer_email, customer1.email) // auto-fill
            assert.isFalse(reservation.is_new_customer) // auto-fill

            item1 = await client.collection('item').getOne(item1.id)
            assert.equal(item1.status, 'reserved')

            await client.collection('reservation').delete(reservation.id)

            item1 = await client.collection('item').getOne(item1.id)
            assert.equal(item1.status, 'instock')
        })

        it('should create a reservation for a new customer', async () => {
            let reservation = await anonymousClient.collection('reservation').create({
                customer_name: 'Bob Bobby',
                customer_phone: '0123456789',
                customer_email: 'bobby@bobbbob.tld',
                items: [item1.id],
                pickup: new Date(Date.parse('2026-12-25T17:00:00Z')),
            })
            assert.isNotNull(reservation)

            await client.collection('reservation').delete(reservation.id)
        })

        it('should fail when required customer fields are missing', async () => {
            let reservationPromise = anonymousClient.collection('reservation').create({
                items: [item1.id],
                pickup: new Date(Date.parse('2026-12-25T17:00:00Z')),
            })
            await assert.isRejected(reservationPromise)
        })

        it('should fail when reserving an unavailable item', async () => {
            let reservationPromise = anonymousClient.collection('reservation').create({
                customer_iid: 1000,
                items: [item3.id],
                pickup: new Date(Date.parse('2026-12-25T17:00:00Z')),
            })
            await assert.isRejected(reservationPromise)
        })
    })

    describe('Status', () => {
        it('should free up item when reservation is marked as done', async () => {
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
        })
    })

    describe('Other', () => {
        it('should send a confirmation email')  // TODO
        it('should handle reservation cancellation')  // TODO
    })
})