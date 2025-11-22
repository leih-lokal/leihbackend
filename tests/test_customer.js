import * as chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import {getAnonymousClient, getClient} from './base.js'
import {assert} from 'chai'
import {describe, it, before} from 'mocha'

chai.use(chaiAsPromised)

/*
E-Mail example:
---------------

import { configureSmtp, getClient, getFakeMailAccount, listInbox, purgeInbox } from "./base.js"

const client = await getClient()
const mailAccount = await getFakeMailAccount()

await configureSmtp(client, mailAccount.smtp)

const messages = await listInbox(mailAccount.imap)
console.log(JSON.stringify(messages))
await purgeInbox(mailAccount.imap)
*/

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