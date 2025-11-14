const BASE_URL = 'http://localhost:8090/'
const USERNAME = 'dev@leihlokal-ka.de'
const PASSWORD = 'leihenistdasneuekaufen'

import PocketBase from 'pocketbase'

async function getClient() {
    const pb = await getAnonymousClient()
    await pb.collection('_superusers').authWithPassword(USERNAME, PASSWORD)
    return pb
}

async function getAnonymousClient() {
    return new PocketBase(BASE_URL)
}

export {
    getClient,
    getAnonymousClient
}