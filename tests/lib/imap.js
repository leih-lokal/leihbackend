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
                bodies: ['HEADER.FIELDS (FROM SUBJECT TO CC)'],
                attributes: ['UID']
            })

            const messages = []

            f.on('message', (msg, seqno) => {

                msg.on('attributes', (attrs) => {
                    // apparently called after 'body' event
                    messages.filter(m => m.seqno === seqno).forEach(m => m.uid = attrs.uid)
                })

                msg.on('body', (stream, info) => {
                    let buffer = ''
                    stream.on('data', (chunk) => { buffer += chunk.toString('utf8') })

                    stream.once('end', () => {
                        const headers = Imap.parseHeader(buffer)

                        const senderHeader = headers.from ? headers.from[0] : 'Unknown'
                        const sender = extractAddresses([senderHeader])[0] || 'Unknown'

                        const toAddresses = extractAddresses(headers.to)
                        const ccAddresses = extractAddresses(headers.cc)
                        const recipients = [...toAddresses, ...ccAddresses]

                        const subject = headers.subject ? headers.subject[0] : 'No Subject'

                        messages.push({
                            uid: null,
                            seqno: info.seqno,
                            sender: sender,
                            recipients: recipients,
                            subject: subject
                        })
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