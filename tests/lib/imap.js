import Imap from 'node-imap'

function extractAddresses(headerArray) {
    if (!headerArray || headerArray.length === 0) return []

    return headerArray.map(header => {
        const match = header.match(/<([^>]+)>/)
        if (match) {
            return match[1]
        }
        return header.trim()
    })
}

// Raw (MIME) message body with quoted-printable soft line breaks and escapes decoded, good enough to search for rendered text
function decodeQuotedPrintable(str) {
    const latin1 = str.replace(/=\r?\n/g, '').replace(/=([0-9A-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    return Buffer.from(latin1, 'latin1').toString('utf8')
}

function connectImap(imapConfig) {
    return new Promise((resolve, reject) => {
        const imap = new Imap(imapConfig)

        imap.once('ready', () => {
            resolve(imap)
        })

        imap.once('error', (err) => {
            reject(err)
        })

        imap.connect()
    })
}

function fetchMessages(imap, mailbox) {
    return new Promise((resolve, reject) => {
        imap.openBox(mailbox, false, (err, box) => {
            if (err) return reject(err)

            const numMessages = box.messages.total

            if (numMessages === 0) {
                return resolve([])
            }

            const f = imap.fetch('1:*', {
                bodies: ['HEADER.FIELDS (FROM SUBJECT TO CC)', 'TEXT'],
                attributes: ['UID']
            })

            const messages = []

            f.on('message', (msg, seqno) => {
                const message = { uid: null, seqno }
                messages.push(message)

                msg.on('attributes', (attrs) => {
                    message.uid = attrs.uid
                })

                msg.on('body', (stream, info) => {
                    let buffer = ''
                    stream.on('data', (chunk) => { buffer += chunk.toString('utf8') })

                    stream.once('end', () => {
                        if (info.which === 'TEXT') {
                            message.body = decodeQuotedPrintable(buffer)
                            return
                        }

                        const headers = Imap.parseHeader(buffer)

                        const senderHeader = headers.from ? headers.from[0] : 'Unknown'
                        message.sender = extractAddresses([senderHeader])[0] || 'Unknown'

                        const toAddresses = extractAddresses(headers.to)
                        const ccAddresses = extractAddresses(headers.cc)
                        message.recipients = [...toAddresses, ...ccAddresses]

                        message.subject = headers.subject ? headers.subject[0] : 'No Subject'
                    })
                })
            })

            f.once('error', (err) => {
                reject(err)
            })

            f.once('end', () => {
                resolve(messages)
            })
        })
    })
}

function deleteAllMessages(imap) {
    return new Promise((resolve, reject) => {
        imap.openBox('INBOX', false, (err, box) => {
            if (err) return reject(err)

            imap.search(['ALL'], (err, uids) => {
                if (err) return reject(err)

                if (uids.length === 0) return resolve()

                imap.addFlags(uids, ['\\Deleted'], (err) => {
                    if (err) return reject(err)

                    imap.expunge((err) => {
                        if (err) return reject(err)
                        resolve()
                    })
                })
            })
        })
    })
}

export {
    connectImap,
    fetchMessages,
    deleteAllMessages,
}