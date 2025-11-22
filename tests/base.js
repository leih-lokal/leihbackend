const BASE_URL = 'http://localhost:8090/'
const USERNAME = 'dev@leihlokal-ka.de'
const PASSWORD = 'leihenistdasneuekaufen'

import PocketBase from 'pocketbase'
import nodemailer from 'nodemailer'
import { tmpdir } from 'os'
import { fetchMessages, deleteAllMessages, connectImap } from './lib/imap.js'
import { readFile, writeFile, access } from 'fs/promises'
import fs from 'fs'

const SMTP_CREDENTIALS_PATH = `${tmpdir()}/.leihbackend_smtp.json`

async function fileExists(file) {
    try {
        await access(file, fs.constants.F_OK)
        return true
    } catch {
        return false
    }
}

async function getClient() {
    const pb = await getAnonymousClient()
    await pb.collection('_superusers').authWithPassword(USERNAME, PASSWORD)
    return pb
}

async function getAnonymousClient() {
    return new PocketBase(BASE_URL)
}

async function configureSmtp(client, { host, port, username, password }) {
    client.settings.update({
        smtp: {
            enabled: true,
            host,
            port,
            username,
            password
        }
    })
}

async function crateFakeMailAccount() {
    const account = await nodemailer.createTestAccount()
    return {
        smtp: {
            host: account.smtp.host,
            port: account.smtp.port,
            username: account.user,
            password: account.pass,
        },
        imap: {
            host: account.imap.host,
            port: account.imap.port,
            username: account.user,
            password: account.pass,
        }
    }
}

async function getFakeMailAccount(force) {
    if (force || !(await fileExists(SMTP_CREDENTIALS_PATH))) {
        const account = await crateFakeMailAccount()
        await writeFile(SMTP_CREDENTIALS_PATH, JSON.stringify(account))
    }
    return JSON.parse(await readFile(SMTP_CREDENTIALS_PATH))
}

async function purgeInbox(imapConfig) {
    imapConfig = adaptImapConfig(imapConfig)
    const imapClient = await connectImap(imapConfig)
    await deleteAllMessages(imapClient)
    imapClient.end()
}

async function listInbox(imapConfig) {
    imapConfig = adaptImapConfig(imapConfig)
    const imapClient = await connectImap(imapConfig)
    const messages = await fetchMessages(imapClient, 'INBOX')
    imapClient.end()
    return messages
}

function adaptImapConfig({ host, port, username, password }) {
    return {
        host,
        port,
        user: username,
        password,
        tls: true,
    }
}

export {
    getClient,
    getAnonymousClient,
    configureSmtp,
    getFakeMailAccount,
    purgeInbox,
    listInbox,
}