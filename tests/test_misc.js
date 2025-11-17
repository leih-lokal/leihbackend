import * as chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import {getAnonymousClient, getClient} from './base.js'
import {assert} from 'chai'
import {describe, it, before} from 'mocha'

chai.use(chaiAsPromised)

describe('Misc', () => {
    let client
    let anonymousClient

    before(async () => {
        client = await getClient()
        anonymousClient = await getAnonymousClient()
    })

    it('should handle emergency closing')
    it('should return stats from the stats endpoint')
})