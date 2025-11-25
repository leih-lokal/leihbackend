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
        it('should send deletion notice to customer registered long ago', async () => {
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

            await client.crons.run('run_customer_deletion')
            await setTimeout(1000)

            let messages = await listInbox(imapClient)
            assert.lengthOf(messages, 1)
            assert.equal(messages[0].sender, USERNAME)
            assert.equal(messages[0].subject, `[leih.lokal] Löschung Ihrer Daten im leih.lokal nach Inaktivität (Kunden-Nr. ${customer.iid})`)
            assert.deepEqual(messages[0].recipients, [customer.email])

            // TODO: check logs
            // TODO: check deletetion_reminder_sent field

            await client.collection('customer').delete(customer.id)
        })

        it('should send deletion notice to customers with recent rentals') // TODO

        it('should do nothing while waiting for customers reply')  // TODO

        it('should delete customer after no response to deletion notice')  // TODO
    })
})
