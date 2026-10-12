import * as chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { getAnonymousClient, getClient, initImap, listInbox, getFakeMailAccount, configureSmtp, purgeInbox, nextPickup, fmtDate } from './base.js'
import { assert } from 'chai'
import { describe, it, before } from 'mocha'

chai.use(chaiAsPromised)

describe('Mail templates', () => {
    let client
    let anonymousClient
    let imapClient

    let item2

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
        item2 = await client.collection('item').getFirstListItem('iid=1001') // goat cheese
    })

    afterEach(async () => {
        await purgeInbox(imapClient)
    })

    const createCustomer = (data = {}) => client.collection('customer').create({
        iid: 2000,
        firstname: 'Justus',
        lastname: 'Jonas',
        email: 'justusjonas@leihlokal-ka.de',
        phone: '+49123456789012',
        registered_on: new Date(),
        ...data,
    })

    describe('General', () => {
        it('should deny access for anonymous users', async () => {
            await assert.isRejected(anonymousClient.collection('mail_template').getFullList())
            await assert.isRejected(anonymousClient.send('/api/mail-templates/defaults'))
            await assert.isRejected(anonymousClient.send('/api/mail-templates/preview', { method: 'post', body: { key: 'customer_welcome' } }))
        })

        it('should return default templates', async () => {
            const defaults = await client.send('/api/mail-templates/defaults')

            assert.include(defaults.layout, '{{block "body" .}}')
            assert.hasAllKeys(defaults.mails, [
                'customer_welcome',
                'deletion_reminder',
                'emergency_closing',
                'reservation_confirmation',
                'reservation_cancellation',
                'return_reminder',
            ])

            const mail = defaults.mails.reservation_confirmation
            assert.equal(mail.subject, 'Wir haben deine Reservierung für {{ .pickup }} erhalten')
            assert.notInclude(mail.body, '{{define "body"}}')
            assert.include(mail.body, '{{ .cancel_link }}')
            assert.containsAllKeys(mail.example, ['pickup', 'items', 'deposit_total', 'cancel_link', 'otp'])
        })
    })

    describe('Sending', () => {
        it('should send mails with custom subject and body', async () => {
            await client.collection('mail_template').create({
                key: 'customer_welcome',
                subject: 'Willkommen, {{ .firstname }}!',
                body: '<p>Deine Nummer: {{ .iid }}</p>',
            })

            await createCustomer({ firstname: "D'Artagnan" })

            const messages = await listInbox(imapClient)
            assert.lengthOf(messages, 1)
            assert.equal(messages[0].subject, "Willkommen, D'Artagnan!")  // not html-escaped
            assert.include(messages[0].body, 'Deine Nummer: 2000')
            assert.include(messages[0].body, 'AUSLEIHEN IST DAS NEUE KAUFEN')  // default layout
            assert.notInclude(messages[0].body, 'herzlich willkommen im leih.lokal')  // default body
        })

        it('should send mails with custom layout', async () => {
            await client.collection('mail_template').create({
                key: 'layout',
                body: '<html><body><h1>Mein Verleih</h1>{{template "body" .}}</body></html>',
            })

            await createCustomer()

            const messages = await listInbox(imapClient)
            assert.lengthOf(messages, 1)
            assert.equal(messages[0].subject, 'Herzlich Willkommen im leih.lokal!')  // default subject
            assert.include(messages[0].body, 'Mein Verleih')
            assert.include(messages[0].body, 'herzlich willkommen im leih.lokal')  // default body
            assert.notInclude(messages[0].body, 'AUSLEIHEN IST DAS NEUE KAUFEN')
        })

        it('should fall back to defaults for empty fields', async () => {
            await client.collection('mail_template').create({ key: 'customer_welcome', subject: '', body: '' })

            await createCustomer()

            const messages = await listInbox(imapClient)
            assert.lengthOf(messages, 1)
            assert.equal(messages[0].subject, 'Herzlich Willkommen im leih.lokal!')
            assert.include(messages[0].body, 'herzlich willkommen im leih.lokal')
        })

        it('should fall back to default templates if a custom template fails to render', async () => {
            // works with the example data (two items), but not with a single item
            await client.collection('mail_template').create({
                key: 'reservation_confirmation',
                subject: 'Reservierung: {{ (index .items 1).name }}',
            })

            const pickup = nextPickup()
            await anonymousClient.collection('reservation').create({
                customer_iid: 1000,
                items: [item2.id],
                pickup,
            })

            const messages = await listInbox(imapClient)
            assert.lengthOf(messages, 1)
            assert.equal(messages[0].subject, `Wir haben deine Reservierung für ${fmtDate(pickup)} erhalten`)
        })
    })

    describe('Validation', () => {
        it('should reject templates with syntax errors', async () => {
            await assert.isRejected(client.collection('mail_template').create({ key: 'customer_welcome', body: '{{ if .iid }}' }))
            await assert.isRejected(client.collection('mail_template').create({ key: 'customer_welcome', subject: 'Hallo {{ .firstname' }))
        })

        it('should reject templates that fail to render', async () => {
            await assert.isRejected(client.collection('mail_template').create({ key: 'reservation_confirmation', body: '{{ if gt .customer_iid "zero" }}x{{ end }}' }))
        })

        it('should reject layouts without body', async () => {
            await assert.isRejected(client.collection('mail_template').create({ key: 'layout', body: '<html><body>No body</body></html>' }))
        })

        it('should reject invalid updates', async () => {
            const template = await client.collection('mail_template').create({ key: 'customer_welcome', body: '<p>Hallo</p>' })
            await assert.isRejected(client.collection('mail_template').update(template.id, { body: '{{ end }}' }))
        })

        it('should reject unknown mails', async () => {
            await assert.isRejected(client.collection('mail_template').create({ key: 'foo', body: '<p>Hallo</p>' }))
        })

        it('should allow only one template per mail', async () => {
            await client.collection('mail_template').create({ key: 'customer_welcome', body: '<p>Hallo</p>' })
            await assert.isRejected(client.collection('mail_template').create({ key: 'customer_welcome', body: '<p>Hallo</p>' }))
        })
    })

    describe('Preview', () => {
        it('should render given templates with example data', async () => {
            const preview = await client.send('/api/mail-templates/preview', {
                method: 'post',
                body: {
                    key: 'reservation_cancellation',
                    subject: 'Storno für {{ .pickup }}',
                    body: '<p>Storniert: {{ .pickup }}</p>',
                },
            })

            assert.equal(preview.subject, 'Storno für 24.12.2026')
            assert.include(preview.html, 'Storniert: 24.12.2026')
            assert.include(preview.html, 'AUSLEIHEN IST DAS NEUE KAUFEN')
        })

        it('should render stored templates if none are given', async () => {
            await client.collection('mail_template').create({ key: 'layout', body: '<div>Mein Verleih</div>{{template "body" .}}' })

            const preview = await client.send('/api/mail-templates/preview', {
                method: 'post',
                body: { key: 'reservation_cancellation' },
            })

            assert.equal(preview.subject, 'Deine Reservierung für 24.12.2026 wurde storniert')
            assert.include(preview.html, 'Mein Verleih')
            assert.include(preview.html, 'wurde erfolgreich storniert')
        })

        it('should reject invalid templates', async () => {
            await assert.isRejected(client.send('/api/mail-templates/preview', {
                method: 'post',
                body: { key: 'reservation_cancellation', body: '{{ if }}' },
            }))
            await assert.isRejected(client.send('/api/mail-templates/preview', {
                method: 'post',
                body: { key: 'foo' },
            }))
        })
    })
})
