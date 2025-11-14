#!/usr/bin/env node

import { getAnonymousClient, getClient } from './base.js'
import { assert } from 'chai'
import path from 'path'

let client
let anonymousClient

async function run() {
    client = await getClient()
    anonymousClient = await getAnonymousClient()

    console.log(`${path.basename(import.meta.filename).slice(0, -3)} passed ✅`)
}

// TODO: test welcome mail
// TODO: test auto-deletion

await run()