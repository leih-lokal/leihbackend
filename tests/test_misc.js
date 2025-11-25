import * as chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { getAnonymousClient, getClient } from './base.js'
import { assert } from 'chai'
import { describe, it, before } from 'mocha'

chai.use(chaiAsPromised)

describe('Misc', () => {
    let client
    let anonymousClient

    before(async () => {
        client = await getClient()
        anonymousClient = await getAnonymousClient()
    })

    it('should handle emergency closing') // TODO

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
