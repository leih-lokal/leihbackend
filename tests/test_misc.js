import * as chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { getAnonymousClient, getClient, initImap, listInbox, getFakeMailAccount, configureSmtp, USERNAME, purgeInbox } from './base.js'
import { assert } from 'chai'
import { describe, it, before } from 'mocha'

chai.use(chaiAsPromised)

describe('Misc', () => {
    let client
    let anonymousClient
    let imapClient

    let item1
    let customer1

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
        customer1 = await client.collection('customer').getFirstListItem('iid=1000') // john
    })

    afterEach(async () => {
        await purgeInbox(imapClient)
    })

    describe('Emergency closing', () => {
        it('should handle emergency closing', async () => {
            const now = new Date()

            let rental = await client.collection('rental').create({
                customer: customer1.id,
                items: [item1.id],
                rented_on: now,
                expected_on: now,
                requested_copies: {
                    [item1.id]: 1,
                },
            })
            assert.isNotNull(rental)

            const response = await client.send('/api/misc/emergency_closing', { method: 'post' })
            assert.deepEqual(response, {
                successful: 1,
                failed: 0,
            })

            rental = await client.collection('rental').getOne(rental.id)
            assert.deepEqual(new Date(rental.expected_on), now) // updating the return date not implemented, yet

            const messages = await listInbox(imapClient)
            assert.lengthOf(messages, 1)
            assert.equal(messages[0].sender, USERNAME)
            assert.equal(messages[0].subject, '[leih.lokal] Heute außerplanmäßig geschlossen!')
            assert.deepEqual(messages[0].recipients, [customer1.email])

            await client.collection('rental').delete(rental.id)
        })
    })

    describe('Stats', () => {
        it('should return stats from the stats endpoint', async () => {
            const response = await client.send('/api/stats')
            assert.deepEqual(response, {
                active_customers_count: {
                    '2025-11-01': 2,
                },
                new_customers_count: {
                    '2025-11-01': 2,
                },
                rentals_count: {
                    '2025-11-01': 2,
                },
                total_items: {
                    '2025-11-01': 3,
                },
            })
        })
    })
})
