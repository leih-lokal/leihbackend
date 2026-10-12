import * as chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { getAnonymousClient, getClient, nextWeekday } from './base.js'
import { assert } from 'chai'
import { describe, it, before } from 'mocha'

chai.use(chaiAsPromised)

const DEFAULT_OPENING_HOURS = [
    ['mon', '15:00', '19:00'],
    ['thu', '15:00', '19:00'],
    ['fri', '15:00', '19:00'],
    ['sat', '10:00', '14:00'],
]

// The settings collection is created by llka-verwaltung on demand, i.e. it doesn't necessarily exist
async function dropSettingsCollection(client) {
    try {
        await client.collections.delete('settings')
    } catch (e) {
        if (e.status !== 404) throw e
    }
}

async function createSettingsCollection(client) {
    await dropSettingsCollection(client)
    await client.collections.create({
        name: 'settings',
        type: 'base',
        listRule: '',
        viewRule: '',
        fields: [
            { name: 'app_name', type: 'text' },
            { name: 'opening_hours', type: 'json' },
        ],
    })
}

describe('Settings', () => {
    let client
    let anonymousClient

    before(async () => {
        client = await getClient()
        anonymousClient = await getAnonymousClient()
    })

    describe('Without settings collection', () => {
        before(async () => {
            await dropSettingsCollection(client)
        })

        it('should return default opening hours', async () => {
            const response = await anonymousClient.send('/api/opening-hours')
            assert.deepEqual(response, { opening_hours: DEFAULT_OPENING_HOURS })
        })
    })

    describe('With settings collection', () => {
        before(async () => {
            await createSettingsCollection(client)
        })

        after(async () => {
            await dropSettingsCollection(client)
        })

        it('should return defaults if there is no settings record', async () => {
            assert.deepEqual(await anonymousClient.send('/api/opening-hours'), { opening_hours: DEFAULT_OPENING_HOURS })
        })

        it('should return configured opening hours', async () => {
            const openingHours = [['sun', '11:00', '12:00']]
            await client.collection('settings').create({ opening_hours: openingHours })

            const response = await anonymousClient.send('/api/opening-hours')
            assert.deepEqual(response, { opening_hours: openingHours })
        })

        it('should validate reservation pickups against configured opening hours', async () => {
            await client.collection('settings').create({ opening_hours: [['sun', '11:00', '12:00']] })
            const item = await client.collection('item').getFirstListItem('iid=1001')

            const reserve = (pickup) => anonymousClient.collection('reservation').create({
                customer_name: 'Bob Bobby',
                customer_email: 'bobby@bobbbob.tld',
                items: [item.id],
                pickup,
                on_premises: true,  // no confirmation mail
            })

            await assert.isRejected(reserve(nextWeekday(5, 17)))  // friday, open by default
            await reserve(nextWeekday(0, 11))
        })
    })
})
