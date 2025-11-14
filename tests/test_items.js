#!/usr/bin/env node

import { getAnonymousClient, getClient } from './base.js'
import {assert} from 'chai'
import path from 'path'

let client
let anonymousClient

async function run() {
    client = await getClient()
    anonymousClient = await getAnonymousClient()

    await testPublicItems()
    await testPublicItemsStatusFilter()

    console.log(`${path.basename(import.meta.filename).slice(0, -3)} passed ✅`)
}

async function testPublicItems() {
    console.log(`Running testPublicItems`)

    const items = await anonymousClient.collection('item_public').getFullList()
    assert.deepEqual(items.map(i => i.iid), [1000, 1001, 1002])
}

async function testPublicItemsStatusFilter() {
    console.log(`Running testPublicItemsStatusFilter`)

    const items = await anonymousClient.collection('item_public').getFullList({
        filter: 'status="instock"'
    })
    assert.deepEqual(items.map(i => i.iid), [1000, 1001])
}

await run()