import * as chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import {getAnonymousClient, getClient} from './base.js'
import {assert} from 'chai'
import {describe, it, before} from 'mocha'

chai.use(chaiAsPromised)

describe('Customer', () => {
    let client
    let anonymousClient

    before(async () => {
        client = await getClient()
        anonymousClient = await getAnonymousClient()
    })

    it('should send a welcome mail to new customers')  // TODO
    it('should run customer auto-deletion')  // TODO
})