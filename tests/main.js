import { configureSmtp, getClient, getFakeMailAccount, listInbox, purgeInbox } from "./base.js"

const client = await getClient()
const mailAccount = await getFakeMailAccount()

await configureSmtp(client, mailAccount.smtp)

const messages = await listInbox(mailAccount.imap)
console.log(JSON.stringify(messages))
await purgeInbox(mailAccount.imap)