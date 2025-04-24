const PocketBase = require('pocketbase/cjs')
const progress = require('cli-progress')
const { readFileSync, stat } = require('fs')
const levenshtein = require('js-levenshtein')

const DRY = false
const POCKETBASE_HOST = 'http://127.0.0.1:8090'
const POCKETBASE_USER = 'ferdinand@muetsch.io'
const POCKETBASE_PASSWORD = 'admin123456'
const COUCHDB_DUMP_FILE = '../data/leihlokal_23-12-14_20-00-01_cleaned.json'

const CATEGORIES = ['Freizeit', 'Garten', 'Haushalt', 'Heimwerken', 'Kinder', 'Küche', 'Sonstige']

function resolveCategories(categoryStr) {
    return categoryStr.split(',')
        .map(c => c.trim())
        .map(c => {
            if (CATEGORIES.includes(c)) return c
            const closestMatches = CATEGORIES
                .map(c1 => [c1, levenshtein(c.toLowerCase(), c1.toLowerCase())])
                .filter(c => c[1] <= 3)
                .toSorted((a, b) => a[1] - b[1])
            if (closestMatches.length > 0) return closestMatches[0][0]
            return null
        })
        .filter(c => c)
}

async function mapEntity(e) {
    const formData = new FormData()

    formData.append('iid', e.id)
    formData.append('legacy_rev', e._rev)
    formData.append('name', e.name.trim())
    formData.append('added_on', new Date(e.added).toUTCString())
    formData.append('status', e.status)
    if (e.brand) formData.append('brand', e.brand.trim())
    if (e.itype) formData.append('model', e.itype.trim())
    if (e.package) formData.append('packaging', e.package.trim())
    if (e.manual) formData.append('manual', e.manual.trim())
    formData.append('deposit', e.deposit)
    formData.append('parts', parseInt((e.parts || '1').replace(/[^\d]+/g, '')) || 1)
    formData.append('copies', e.exists_more_than_once ? 1024 : 1)
    if (e.highlight) formData.append('highlight_color', e.highlight.trim())
    if (e.synonyms) formData.append('synonyms', e.synonyms.trim())
    if (e.description) formData.append('description', e.description.trim())
    if (e.internal_note) formData.append('internal_note', e.internal_note.trim())

    if (e.image) {
        const fileName = e.image.split('/').at(-1)
        const res = await fetch(e.image)
        if (res.status === 200) formData.append('images', await res.blob(), fileName)
    }

    const categories = resolveCategories(e.category?.trim() || '')
    categories.forEach(c => formData.append('category', c))

    return formData
}

async function run() {
    console.log('Connecting to PocketBase ...')
    const pb = new PocketBase(POCKETBASE_HOST)
    await pb.admins.authWithPassword(POCKETBASE_USER, POCKETBASE_PASSWORD)

    console.log('Loading dump file ...')
    const data = JSON.parse(readFileSync(COUCHDB_DUMP_FILE)).docs
    const items = data
        .filter(d => d.type === 'item')
        .filter(d => d.name !== '')
        .filter(d => d.status !== 'deleted')

    console.log('Fetching existing items ...')
    const existingItems = await pb.collection('item').getFullList({ fields: 'id,iid,legacy_rev' })
    const nonExistingItems = items.filter(e => !existingItems.find(e1 => e1.iid === e.id))
    const updatedItems = items.filter(e => existingItems.find(e1 => e1.iid === e.id && e1.legacy_rev !== e._rev))
    const failedItemIds = new Set()

    console.log('Creating new items ...')
    const pbar1 = new progress.SingleBar({}, progress.Presets.shades_classic);
    pbar1.start(nonExistingItems.length, 0)

    for (const e of nonExistingItems) {
        try {
            const entity = await mapEntity(e)
            if (DRY) console.log(`[DRY MODE] Creating item ${e.id} (${e.name})`)
            else await pb.collection('item').create(entity)
        } catch (err) {
            failedItemIds.add(e.id)
        }
        pbar1.increment()
    }
    console.log()

    console.log('Updating existing items ...')
    const pbar2 = new progress.SingleBar({}, progress.Presets.shades_classic);
    pbar2.start(updatedItems.length, 0)

    for (const e of updatedItems) {
        const id = existingItems.find(e1 => e1.iid === e.id && e1.legacy_rev !== e._rev).id
        try {
            await pb.collection('item').update(id, await mapEntity(e))
        } catch (err) {
            failedItemIds.add(e.id)
        }
        pbar2.increment()
    }
    console.log()

    if (failedItemIds.size) {
        console.log(`\nFailed to create ${failedItemIds.size} items (due to validation error?):`)
        console.log(JSON.stringify([...failedItemIds]))
        console.log()
    }
}

run()