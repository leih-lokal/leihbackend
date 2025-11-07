function getUniqueStreets(query, app = $app) {
    const result = arrayOf(new DynamicModel({
        street: ''
    }))

    let sql = app.db()
        .select('street')
        .from('customer')
        .distinct(true)

    if (query) sql = sql.where($dbx.like('street', query))

    sql.all(result)

    const streets = result
        .map(({ street }) => street)
        .map((street) => street.replace(/[0-9]+.*$/g, '').trim())
        .filter(street => street.length > 3)
    return [...new Set(streets)]
}

function exportCsv(app = $app) {
    const CSV = require(`${__hooks}/utils/csv.js`)

    const fields = [
        { id: 'id', label: '_id', empty: '' },
        { id: 'iid', label: '#', empty: '' },
        { id: 'email', label: 'E-Mail', empty: '' },
        { id: 'phone', label: 'Telefon', empty: '' },
        { id: 'firstname', label: 'Vorname', empty: '' },
        { id: 'lastname', label: 'Nachname', empty: '' },
        { id: 'street', label: 'Strasse', empty: '' },
        { id: 'city', label: 'Stadt', empty: '' },
        { id: 'postal_code', label: 'PLZ', empty: '' },
        { id: 'heard', label: 'Aufmerksam geworden', empty: '' },
        { id: 'remark', label: 'Anmerkungen', empty: '' },
        { id: 'registered_on', label: 'Registriert am', empty: '' },
        { id: 'renewed_on', label: 'Erneuert am', empty: '' },
        { id: 'newsletter', label: 'Newsletter', empty: false },
        { id: 'num_rentals', label: 'Ausleihen', empty: 0 },
        { id: 'num_active_rentals', label: 'Aktive Ausleihen', empty: 0 },
    ]

    const result = arrayOf(new DynamicModel(fields.reduce((acc, field) => {
        acc[field.id] = field.empty
        return acc;
    }, {})))
    app.db().newQuery('select customer.*, coalesce(num_rentals, 0) as num_rentals, coalesce(num_active_rentals, 0) as num_active_rentals from customer left join customer_rentals using (id)').all(result)
    const records = JSON.parse(JSON.stringify(result))

    return CSV.serialize({ fields, records })
}

/* Get a list of customers who haven't been active for x months and whose membership wasn't reneweed in that period */
function getInactive(offsetMonths = 24, app = $app) {
    let records = arrayOf(new Record)

    const refDate = new DateTime().addDate(0, -offsetMonths, 0)

    app.recordQuery('customer')
        .join('inner join', 'rental', $dbx.exp('customer.id = rental.customer'))
        .where($dbx.exp('rental.returned_on < {:refDate}', { refDate }))
        .andWhere($dbx.or(
            $dbx.or($dbx.exp("customer.renewed_on = ''"), $dbx.exp("customer.renewed_on is null")),
            $dbx.exp("customer.renewed_on < {:refDate}", { refDate }),
        ))
        .distinct(true)
        .all(records)

    return records
}

// E-Mail Sending

function sendWelcomeMail(c) {
    const { DRY_MODE } = require(`${__hooks}/constants.js`)
    const customerEmail = c.getString('email')

    const html = $template.loadFiles(`${__hooks}/views/mail/customer_welcome.html`).render({
        firstname: c.getString('firstname'),
        lastname: c.getString('lastname'),
        iid: c.getInt('iid'),
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

    if (!DRY_MODE) $app.newMailClient().send(message)
}

function sendEmergencyClosingMail(c) {
    const { DRY_MODE } = require(`${__hooks}/constants.js`)
    const customerEmail = c.getString('email')

    const html = $template.loadFiles(`${__hooks}/views/mail/emergency_closing.html`).render({
        firstname: c.getString('firstname'),
        lastname: c.getString('lastname'),
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

    if (!DRY_MODE) $app.newMailClient().send(message)
}

function sendDeletionReminderMail(c) {
    const { DRY_MODE } = require(`${__hooks}/constants.js`)
    const customerEmail = c.getString('email')

    const html = $template.loadFiles(`${__hooks}/views/mail/deletion_reminder.html`).render({
        firstname: c.getString('firstname'),
        lastname: c.getString('lastname'),
    })

    const message = new MailerMessage({
        from: {
            address: $app.settings().meta.senderAddress,
            name: $app.settings().meta.senderName,
        },
        to: [{ address: customerEmail }],
        subject: `[leih.lokal] Löschung Ihrer Daten im leih.lokal nach Inaktivität (Kunden-Nr. ${c.getInt('iid')})`,
        html,
    })

    c.set('delete_reminder_sent', new DateTime())
    $app.save(c)

    if (!DRY_MODE) $app.newMailClient().send(message)
}

module.exports = {
    getUniqueStreets,
    exportCsv,
    getInactive,
    sendWelcomeMail,
    sendEmergencyClosingMail,
    sendDeletionReminderMail,
}