const BASE_URL = 'http://localhost:8090/'
const USERNAME = 'dev@leihlokal-ka.de'
const PASSWORD = 'leihenistdasneuekaufen'

import PocketBase from 'pocketbase'
import nodemailer from 'nodemailer'
import { tmpdir } from 'os'
import { fetchMessages, deleteAllMessages, connectImap } from './lib/imap.js'
import { readFile, writeFile, access } from 'fs/promises'
import fs from 'fs'
import Imap from 'node-imap'

const SMTP_CREDENTIALS_PATH = `${tmpdir()}/.leihbackend_smtp.json`

// https://stackoverflow.com/a/1050782/3112139
Date.prototype.addHours = function(h) {
  this.setTime(this.getTime() + (h*60*60*1000));
  return this;
}

Date.prototype.addDays = function(d) {
  this.setTime(this.getTime() + (d*24*60*60*1000));
  return this;
}

Date.prototype.addYears = function(y) {
  this.setFullYear(this.getFullYear() + y);
  return this;
}

// Next occurrence of the given weekday (0 = sunday) at the given local time, at least two days from now
function nextWeekday(weekday, hours = 17) {
    const date = new Date()
    date.setHours(hours, 0, 0, 0)
    date.setDate(date.getDate() + 2)
    while (date.getDay() !== weekday) date.setDate(date.getDate() + 1)
    return date
}

// Valid pickup date for reservations (friday, within default opening hours)
function nextPickup() {
    return nextWeekday(5)
}

// Same format as dates in e-mails (DD.MM.YYYY)
function fmtDate(date) {
    return `${date.getDate().toString().padStart(2, '0')}.${(date.getMonth() + 1).toString().padStart(2, '0')}.${date.getFullYear()}`
}

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
    await client.settings.update({
        smtp: {
            enabled: true,
            host,
            port,
            username,
            password
        },
        meta: {
            senderAddress: USERNAME,
        },
    })
}

async function crateFakeMailAccount() {
    console.log('Creating fake e-mail account at ethereal.email')
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

async function purgeInbox(imap) {
    const imapClient = (imap instanceof Imap) ? imap : await initImap(imap)
    await deleteAllMessages(imapClient)
}

async function listInbox(imap) {
    const imapClient = (imap instanceof Imap) ? imap : await initImap(imap)
    return await fetchMessages(imapClient, 'INBOX')
}

async function initImap(config) {
    return await connectImap(adaptImapConfig(config))
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
    USERNAME,
    PASSWORD,
    getClient,
    getAnonymousClient,
    configureSmtp,
    getFakeMailAccount,
    initImap,
    purgeInbox,
    listInbox,
    nextWeekday,
    nextPickup,
    fmtDate,
}
