import * as chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import {getAnonymousClient, getClient} from './base.js'
import {assert} from 'chai'
import {describe, it, before} from 'mocha'

chai.use(chaiAsPromised)

describe('Items', () => {
    let client
    let anonymousClient

    before(async () => {
        client = await getClient()
        anonymousClient = await getAnonymousClient()
    })

    describe('Public items', () => {
        it('should list all', async () => {
            const items = await anonymousClient.collection('item_public').getFullList()
            assert.deepEqual(items.map(i => i.iid), [1000, 1001, 1002, 1003])
        })

        it('should filter by status', async () => {
            const items = await anonymousClient.collection('item_public').getFullList({
                filter: 'status="instock"'
            })
            assert.deepEqual(items.map(i => i.iid), [1000, 1001])
        })
    })
})
