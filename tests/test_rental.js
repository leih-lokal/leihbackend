import * as chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import {getAnonymousClient, getClient} from './base.js'
import {assert} from 'chai'
import {describe, it, before} from 'mocha'

chai.use(chaiAsPromised)

describe('Rentals', () => {
    let client
    let anonymousClient
    let item1, item2
    let customer1, customer2

    before(async () => {
        client = await getClient()
        anonymousClient = await getAnonymousClient()
    })

    beforeEach(async () => {
        item1 = await client.collection('item').getFirstListItem('iid=1000') // apple pie
        item2 = await client.collection('item').getFirstListItem('iid=1001') // goat cheese
        customer1 = await client.collection('customer').getFirstListItem('iid=1000') // john
        customer2 = await client.collection('customer').getFirstListItem('iid=1001') // jane
    })

    describe('General', () => {
        it('should deny access to rentals for anonymous users', async () => {
            let promise = anonymousClient.collection('rental').getFullList()
            await assert.isRejected(promise)
        })
    })

    describe('Statistics', () => {
        it('should return correct item rental statistics', async () => {
            let stats = await client.collection('item_rentals').getFullList()
            assert.lengthOf(stats, 1)
            assert.equal(stats[0].id, item1.id)
            assert.equal(stats[0].num_rentals, 2)
            assert.equal(stats[0].num_active_rentals, 1)
        })

        it('should return correct customer rental statistics', async () => {
            let stats = await client.collection('customer_rentals').getFullList()
            assert.lengthOf(stats, 2)
            assert.lengthOf(stats.filter(e => e.id === customer1.id), 1)
            assert.equal(stats.filter(e => e.id === customer1.id)[0].num_rentals, 1)
            assert.equal(stats.filter(e => e.id === customer1.id)[0].num_active_rentals, 0)
            assert.lengthOf(stats.filter(e => e.id === customer2.id), 1)
            assert.equal(stats.filter(e => e.id === customer2.id)[0].num_rentals, 1)
            assert.equal(stats.filter(e => e.id === customer2.id)[0].num_active_rentals, 1)
        })
    })

    describe('Status', () => {
        it('should allow renting an available item', async () => {
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
            assert.equal(item1.status, 'instock') // item has 4 copies total -> still in stock after renting one

            await client.collection('rental').delete(rental.id)
        })

        it('should mark item as outofstock when all available copies are rented', async () => {
            let rental = await client.collection('rental').create({
                customer: customer1.id,
                items: [item1.id],
                rented_on: new Date(),
                requested_copies: {
                    [item1.id]: 3, // item has 3 copies available (4 total, one rented by jane)
                }
            })
            assert.isNotNull(rental)

            item1 = await client.collection('item').getOne(item1.id)
            assert.equal(item1.status, 'outofstock')

            await client.collection('rental').delete(rental.id)

            item1 = await client.collection('item').getOne(item1.id)
            assert.equal(item1.status, 'instock')
        })

        it('should fail when renting more copies than available', async () => {
            let rentalPromise = client.collection('rental').create({
                customer: customer1.id,
                items: [item1.id],
                rented_on: new Date(),
                requested_copies: {
                    [item1.id]: 4, // item has 3 copies available (4 total, one rented by jane)
                }
            })

            await assert.isRejected(rentalPromise)
        })

        it('should fail when renting an unavailable item', async () => {
            await client.collection('item').update(item1.id, {status: 'repairing'})

            try {
                const rentalPromise = client.collection('rental').create({
                    customer: customer1.id,
                    items: [item1.id],
                    rented_on: new Date(),
                    requested_copies: {
                        [item1.id]: 1,
                    }
                })
                await assert.isRejected(rentalPromise)
            } finally {
                await client.collection('item').update(item1.id, {status: 'instock'}) // clean up
            }
        })

        it('should keep item status as repairing after return', async () => {
            let rental = await client.collection('rental').create({
                customer: customer1.id,
                items: [item1.id],
                rented_on: new Date(),
                requested_copies: {
                    [item1.id]: 1,
                }
            })

            await client.collection('item').update(item1.id, {status: 'repairing'})

            item1 = await client.collection('item').getOne(item1.id)
            assert.equal(item1.status, 'repairing')

            await client.collection('rental').delete(rental.id)

            item1 = await client.collection('item').getOne(item1.id)
            assert.equal(item1.status, 'repairing')

            await client.collection('item').update(item1.id, {status: 'instock'}) // clean up
        })

        it('should not update item status if rental properties edited', async () => {
            let rental = await client.collection('rental').create({
                customer: customer1.id,
                items: [item1.id],
                rented_on: new Date(),
                requested_copies: {
                    [item1.id]: 3, // item has 3 copies available (4 total, one rented by jane)
                }
            })

            item1 = await client.collection('item').getOne(item1.id)
            assert.equal(item1.status, 'outofstock')

            await client.collection('rental').update(rental.id, {
                remark: 'Blaah',
            })

            item1 = await client.collection('item').getOne(item1.id)
            assert.equal(item1.status, 'outofstock')

            await client.collection('rental').delete(rental.id) // clean up

            item1 = await client.collection('item').getOne(item1.id)
            assert.equal(item1.status, 'instock')
        })

        it('should update item stock correctly when a rental is changed', async () => {
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
                items: [item2.id],
                remark: 'Blaah'
            })

            item1 = await client.collection('item').getOne(item1.id)
            item2 = await client.collection('item').getOne(item2.id)
            assert.equal(item1.status, 'instock')
            assert.equal(item2.status, 'outofstock')

            await client.collection('rental').delete(rental.id) // clean up

            item2 = await client.collection('item').getOne(item2.id)
            assert.equal(item2.status, 'instock')
        })

        it('should update item stock when returning rental', async () => {
            let rental = await client.collection('rental').create({
                customer: customer1.id,
                items: [item1.id],
                rented_on: new Date(),
                requested_copies: {
                    [item1.id]: 3,
                }
            })

            item1 = await client.collection('item').getOne(item1.id)
            assert.equal(item1.status, 'outofstock')

            await client.collection('rental').update(rental.id, {
                returned_on: new Date(),
            })

            item1 = await client.collection('item').getOne(item1.id)
            assert.equal(item1.status, 'instock')

            await client.collection('rental').delete(rental.id) // clean up
        })
    })
})
