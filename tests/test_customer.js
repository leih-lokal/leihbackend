import * as chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { getAnonymousClient, getClient, initImap, listInbox, getFakeMailAccount, configureSmtp, USERNAME, purgeInbox } from './base.js'
import { assert } from 'chai'
import { describe, it, before } from 'mocha'

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
        assert.deepEqual(messages[0].recipients, [ testCustomer.email ])

        await client.collection('customer').delete(testCustomer.id)
    })

    it('should run customer auto-deletion')  // TODO
})