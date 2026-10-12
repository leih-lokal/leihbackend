// E-mails are rendered from Go templates (https://pkg.go.dev/text/template): a layout and a body per mail.
// Defaults are the files in views/ (views/layout.html and views/mail/<key>.html). They can be overridden through the mail_template collection,
// one record per key, where empty fields fall back to the defaults. The body of a mail is wrapped in the layout via {{template "body" .}}.

// Default subjects and example data, which document the variables available in each mail and are used to validate custom templates.
const MAILS = {
    customer_welcome: {
        subject: 'Herzlich Willkommen im leih.lokal!',
        example: { firstname: 'Max', lastname: 'Mustermann', iid: 1234 },
    },
    deletion_reminder: {
        subject: '[leih.lokal] Löschung Ihrer Daten im leih.lokal nach Inaktivität (Kunden-Nr. {{ .iid }})',
        example: { firstname: 'Max', lastname: 'Mustermann', iid: 1234 },
    },
    emergency_closing: {
        subject: '[leih.lokal] Heute außerplanmäßig geschlossen!',
        example: { firstname: 'Max', lastname: 'Mustermann' },
    },
    reservation_confirmation: {
        subject: 'Wir haben deine Reservierung für {{ .pickup }} erhalten',
        example: {
            pickup: '24.12.2026',
            customer_name: 'Max Mustermann',
            customer_iid: 1234,  // 0 for new customers
            customer_email: 'max@example.org',
            customer_phone: '0123 456789',
            comments: 'Ich komme etwas später.',
            items: [
                { iid: 42, name: 'Akkuschrauber', deposit: '20,00 €' },
                { iid: 43, name: 'Zollstock', deposit: '' },  // no deposit
            ],
            deposit_total: '20,00 €',  // empty if no deposit
            cancel_link: 'https://example.org/reservation/cancel?token=abc',
            otp: '123456',
        },
    },
    reservation_cancellation: {
        subject: 'Deine Reservierung für {{ .pickup }} wurde storniert',
        example: { pickup: '24.12.2026' },
    },
    return_reminder: {
        subject: '[leih.lokal] Rückgabe von Gegenständen morgen fällig',
        example: {
            items: [
                { iid: 42, name: 'Akkuschrauber', copies: 1 },
            ],
        },
    },
}

const LAYOUT_KEY = 'layout'

// Rendered in place of the body when rendering the layout. Plain text, because html/template would strip an html comment.
const BODY_PLACEHOLDER = 'MAIL_BODY_PLACEHOLDER'

function isMail(key) {
    return Object.keys(MAILS).includes(key)
}

function readView(path) {
    return toString($os.readFile(`${__hooks}/views/${path}`))
}

// Default body, stripped of its {{define "body"}} wrapper, i.e. in the same form as custom templates
function getDefaultBody(key) {
    return readView(`mail/${key}.html`).replace(/^\s*{{\s*define\s+"body"\s*}}/, '').replace(/{{\s*end\s*}}\s*$/, '')
}

function getDefaults() {
    return {
        layout: readView('layout.html'),
        mails: Object.fromEntries(Object.entries(MAILS).map(([key, mail]) => [key, {
            subject: mail.subject,
            body: getDefaultBody(key),
            example: mail.example,
        }])),
    }
}

// Custom template stored in the mail_template collection, null if none
function getCustomTemplate(key, app = $app) {
    try {
        const record = app.findFirstRecordByData('mail_template', 'key', key)
        return { subject: record.getString('subject'), body: record.getString('body') }
    } catch (e) {
        return null
    }
}

// html/template escapes its output, which is right for the body, but not for the subject
function unescapeHtml(str) {
    return str
        .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)))
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
}

// Render the layout around the given, already rendered body
function renderLayout(layout, data, bodyHtml) {
    const html = $template.loadString(`${layout || readView('layout.html')}{{define "body"}}${BODY_PLACEHOLDER}{{end}}`).render(data)
    if (!html.includes(BODY_PLACEHOLDER)) throw new Error('layout must include the mail body, i.e. {{template "body" .}}')
    return html.split(BODY_PLACEHOLDER).join(bodyHtml)
}

// Render a mail from the given templates, falling back to the default for every template not given.
// The body is rendered on its own and inserted into the layout afterwards: $template caches every parsed template text for good,
// so this way only the (small) body is parsed and cached again whenever it changes, e.g. in previews, not the layout along with it.
// It also makes line numbers in errors refer to the body.
function render(key, data, { layout, subject, body } = {}) {
    const bodyHtml = $template.loadString(body || getDefaultBody(key)).render(data)

    return {
        subject: unescapeHtml($template.loadString(subject || MAILS[key].subject).render(data)).replace(/[\r\n]+/g, ' ').trim(), // single line, data might be user input
        html: renderLayout(layout, data, bodyHtml),
    }
}

// Throws a BadRequestError if the given (custom) template can't be rendered
function validateTemplate(key, { subject, body }) {
    if (key !== LAYOUT_KEY && !isMail(key)) return // invalid key, rejected by field validation

    try {
        if (key === LAYOUT_KEY) {
            // with the data of every mail, in case the layout includes the body conditionally
            Object.values(MAILS).forEach((mail) => renderLayout(body, mail.example, ''))
        } else {
            render(key, MAILS[key].example, { subject, body })
        }
    } catch (e) {
        throw new BadRequestError(`Invalid template – ${e.message || e}`)
    }
}

// Render a mail, using custom templates if available
function renderMail(key, data, app = $app) {
    const custom = { ...getCustomTemplate(key, app), layout: getCustomTemplate(LAYOUT_KEY, app)?.body }

    try {
        return render(key, data, custom)
    } catch (e) {
        if (!custom.subject && !custom.body && !custom.layout) throw e
        // e.g. custom template that works with the example data, but not with this mail's data
        app.logger().error(`Failed to render custom template for ${key} mail, falling back to default – ${e}`)
        return render(key, data)
    }
}

function sendMail(key, recipient, data, app = $app) {
    const { DRY_MODE, IMPORT_MODE } = require(`${__hooks}/constants.js`)

    const { subject, html } = renderMail(key, data, app)

    const message = new MailerMessage({
        from: {
            address: app.settings().meta.senderAddress,
            name: app.settings().meta.senderName,
        },
        to: [{ address: recipient }],
        subject,
        html,
    })

    if (!DRY_MODE && !IMPORT_MODE) app.newMailClient().send(message)
}

module.exports = {
    MAILS,
    LAYOUT_KEY,
    isMail,
    getDefaults,
    getCustomTemplate,
    render,
    renderMail,
    validateTemplate,
    sendMail,
}
