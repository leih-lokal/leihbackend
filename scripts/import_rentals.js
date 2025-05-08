const PocketBase = require('pocketbase/cjs')
const progress = require('cli-progress')
const { readFileSync } = require('fs')

const POCKETBASE_HOST = 'http://127.0.0.1:8090'
const POCKETBASE_USER = 'ferdinand@muetsch.io'
const POCKETBASE_PASSWORD = 'admin123456'
const COUCHDB_DUMP_FILE = '../data/leihlokal_23-12-14_20-00-01_cleaned.json'

const now = new Date()

async function mapEntity(e, customerId, itemId) {
    return {
        legacy_id: e._id,
        legacy_rev: e._rev,
        customer: customerId,
        deposit: e.deposit || 0,
        deposit_back: Math.abs(e.deposit_returned || 0),
        rented_on: new Date(e.rented_on),
        returned_on: e.returned_on ? new Date(e.returned_on) : null,
        expected_on: e.to_return_on ? new Date(e.to_return_on) : null,
        extended_on: e.extended_on ? new Date(e.extended_on) : null,
        remark: e.remark?.trim() || null,
        employee: e.passing_out_employee?.trim() || null,
        employee_back: e.receiving_employee?.trim() || null,
        items: [itemId],
    }
}

function isDone(rental) {
    return rental.returned_on && new Date(rental.returned_on) < now
}

async function run() {
    console.log('Connecting to PocketBase ...')
    const pb = new PocketBase(POCKETBASE_HOST)
    await pb.admins.authWithPassword(POCKETBASE_USER, POCKETBASE_PASSWORD)

    console.log('Loading dump file ...')
    const data = JSON.parse(readFileSync(COUCHDB_DUMP_FILE)).docs
    const rentals = data.filter(d => d.type === 'rental')

    console.log('Fetching existing rentals ...')
    const existingRentals = await pb.collection('rental').getFullList({ fields: 'id,legacy_id,legacy_rev' })
    const nonExistingRentals = rentals.filter(e => !existingRentals.find(e1 => e1.legacy_id === e._id))
    const updatedRentals = rentals.filter(e => existingRentals.find(e1 => e1.legacy_id === e._id && e1.legacy_rev !== e._rev))
    const failedRentalIds = new Set()

    console.log('Fetching all customers ...')
    const customersMapping = (await pb.collection('customer').getFullList({ fields: 'id,iid' })).reduce((acc, c) => ({ ...acc, [c.iid]: c.id }), {})

    console.log('Fetching all items ...')
    const itemsMapping = (await pb.collection('item').getFullList({ fields: 'id,iid' })).reduce((acc, i) => ({ ...acc, [i.iid]: i.id }), {})

    console.log('Creating new rentals ...')
    const pbar1 = new progress.SingleBar({}, progress.Presets.shades_classic);
    pbar1.start(nonExistingRentals.length, 0)

    const skippedMissingCustomer = []
    const skippedMissingItem = []

    for (const e of nonExistingRentals) {
        try {
            if (!(e.customer_id in customersMapping) && isDone(e)) skippedMissingCustomer.push(e)
            else if (!(e.item_id in itemsMapping) && isDone(e)) skippedMissingItem.push(e)
            else await pb.collection('rental').create(await mapEntity(e, customersMapping[e.customer_id], itemsMapping[e.item_id]))
        } catch (err) {
            failedRentalIds.add(e._id)
        }
        pbar1.increment()
    }
    console.log()

    console.log('Updating existing rentals ...')
    const pbar2 = new progress.SingleBar({}, progress.Presets.shades_classic);
    pbar2.start(updatedRentals.length, 0)

    for (const e of updatedRentals) {
        const id = existingRentals.find(e1 => e1.legacy_iid === e._id && e1.legacy_rev !== e._rev).id
        try {
            if (!(e.customer_id in customersMapping) && isDone(e)) skippedMissingCustomer.push(e)
            else if (!(e.item_id in itemsMapping) && isDone(e)) skippedMissingItem.push(e)
            else await pb.collection('rental').update(id, await mapEntity(e, customersMapping[e.customer_id], itemsMapping[e.item_id]))
        } catch (err) {
            failedRentalIds.add(e._id)
        }
        pbar2.increment()
    }
    console.log()

    if (failedRentalIds.size) {
        console.log(`\nFailed to create / update ${failedRentalIds.size} rentals (due to validation error?):`)
        console.log(JSON.stringify([...failedRentalIds]))
        console.log()
    }
    if (skippedMissingCustomer.length) {
        console.log(`\nSkipped ${skippedMissingCustomer.length} past rentals due to customer not existing:`)
        console.log(skippedMissingCustomer.map(e => `${e._id} (${e.customer_id})`).join(', '))
        console.log()
    }
    if (skippedMissingItem.length) {
        console.log(`\nSkipped ${skippedMissingItem.length} past rentals due to item not existing:`)
        console.log(skippedMissingItem.map(e => `${e._id} (${e.customer_id})`).join(', '))
        console.log()
    }
}

run()