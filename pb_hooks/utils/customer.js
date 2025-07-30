// E-Mail Sending

function sendWelcomeMail(r) {
    const customerEmail = r.getString('email')

    const html = $template.loadFiles(`${__hooks}/views/mail/customer_welcome.html`).render({
        firstname: r.getString('firstname'),
        lastname: r.getString('lastname'),
        iid: r.getInt('iid'),
    })

    const message = new MailerMessage({
        from: {
            address: $app.settings().meta.senderAddress,
            name: $app.settings().meta.senderName,
        },
        to: [{ address: customerEmail }],
        subject: `Herzlich Willkommen im leih.lokal!`,
        html,
    })

    $app.newMailClient().send(message)
}

function sendEmergencyClosingMail(r) {
    const customerEmail = r.getString('email')

    const html = $template.loadFiles(`${__hooks}/views/mail/emergency_closing.html`).render({
        firstname: r.getString('firstname'),
        lastname: r.getString('lastname'),
    })

    const message = new MailerMessage({
        from: {
            address: $app.settings().meta.senderAddress,
            name: $app.settings().meta.senderName,
        },
        to: [{ address: customerEmail }],
        subject: `[leih.lokal] Heute außerplanmäßig geschlossen!`,
        html,
    })

    $app.newMailClient().send(message)
}

module.exports = {
    sendWelcomeMail,
    sendEmergencyClosingMail,
}