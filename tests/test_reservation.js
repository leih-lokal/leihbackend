import * as chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { getAnonymousClient, getClient, initImap, listInbox, getFakeMailAccount, configureSmtp, USERNAME, purgeInbox, nextPickup, nextWeekday, fmtDate } from './base.js'
import { assert } from 'chai'
import { describe, it, before } from 'mocha'
import { setTimeout } from 'timers/promises'

chai.use(chaiAsPromised)

describe('Reservations', () => {
    let client
    let anonymousClient
    let imapClient

    let item1, item2, item3, item4
    let customer1, customer2

    const pickup = nextPickup()

    before(async () => {
        client = await getClient()
        anonymousClient = await getAnonymousClient()

        const mailConfig = await getFakeMailAccount()
        imapClient = await initImap(mailConfig.imap)
        await configureSmtp(client, mailConfig.smtp)
        await purgeInbox(imapClient)
    })

    after(async () => {
        await imapClient.end()
    })

    beforeEach(async () => {
        item1 = await client.collection('item').getFirstListItem('iid=1000') // apple pie
        item2 = await client.collection('item').getFirstListItem('iid=1001') // goat cheese
        item3 = await client.collection('item').getFirstListItem('iid=1002') // christmas tree
        item4 = await client.collection('item').getFirstListItem('iid=1003') // fluffy llama
        customer1 = await client.collection('customer').getFirstListItem('iid=1000') // john
        customer2 = await client.collection('customer').getFirstListItem('iid=1001') // jane
    })

    afterEach(async () => {
        await purgeInbox(imapClient)
    })

    describe('General', () => {
        it('should deny access to reservations for anonymous users', async () => {
            let promise = anonymousClient.collection('reservation').getFullList()
            await assert.isRejected(promise)
        })
    })

    describe('Creation', () => {
        it('should create a reservation for an existing customer by iid', async () => {
            let reservation = await anonymousClient.collection('reservation').create({
                customer_iid: 1000,
                items: [item2.id],
                pickup,
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
                'on_premises',
                'expand',])
            assert.doesNotHaveAllKeys(reservation, ['otp'])

            reservation = await client.collection('reservation').getOne(reservation.id)
            assert.equal(reservation.customer_name, `${customer1.firstname} ${customer1.lastname}`) // auto-fill
            assert.equal(reservation.customer_phone, customer1.phone) // auto-fill
            assert.equal(reservation.customer_email, customer1.email) // auto-fill
            assert.equal(reservation.customer_iid, customer1.iid) // auto-fill
            assert.isFalse(reservation.is_new_customer) // auto-fill

            item2 = await client.collection('item').getOne(item2.id)
            assert.equal(item2.status, 'reserved')

            const messages = await listInbox(imapClient)
            assert.lengthOf(messages, 1)
            assert.equal(messages[0].sender, USERNAME)
            assert.equal(messages[0].subject, `Wir haben deine Reservierung für ${fmtDate(pickup)} erhalten`)
            assert.deepEqual(messages[0].recipients, [customer1.email])

            await client.collection('reservation').delete(reservation.id)

            item2 = await client.collection('item').getOne(item2.id)
            assert.equal(item2.status, 'instock')
        })

        it('should create a reservation for an existing customer by email', async () => {
            let reservation = await anonymousClient.collection('reservation').create({
                customer_email: 'johndoe@leihlokal-ka.de',
                items: [item2.id],
                pickup,
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
                'on_premises',
                'expand'])
            assert.doesNotHaveAllKeys(reservation, ['otp'])

            reservation = await client.collection('reservation').getOne(reservation.id)
            assert.equal(reservation.customer_name, `${customer1.firstname} ${customer1.lastname}`) // auto-fill
            assert.equal(reservation.customer_phone, customer1.phone) // auto-fill
            assert.equal(reservation.customer_email, customer1.email) // auto-fill
            assert.equal(reservation.customer_iid, customer1.iid) // auto-fill
            assert.isFalse(reservation.is_new_customer) // auto-fill

            item2 = await client.collection('item').getOne(item2.id)
            assert.equal(item2.status, 'reserved')

            const messages = await listInbox(imapClient)
            assert.lengthOf(messages, 1)
            assert.equal(messages[0].sender, USERNAME)
            assert.equal(messages[0].subject, `Wir haben deine Reservierung für ${fmtDate(pickup)} erhalten`)
            assert.deepEqual(messages[0].recipients, [customer1.email])

            await client.collection('reservation').delete(reservation.id)

            item2 = await client.collection('item').getOne(item2.id)
            assert.equal(item2.status, 'instock')
        })

        it('should list deposits in the confirmation mail', async () => {
            await anonymousClient.collection('reservation').create({
                customer_iid: 1000,
                items: [item1.id, item2.id],  // deposit 10 and 0
                pickup,
            })

            const messages = await listInbox(imapClient)
            assert.lengthOf(messages, 1)
            assert.include(messages[0].body, '(Pfand: 10,00 €)')
            assert.include(messages[0].body, 'Gesamtpfand: 10,00 €')
            assert.notInclude(messages[0].body, '(Pfand: 0,00 €)')  // no deposit shown for item2
            assert.notInclude(messages[0].body, '%!')  // no go template formatting errors
        })

        it('should list non-integer deposits in the confirmation mail', async () => {
            await client.collection('item').update(item2.id, { deposit: 12.5 })

            await anonymousClient.collection('reservation').create({
                customer_iid: 1000,
                items: [item1.id, item2.id],
                pickup,
            })

            const messages = await listInbox(imapClient)
            assert.lengthOf(messages, 1)
            assert.include(messages[0].body, '(Pfand: 10,00 €)')
            assert.include(messages[0].body, '(Pfand: 12,50 €)')
            assert.include(messages[0].body, 'Gesamtpfand: 22,50 €')
        })

        it('should autofill customer info', async () => {
            let reservation = await anonymousClient.collection('reservation').create({
                customer_email: customer1.email,
                items: [item1.id],
                pickup,
            })

            reservation = await client.collection('reservation').getOne(reservation.id)
            assert.equal(reservation.customer_email, customer1.email)
            assert.equal(reservation.customer_name, `${customer1.firstname} ${customer1.lastname}`)
            assert.equal(reservation.customer_phone, customer1.phone)
            assert.equal(reservation.customer_iid, customer1.iid)
        })

        it('should not autofill customer info for non-unique email', async () => {
            await client.collection('customer').update(customer2.id, { email: customer1.email })

            let reservation = await anonymousClient.collection('reservation').create({
                customer_email: 'johndoe@leihlokal-ka.de',  // customer 1 email
                items: [item1.id],
                pickup,
            })

            reservation = await client.collection('reservation').getOne(reservation.id)
            assert.equal(reservation.customer_email, customer1.email)
            assert.isEmpty(reservation.customer_name)  // not required anymore
            assert.isEmpty(reservation.customer_phone)
            assert.equal(reservation.customer_iid, 0)
        })

        it('should create a reservation for a new customer', async () => {
            const testEmail = 'bobby@bobbbob.tld'
            let reservation = await anonymousClient.collection('reservation').create({
                customer_name: 'Bob Bobby',
                customer_phone: '0123456789',
                customer_email: testEmail,
                items: [item1.id],
                pickup,
            })
            assert.isNotNull(reservation)

            const messages = await listInbox(imapClient)
            assert.lengthOf(messages, 1)
            assert.equal(messages[0].sender, USERNAME)
            assert.equal(messages[0].subject, `Wir haben deine Reservierung für ${fmtDate(pickup)} erhalten`)
            assert.deepEqual(messages[0].recipients, [testEmail])
        })

        it('should fail when required customer fields are missing', async () => {
            let reservationPromise = anonymousClient.collection('reservation').create({
                items: [item1.id],
                pickup,
            })
            await assert.isRejected(reservationPromise)
            assert.isEmpty(await listInbox(imapClient))
        })

        it('should fail when reserving an unavailable item', async () => {
            let reservationPromise = anonymousClient.collection('reservation').create({
                customer_iid: 1000,
                items: [item3.id],
                pickup,
            })
            await assert.isRejected(reservationPromise)
            assert.isEmpty(await listInbox(imapClient))
        })

        it('should fail when pickup date is outside opening hours', async () => {
            let reservationPromise = anonymousClient.collection('reservation').create({
                customer_iid: 1000,
                items: [item1.id],
                pickup: nextWeekday(0),  // sunday
            })
            await assert.isRejected(reservationPromise)
            assert.isEmpty(await listInbox(imapClient))
        })

        it('should fail when pickup date is in the past', async () => {
            let reservationPromise = anonymousClient.collection('reservation').create({
                customer_iid: 1000,
                items: [item1.id],
                pickup: new Date().addDays(-1),
            })
            await assert.isRejected(reservationPromise)
            assert.isEmpty(await listInbox(imapClient))
        })

        it('should fail when reserving a protected item as anonymous user but succeed as superuser', async () => {
            await client.collection('item').update(item1.id, { is_protected: true })

            let reservationPromise = anonymousClient.collection('reservation').create({
                customer_iid: 1000,
                items: [item1.id],
                pickup,
            })
            await assert.isRejected(reservationPromise)

            let reservation = await client.collection('reservation').create({
                customer_iid: 1000,
                items: [item1.id],
                pickup,
            })
            assert.isNotNull(reservation)
        })
    })

    describe('Status', () => {
        it('should free up item when reservation is marked as done', async () => {
            let reservation = await anonymousClient.collection('reservation').create({
                customer_iid: 1000,
                items: [item2.id],
                pickup,
            })
            assert.isNotNull(reservation)

            await purgeInbox(imapClient)

            item2 = await client.collection('item').getOne(item2.id)
            assert.equal(item2.status, 'reserved')

            await client.collection('reservation').update(reservation.id, {
                done: true
            })
            assert.isEmpty(await listInbox(imapClient))  // no mail sent for update

            item2 = await client.collection('item').getOne(item2.id)
            assert.equal(item2.status, 'instock')
        })

        it('should properly update item statuses of modified reservation', async () => {
            let reservation = await anonymousClient.collection('reservation').create({
                customer_iid: 1000,
                items: [item2.id],
                pickup,
            })
            assert.isNotNull(reservation)

            item2 = await client.collection('item').getOne(item2.id)
            assert.equal(item2.status, 'reserved')

            await client.collection('reservation').update(reservation.id, {
                items: [item1.id],
            })

            item1 = await client.collection('item').getOne(item1.id)
            item2 = await client.collection('item').getOne(item2.id)
            assert.equal(item1.status, 'instock') // multiple copies, one is reserved now
            assert.equal(item2.status, 'instock')
        })

        it('should not update item status when changing other fields', async () => {
            let reservation = await anonymousClient.collection('reservation').create({
                customer_iid: 1000,
                items: [item2.id],
                pickup,
            })
            assert.isNotNull(reservation)

            item2 = await client.collection('item').getOne(item2.id)
            assert.equal(item2.status, 'reserved')

            await client.collection('reservation').update(reservation.id, {
                comments: 'foobar',
            })

            item2 = await client.collection('item').getOne(item2.id)
            assert.equal(item2.status, 'reserved')
        })
    })

    describe('Copies', () => {
        it('should reserve one copy per reservation of items with multiple copies', async () => {
            // item1 has 4 copies, one of which is rented by jane
            const reserve = () => anonymousClient.collection('reservation').create({
                customer_iid: 1000,
                items: [item1.id],
                pickup,
            })

            await reserve()
            await reserve()
            item1 = await client.collection('item').getOne(item1.id)
            assert.equal(item1.status, 'instock')  // one copy left

            await reserve()
            item1 = await client.collection('item').getOne(item1.id)
            assert.equal(item1.status, 'reserved')  // all remaining copies reserved

            await assert.isRejected(reserve())
        })

        it('should make a copy available again when one of multiple reservations is cancelled', async () => {
            const reserve = () => client.collection('reservation').create({
                customer_iid: 1000,
                items: [item1.id],
                pickup,
            })

            const reservations = [await reserve(), await reserve(), await reserve()]
            item1 = await client.collection('item').getOne(item1.id)
            assert.equal(item1.status, 'reserved')

            await client.collection('reservation').update(reservations[0].id, { done: true })
            item1 = await client.collection('item').getOne(item1.id)
            assert.equal(item1.status, 'instock')

            await reserve()
            item1 = await client.collection('item').getOne(item1.id)
            assert.equal(item1.status, 'reserved')
        })

        it('should update item status when the number of copies changes', async () => {
            await client.collection('reservation').create({
                customer_iid: 1000,
                items: [item2.id],
                pickup,
            })
            item2 = await client.collection('item').getOne(item2.id)
            assert.equal(item2.status, 'reserved')

            await client.collection('item').update(item2.id, { copies: 2 })
            item2 = await client.collection('item').getOne(item2.id)
            assert.equal(item2.status, 'instock')

            await client.collection('item').update(item2.id, { copies: 1 })
            item2 = await client.collection('item').getOne(item2.id)
            assert.equal(item2.status, 'reserved')
        })
    })

    describe('Housekeeping', () => {
        it('should properly clean up old dangling reservations and their item statuses', async () => {
            let newReservation = await client.collection('reservation').create({
                customer_iid: 1000,
                items: [item2.id],
                pickup,
            })
            assert.isNotNull(newReservation)
            assert.isFalse(newReservation.done)
            assert.equal(newReservation.items[0], item2.id)

            item2 = await client.collection('item').getOne(item2.id)
            assert.equal(item2.status, 'reserved')

            let oldReservation = await client.collection('reservation').getFirstListItem('customer_iid = 5000')
            assert.isNotNull(oldReservation)
            assert.isFalse(oldReservation.done)
            assert.equal(oldReservation.items[0], item4.id)

            item4 = await client.collection('item').getOne(item4.id)
            assert.equal(item4.status, 'reserved')

            await client.crons.run('clear_reservations')
            await setTimeout(3000)

            newReservation = await client.collection('reservation').getOne(newReservation.id)
            assert.isFalse(newReservation.done)

            oldReservation = await client.collection('reservation').getOne(oldReservation.id)
            assert.isTrue(oldReservation.done)

            item2 = await client.collection('item').getOne(item2.id)
            assert.equal(item2.status, 'reserved')

            item4 = await client.collection('item').getOne(item4.id)
            assert.equal(item4.status, 'instock')
        })
    })

    describe('Other', () => {
        it('should handle reservation cancellation', async () => {
            let reservation1 = await client.collection('reservation').create({
                customer_iid: 1000,
                items: [item2.id],
                pickup,
            })
            let reservation2 = await client.collection('reservation').create({
                customer_iid: 1000,
                items: [item1.id],
                pickup,
            })

            assert.lengthOf(await client.collection('reservation').getFullList(), 3)  // one old one already existed

            await purgeInbox(imapClient)

            item2 = await client.collection('item').getOne(item2.id)
            assert.equal(item2.status, 'reserved')

            const response = await client.send('/reservation/cancel', {
                query: {
                    token: reservation1.cancel_token
                }
            })
            assert.deepEqual(response, {})  // empty response

            const reservations = await client.collection('reservation').getFullList()
            assert.lengthOf(reservations, 2)  // one old one already existed
            assert.equal(reservations[1].id, reservation2.id)

            item2 = await client.collection('item').getOne(item2.id)
            assert.equal(item2.status, 'instock')

            const messages = await listInbox(imapClient)
            assert.lengthOf(messages, 1)
            assert.equal(messages[0].sender, USERNAME)
            assert.equal(messages[0].subject, `Deine Reservierung für ${fmtDate(pickup)} wurde storniert`)
            assert.deepEqual(messages[0].recipients, [customer1.email])
        })
    })
})
