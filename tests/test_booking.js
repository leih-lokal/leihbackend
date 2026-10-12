import * as chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { getAnonymousClient, getClient } from './base.js'
import { assert } from 'chai'
import { describe, it, before } from 'mocha'

chai.use(chaiAsPromised)

function futureDate(days) {
    const d = new Date()
    d.addDays(days)
    return d
}

describe('Bookings', () => {
    let client
    let anonymousClient
    let item1 // protected item (set up in beforeEach())
    let item2 // non-protected item

    before(async () => {
        client = await getClient()
        anonymousClient = await getAnonymousClient()
    })

    beforeEach(async () => {
        item1 = await client.collection('item').getFirstListItem('iid=1000') // apple pie (4 copies)
        item2 = await client.collection('item').getFirstListItem('iid=1001') // goat cheese (1 copy)

        // make item1 protected for booking tests
        await client.collection('item').update(item1.id, { is_protected: true })
    })

    describe('General', () => {
        it('should deny access for anonymous users', async () => {
            await assert.isRejected(anonymousClient.collection('booking').getFullList())
        })

        it('should deny creation for anonymous users', async () => {
            await assert.isRejected(anonymousClient.collection('booking').create({
                item: item1.id,
                customer_name: 'Anon',
                start_date: futureDate(1),
                end_date: futureDate(5),
                status: 'reserved',
            }))
        })
    })

    describe('Creation', () => {
        it('should create a booking with minimal fields', async () => {
            const booking = await client.collection('booking').create({
                item: item1.id,
                customer_name: 'Max Mustermann',
                start_date: futureDate(1),
                end_date: futureDate(5),
                status: 'reserved',
            })
            assert.isNotNull(booking)
            assert.equal(booking.item, item1.id)
            assert.equal(booking.customer_name, 'Max Mustermann')
            assert.equal(booking.status, 'reserved')
        })

        it('should create a booking with all fields', async () => {
            const customer = await client.collection('customer').getFirstListItem('iid=1000')
            const booking = await client.collection('booking').create({
                item: item1.id,
                customer: customer.id,
                customer_name: 'John Doe',
                customer_phone: '+491234567890',
                customer_email: 'johndoe@leihlokal-ka.de',
                start_date: futureDate(1),
                end_date: futureDate(5),
                status: 'reserved',
                notes: 'Called Monday',
            })
            assert.equal(booking.customer, customer.id)
            assert.equal(booking.customer_phone, '+491234567890')
            assert.equal(booking.notes, 'Called Monday')
        })

        it('should reject booking for non-protected item', async () => {
            await assert.isRejected(client.collection('booking').create({
                item: item2.id,
                customer_name: 'Test',
                start_date: futureDate(1),
                end_date: futureDate(5),
                status: 'reserved',
            }))
        })
    })

    describe('Date validation', () => {
        it('should reject end_date before start_date', async () => {
            await assert.isRejected(client.collection('booking').create({
                item: item1.id,
                customer_name: 'Test',
                start_date: futureDate(5),
                end_date: futureDate(1),
                status: 'reserved',
            }))
        })

        // NOTE: start_date-in-the-past validation is currently not enforced
        // due to record.original being truthy on create in PocketBase JSVM.
        // See pb_hooks/services/booking.js validateDates().

        it('should allow single-day booking (start = end)', async () => {
            const booking = await client.collection('booking').create({
                item: item1.id,
                customer_name: 'Test',
                start_date: futureDate(7),
                end_date: futureDate(7),
                status: 'reserved',
            })
            assert.isNotNull(booking)
        })
    })

    describe('Overlap prevention', () => {
        it('should reject overlapping booking for single-copy item', async () => {
            // temporarily set item1 to 1 copy
            await client.collection('item').update(item1.id, { copies: 1 })

            await client.collection('booking').create({
                item: item1.id,
                customer_name: 'First',
                start_date: futureDate(10),
                end_date: futureDate(20),
                status: 'reserved',
            })

            // fully overlapping
            await assert.isRejected(client.collection('booking').create({
                item: item1.id,
                customer_name: 'Second',
                start_date: futureDate(12),
                end_date: futureDate(18),
                status: 'reserved',
            }))

            // partially overlapping (start)
            await assert.isRejected(client.collection('booking').create({
                item: item1.id,
                customer_name: 'Second',
                start_date: futureDate(15),
                end_date: futureDate(25),
                status: 'reserved',
            }))
        })

        it('should allow non-overlapping bookings', async () => {
            await client.collection('item').update(item1.id, { copies: 1 })

            await client.collection('booking').create({
                item: item1.id,
                customer_name: 'First',
                start_date: futureDate(10),
                end_date: futureDate(15),
                status: 'reserved',
            })

            // booking before
            const before = await client.collection('booking').create({
                item: item1.id,
                customer_name: 'Before',
                start_date: futureDate(1),
                end_date: futureDate(9),
                status: 'reserved',
            })
            assert.isNotNull(before)

            // booking after
            const after = await client.collection('booking').create({
                item: item1.id,
                customer_name: 'After',
                start_date: futureDate(16),
                end_date: futureDate(20),
                status: 'reserved',
            })
            assert.isNotNull(after)
        })

        it('should respect item.copies for multi-copy items', async () => {
            await client.collection('item').update(item1.id, { copies: 2 })

            // first two overlapping bookings should succeed
            await client.collection('booking').create({
                item: item1.id,
                customer_name: 'Copy 1',
                start_date: futureDate(10),
                end_date: futureDate(20),
                status: 'reserved',
            })
            await client.collection('booking').create({
                item: item1.id,
                customer_name: 'Copy 2',
                start_date: futureDate(12),
                end_date: futureDate(18),
                status: 'reserved',
            })

            // third should fail
            await assert.isRejected(client.collection('booking').create({
                item: item1.id,
                customer_name: 'Copy 3',
                start_date: futureDate(14),
                end_date: futureDate(16),
                status: 'reserved',
            }))
        })

        it('should not count returned bookings as conflicts', async () => {
            await client.collection('item').update(item1.id, { copies: 1 })

            const booking = await client.collection('booking').create({
                item: item1.id,
                customer_name: 'Returner',
                start_date: futureDate(10),
                end_date: futureDate(20),
                status: 'reserved',
            })

            // return it
            await client.collection('booking').update(booking.id, { status: 'returned' })

            // same date range should now be available
            const newBooking = await client.collection('booking').create({
                item: item1.id,
                customer_name: 'New Person',
                start_date: futureDate(10),
                end_date: futureDate(20),
                status: 'reserved',
            })
            assert.isNotNull(newBooking)
        })
    })

    describe('Status transitions', () => {
        it('should allow valid transitions through full lifecycle', async () => {
            // reserved -> active -> returned
            const b1 = await client.collection('booking').create({
                item: item1.id,
                customer_name: 'Lifecycle 1',
                start_date: futureDate(1),
                end_date: futureDate(5),
                status: 'reserved',
            })
            let updated = await client.collection('booking').update(b1.id, { status: 'active' })
            assert.equal(updated.status, 'active')
            updated = await client.collection('booking').update(b1.id, { status: 'returned' })
            assert.equal(updated.status, 'returned')

            // reserved -> active -> overdue -> returned
            const b2 = await client.collection('booking').create({
                item: item1.id,
                customer_name: 'Lifecycle 2',
                start_date: futureDate(10),
                end_date: futureDate(15),
                status: 'reserved',
            })
            await client.collection('booking').update(b2.id, { status: 'active' })
            await client.collection('booking').update(b2.id, { status: 'overdue' })
            updated = await client.collection('booking').update(b2.id, { status: 'returned' })
            assert.equal(updated.status, 'returned')

            // reserved -> returned (cancelled before pickup)
            const b3 = await client.collection('booking').create({
                item: item1.id,
                customer_name: 'Lifecycle 3',
                start_date: futureDate(20),
                end_date: futureDate(25),
                status: 'reserved',
            })
            updated = await client.collection('booking').update(b3.id, { status: 'returned' })
            assert.equal(updated.status, 'returned')
        })

        it('should reject invalid status transitions', async () => {
            const booking = await client.collection('booking').create({
                item: item1.id,
                customer_name: 'Invalid',
                start_date: futureDate(30),
                end_date: futureDate(35),
                status: 'reserved',
            })

            // reserved -> overdue (skip active)
            await assert.isRejected(client.collection('booking').update(booking.id, { status: 'overdue' }))

            // move to returned (terminal)
            await client.collection('booking').update(booking.id, { status: 'returned' })

            // returned -> anything
            await assert.isRejected(client.collection('booking').update(booking.id, { status: 'active' }))
            await assert.isRejected(client.collection('booking').update(booking.id, { status: 'reserved' }))
        })

        it('should reject overdue -> active', async () => {
            const booking = await client.collection('booking').create({
                item: item1.id,
                customer_name: 'Overdue',
                start_date: futureDate(40),
                end_date: futureDate(45),
                status: 'reserved',
            })
            await client.collection('booking').update(booking.id, { status: 'active' })
            await client.collection('booking').update(booking.id, { status: 'overdue' })

            await assert.isRejected(client.collection('booking').update(booking.id, { status: 'active' }))
        })
    })

    describe('Cron', () => {
        it('should have the mark_overdue_bookings cron registered', async () => {
            const crons = await client.crons.getFullList()
            assert.includeDeepMembers(crons, [{
                id: 'mark_overdue_bookings',
                expression: '0 22 * * *',
            }])
        })
    })
})
