import * as chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { getAnonymousClient, getClient, initImap, listInbox, getFakeMailAccount, configureSmtp, USERNAME, purgeInbox } from './base.js'
import { assert } from 'chai'
import { describe, it, before } from 'mocha'
import { setTimeout } from 'timers/promises'

chai.use(chaiAsPromised)

describe('Customer', () => {
    let client
    let anonymousClient
    let imapClient

    let item1

    before(async () => {
        client = await getClient()
        anonymousClient = await getAnonymousClient()

        const mailConfig = await getFakeMailAccount()
        imapClient = await initImap(mailConfig.imap)
        await configureSmtp(client, mailConfig.smtp)
        await purgeInbox(imapClient)
    })

    beforeEach(async () => {
        item1 = await client.collection('item').getFirstListItem('iid=1000') // apple pie
    })

    after(async () => {
        await imapClient.end()
    })

    afterEach(async () => {
        await purgeInbox(imapClient)
    })

    it('should deny access to customers for anonymous users', async () => {
        let promise = anonymousClient.collection('customer').getFullList()
        await assert.isRejected(promise)
    })

    it('should fail to create customer with an existing iid', async () => {
        const promise = client.collection('customer').create({
            iid: 1000,
            firstname: 'Justus',
            lastname: 'Jonas',
            email: 'justusjonas@leihlokal-ka.de',
            phone: '+49123456789012',
            registered_on: new Date(),
        })
        await assert.isRejected(promise)
    })

    it('should send a welcome mail to new customers', async () => {
        let testCustomer = await client.collection('customer').create({
            iid: 2000,
            firstname: 'Justus',
            lastname: 'Jonas',
            email: 'justusjonas@leihlokal-ka.de',
            phone: '+49123456789012',
            registered_on: new Date(),
        })

        assert.isNotNull(testCustomer)

        const messages = await listInbox(imapClient)
        assert.lengthOf(messages, 1)
        assert.equal(messages[0].sender, USERNAME)
        assert.equal(messages[0].subject, 'Herzlich Willkommen im leih.lokal!')
        assert.deepEqual(messages[0].recipients, [testCustomer.email])

        await client.collection('customer').delete(testCustomer.id)
    })

    describe('Auto-deletion', () => {
        it('should send deletion notice to old customer', async () => {
            let customer = await client.collection('customer').create({
                iid: 1500,
                firstname: 'Patrick',
                lastname: 'Star',
                email: 'patrick@crustycrab.com',
                phone: '012345678910',
                registered_on: new Date().addYears(-2).addDays(-2),
            })
            await purgeInbox(imapClient)

            const crons = await client.crons.getFullList()
            assert.includeDeepMembers(crons, [
                {
                    id: 'run_customer_deletion',
                    expression: '30 8 * * *',
                },
            ])

            const t0 = new Date()
            await client.crons.run('run_customer_deletion')
            await setTimeout(3100)

            let messages = await listInbox(imapClient)
            assert.lengthOf(messages, 1)
            assert.equal(messages[0].sender, USERNAME)
            assert.equal(messages[0].subject, `[leih.lokal] Löschung Ihrer Daten im leih.lokal nach Inaktivität (Kunden-Nr. ${customer.iid})`)
            assert.deepEqual(messages[0].recipients, [customer.email])

            let logs = await client.logs.getList(1, 10, { sort: '-created' })
            let filteredLogs = logs.items.filter((l) => l.message === `Sending deletion reminder mail to ${customer.email} (${customer.id}).`)
            assert.lengthOf(filteredLogs, 1)

            customer = await client.collection('customer').getOne(customer.id)
            assert.isAtLeast(new Date(customer.delete_reminder_sent).getTime(), t0.getTime())
            assert.isAtMost(new Date(customer.delete_reminder_sent).getTime(), new Date().getTime())

            await client.collection('customer').delete(customer.id)
        })

        it('should not send deletion notice to customer with recent rental', async () => {
            let customer = await client.collection('customer').create({
                iid: 1500,
                firstname: 'SpongeBob',
                lastname: 'SquarePants',
                email: 'spongebob@bikinibottom.com',
                phone: '012345678911',
                registered_on: new Date().addYears(-3),
            })
            await purgeInbox(imapClient)

            const rental = await client.collection('rental').create({
                customer: customer.id,
                items: [item1.id],
                rented_on: new Date().addYears(-1).addDays(-1),
                requested_copies: {
                    [item1.id]: 1,
                },
            })

            await client.crons.run('run_customer_deletion')
            await setTimeout(3100)

            let messages = await listInbox(imapClient) // should not send a deletion reminder email
            assert.lengthOf(messages, 0)

            await client.collection('rental').delete(rental.id)
            await client.collection('customer').delete(customer.id)
        })

        it('should send deletion notice to customer with old rental', async () => {
            let customer = await client.collection('customer').create({
                iid: 1500,
                firstname: 'Patrick',
                lastname: 'Star',
                email: 'patrick@crustycrab.com',
                phone: '012345678912',
                registered_on: new Date().addYears(-3).addDays(-1),
            })
            await purgeInbox(imapClient)

            let rental = await client.collection('rental').create({
                customer: customer.id,
                items: [item1.id],
                rented_on: new Date().addYears(-3),
                requested_copies: {
                    [item1.id]: 1,
                },
            })

            await client.crons.run('run_customer_deletion')
            await setTimeout(3100)

            let messages = await listInbox(imapClient)
            assert.lengthOf(messages, 1)
            assert.equal(messages[0].sender, USERNAME)
            assert.equal(messages[0].subject, `[leih.lokal] Löschung Ihrer Daten im leih.lokal nach Inaktivität (Kunden-Nr. ${customer.iid})`)
            assert.deepEqual(messages[0].recipients, [customer.email])

            await client.collection('rental').delete(rental.id)
            await client.collection('customer').delete(customer.id)
        })

        it('should do nothing while waiting for customers reply', async () => {
            let customer = await client.collection('customer').create({
                iid: 1500,
                firstname: 'Patrick',
                lastname: 'Star',
                email: 'patrick@crustycrab.com',
                phone: '012345678910',
                registered_on: new Date().addYears(-2).addDays(-2),
                delete_reminder_sent: new Date().addHours(-2),
            })
            await purgeInbox(imapClient)

            await client.crons.run('run_customer_deletion')
            await setTimeout(3100)

            let messages = await listInbox(imapClient)
            assert.lengthOf(messages, 0)

            let logs = await client.logs.getList(1, 10, { sort: '-created' })
            let filteredLogs = logs.items.filter((l) => l.message === `Currently waiting for reply to deletion reminder from ${customer.email} (${customer.id}).`)
            assert.lengthOf(filteredLogs, 1)

            await client.collection('customer').delete(customer.id)
        })

        it('should delete customer after no response to deletion notice', async () => {
            let customer = await client.collection('customer').create({
                iid: 1500,
                firstname: 'Patrick',
                lastname: 'Star',
                email: 'patrick@crustycrab.com',
                phone: '012345678910',
                registered_on: new Date().addYears(-2).addDays(-2),
                delete_reminder_sent: new Date().addDays(-8),  // more than grace period
            })
            await purgeInbox(imapClient)

            await client.crons.run('run_customer_deletion')
            await setTimeout(3100)

            let logs = await client.logs.getList(1, 10, { sort: '-created' })
            let filteredLogs = logs.items.filter((l) => l.message === `Deleting ${customer.email} (${customer.id}) after they have not responded to reminder mail within 7 days.`)
            assert.lengthOf(filteredLogs, 1)

            let promise = client.collection('customer').getOne(customer.id)
            await assert.isRejected(promise)
        })
    })
})
