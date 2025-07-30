const PocketBase = require('pocketbase/cjs')
const progress = require('cli-progress')
const { readFileSync } = require('fs')

const DRY = false
const POCKETBASE_HOST = 'http://127.0.0.1:8090'
const POCKETBASE_USER = 'ferdinand@muetsch.io'
const POCKETBASE_PASSWORD = 'admin123456'
const COUCHDB_DUMP_FILE = '../data/leihlokal_23-12-14_20-00-01_cleaned.json'

const HEARD_CHOICES = [
    "Internet",
    "Freunde & Bekannte",
    "Zeitung / Medien",
    "Nachbarschaft",
    "Sonstige"
]

async function mapEntity(e) {
    return {
        iid: e.id,
        legacy_rev: e._rev,
        email: e.email?.trim().toLowerCase() || 'noemail@example.org',
        firstname: e.firstname?.trim() || null,
        lastname: e.lastname?.trim() || null,
        street: `${e.street} ${e.house_number}`.trim(),
        postal_code: e.postal_code?.toString()?.trim() || null,
        city: e.city?.trim() || null,
        phone: e.telephone_number?.trim() || '00000',
        heard: HEARD_CHOICES.includes(e.heard?.trim()) ? e.heard?.trim() : HEARD_CHOICES.at(-1),
        remark: e.remark?.trim() || null,
        highlight_color: e.highlight?.trim() || null,
        newsletter: e.subscribed_to_newsletter || false,
        registered_on: new Date(e.registration_date),
        renewed_on: e.renewed_on ? new Date(e.renewed_on) : null,
    }
}

async function run() {
    console.log('Connecting to PocketBase ...')
    const pb = new PocketBase(POCKETBASE_HOST)
    await pb.admins.authWithPassword(POCKETBASE_USER, POCKETBASE_PASSWORD)

    console.log('Loading dump file ...')
    const data = JSON.parse(readFileSync(COUCHDB_DUMP_FILE)).docs
    const customers = data.filter(d => d.type === 'customer')

    console.log('Fetching existing customers ...')
    const existingCustomers = await pb.collection('customer').getFullList({ fields: 'id,iid,legacy_rev' })
    const nonExistingCustomers = customers.filter(e => !existingCustomers.find(e1 => e1.iid === e.id))
    const updatedCustomers = customers.filter(e => existingCustomers.find(e1 => e1.iid === e.id && e1.legacy_rev !== e._rev))
    const failedCustomerIds = new Set()

    console.log('Creating new customers ...')
    const pbar1 = new progress.SingleBar({}, progress.Presets.shades_classic);
    pbar1.start(nonExistingCustomers.length, 0)

    for (const e of nonExistingCustomers) {
        try {
            await pb.collection('customer').create(await mapEntity(e))
        } catch (err) {
            failedCustomerIds.add(e.id)
        }
        pbar1.increment()
    }
    console.log()

    console.log('Updating existing customers ...')
    const pbar2 = new progress.SingleBar({}, progress.Presets.shades_classic);
    pbar2.start(updatedCustomers.length, 0)

    for (const e of updatedCustomers) {
        const id = existingCustomers.find(e1 => e1.iid === e.id && e1.legacy_rev !== e._rev).id
        try {
            await pb.collection('customer').update(id, await mapEntity(e))
        } catch (err) {
            failedCustomerIds.add(e.id)
        }
        pbar2.increment()
    }
    console.log()

    if (failedCustomerIds.size) {
        console.log(`\nFailed to create / update ${failedCustomerIds.size} customers (due to validation error?):`)
        console.log(JSON.stringify([...failedCustomerIds]))
        console.log()
    }
}

console.log('WARNING: Make sure to turn off welcome e-mails before running the import script !!!')
console.log('You got 10 seconds to abort this ...')

setTimeout(() => run(), 10 * 1000)