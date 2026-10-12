/// <reference path="../pb_data/types.d.ts" />

/*
 Custom mail templates (see services/mail.js).
 Templates are validated before being saved, so that a broken template can't be stored.
*/

const { handleGetDefaults, handlePostPreview } = require(`${__hooks}/routes/mail`)

// Request hooks
// ----- //

onRecordCreateRequest((e) => {
    const { validateTemplate } = require(`${__hooks}/services/mail.js`)

    validateTemplate(e.record.getString('key'), { subject: e.record.getString('subject'), body: e.record.getString('body') })
    e.next()
}, 'mail_template')

onRecordUpdateRequest((e) => {
    const { validateTemplate } = require(`${__hooks}/services/mail.js`)

    validateTemplate(e.record.getString('key'), { subject: e.record.getString('subject'), body: e.record.getString('body') })
    e.next()
}, 'mail_template')

// Routes
// ----- //
routerAdd('get', '/api/mail-templates/defaults', handleGetDefaults, $apis.requireSuperuserAuth())
routerAdd('post', '/api/mail-templates/preview', handlePostPreview, $apis.requireSuperuserAuth())
