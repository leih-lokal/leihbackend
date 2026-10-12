# leihbackend

leih.lokal Karlsruhe management system. Succesor of [LeihLokalVerwaltung](https://github.com/leih-lokal/LeihLokalVerwaltung). Built with [PocketBase](https://pocketbase.io) as a backend.

## Run
### Local
1. Download Pocketbase
```bash
wget https://github.com/pocketbase/pocketbase/releases/download/v0.34.0/pocketbase_0.34.0_linux_amd64.zip
unzip pocketbase*
rm CHANGELOG* LICENSE* *.zip
```

2. Create schema / run migrations
```bash
./pocketbase migrate
```

3. Run Pocketbase
```bash
./pocketbase serve
```

4. Create admin account at http://localhost:8090/_/ (if none existing yet).

### Docker / Podman
```bash
# Option 1: pull official image
docker pull ghcr.io/leih-lokal/leihbackend:latest

# Option 2: Build own image
docker build -f Containerfile -t leihbackend:latest .

# Create persistent volume
docker volume create leihbackend_data

# Run the container
docker run -d \
    --name leihbackend \
    -p 8090:8090 \
    -v leihbackend_data:/pb/pb_data \
    -e DRY_MODE=false \
    leihbackend:latest
```

## Configuration
### Custom environment variables
* `DRY_MODE`: Run the app in dry mode, i.e. don't send any mail or delete anything. Default: `true`.
* `IMPORT_MODE`: Run the app in import mode, i.e. don't perform any sort of data validation or side effects when creating new records. Default: `false`.
* `LOG_LEVEL`: Log level to use for stdout (0 = `INFO`, 4 = `WARN`, 8 = `ERROR`). Default: `4`.
* `LL_INACTIVE_MONTHS`: Number of months after which a customer is considered inactive and schduled for deletion. Default: `24`.
* `LL_DELETION_GRACE_PERIOD_DAYS`: Number of days to wait until deletion customer after reminder mail was sent. Default: `7`.
* `LL_NO_WELCOME`: Do not send welcome e-mails upon new customer registration. Default: `false`.
* `LL_NO_DELETE_INACTIVE`: Do not delete inactive customers automatically. Default: `false`.

### Opening hours
Opening hours are stored in the `settings` collection as a JSON field (`opening_hours`). They can be configured through the llka-verwaltung settings UI (Konfiguration → Öffnungszeiten) and are used for reservation pickup validation.

If no `settings` record exists (e.g. fresh installation without llka-verwaltung), the backend falls back to hardcoded defaults in `pb_hooks/constants.js`.

The configured (or default) opening hours are available via a public API endpoint (see below).

### Image compression
Settings for compressing uploaded images (e.g. item images) are stored in the `settings` collection as a JSON field (`image_compression`): `enabled`, `max_dimension_px` (longest edge), `quality` (1 - 100), `output_format` (`keep`, `webp` or `jpeg`) and `skip_if_smaller_than_kb`. They can be configured through the llka-verwaltung settings UI.

Images are compressed client-side by llka-verwaltung only. The backend doesn't recompress uploads (PocketBase's JS runtime can't process images), so clients that ignore these settings can still upload images up to the file field's maximum size. Other clients can read the configured (or default) settings via a public API endpoint (see below) to compress images before uploading, too.

### Mail templates
E-mails are rendered from [Go templates](https://pkg.go.dev/text/template): a layout ([`pb_hooks/views/layout.html`](pb_hooks/views/layout.html)) and a body per mail ([`pb_hooks/views/mail/`](pb_hooks/views/mail)). These defaults (leih.lokal Karlsruhe branding) can be overridden through the `mail_template` collection (superusers only), without changing any files:

* `key`: which template to override, i.e. `layout` or one of the mails `customer_welcome`, `deletion_reminder`, `emergency_closing`, `reservation_confirmation`, `reservation_cancellation`, `return_reminder`
* `subject`: subject of the mail (unused for `layout`)
* `body`: HTML body of the mail, or the HTML of the layout, which must include the mail body via `{{template "body" .}}`

Empty fields fall back to the defaults. Templates are validated (rendered with example data) before they are saved. If a custom template still fails to render a particular mail, the default is used for that mail instead.

`GET /api/mail-templates/defaults` returns the default templates along with example data for every mail, which documents the variables available in it. `POST /api/mail-templates/preview` renders a mail with example data, e.g. to preview changes before saving them (body: `key` and optionally `subject`, `body` and `layout`; templates not given are taken from the `mail_template` collection or the defaults).

## API Endpoints
See [Web APIs reference](https://pocketbase.io/docs/api-records/) for documentation on what endpoints are available and how to use them (especially with regard to filtering, searching, etc.).

### Custom routes
* `GET` `/api/autocomplete/street` (public)
* `GET` `/api/reservation/cancel` (public)
* `GET` `/api/customer/csv` (superusers only)
* `GET` `/api/item/csv` (superusers only)
* `GET` `/api/rental/csv` (superusers only)
* `GET` `/api/reservation/csv` (superusers only)
* `GET` `/api/opening-hours` (public) — returns configured opening hours (or defaults)
* `GET` `/api/image-compression` (public) — returns configured image compression settings (or defaults)
* `POST` `/api/misc/emergency_closing` (superusers only)
* `GET` `/api/mail-templates/defaults` (superusers only) — returns default mail templates and example data
* `POST` `/api/mail-templates/preview` (superusers only) — renders a mail with example data

## Authentication
For now, we'll only have _superusers_ (see [Authentication](https://pocketbase.io/docs/authentication/)) (as primarily other internal services are meant to consume the APIs) as well as a few _public_ endpoints (see below). In the future, we might actually want user accounts for our customers and thus define more elaborate [API rules and filters](https://pocketbase.io/docs/api-rules-and-filters/) then.

To call API endpoints (admin-only at the moment), an auth token needs to be passed, which can be created as shown in [`auth.http`](apidocs/auth.http).

## Authorization
### Requirements
By default, all operations are superuser-only, despite the following exceptions. 

#### Customers
No public access.

#### Items
* Public `list` and `view` access for items whose status is not `deleted`
* Field `internal_note` must be filtered

#### Rentals
No public access.

#### Reservations
* Public `create` access for new reservations
* Reservation cancellation endpoint `/reservation/cancel` is public (but requires the cancellation token, obviously)

## Tests
Test cases run independently of each other: before every test case, all data is reset to the fixtures in [`tests/seed.sql`](tests/seed.sql) (see [`tests/hooks.js`](tests/hooks.js)). Tests therefore don't need to clean up after themselves, and a failing test doesn't affect subsequent ones.

### Requirements
* NodeJS
* sqlite3

### Setup
```bash
cd tests && npm install --dev
```

### Run
```bash
cd tests && bash run_tests.sh

# run selected tests only (arguments are passed to mocha)
cd tests && bash run_tests.sh --grep "Reservations"
```

## Roadmap
For the long-term roadmap and future plans for out software setup, please refer to the [wiki](https://wiki.leihlokal-ka.de/software/roadmap).

## Developer Notes
### Item availability
* An item's status is derived from its number of `copies`, its rented copies and its active reservations:
  * `outofstock` if all copies are rented
  * `reserved` if all copies that are not rented are reserved
  * `instock` otherwise
* Rented copies are the copies requested by rentals that weren't returned yet (`returned_on` not set), minus copies that were already returned (partial return, see `returned_items`).
* Every active reservation (not `done`) reserves one copy of each of its items. Items can be reserved as long as there are copies that are neither rented nor reserved.
* Reserved copies can still be rented. Renting copies of an item closes as many of the renting customer's own reservations of it (earliest pickup first). Reservations of other customers are closed (earliest pickup first) only if their reserved copies are rented out. Closing a reservation releases all of its items, and its customer isn't notified.
* These statuses are re-derived whenever rentals, reservations or the item change, i.e. they can't be set manually. Other statuses (e.g. `repairing`, `lost`, `deleted`) are set manually and never changed automatically. Items with such a status can't be rented or reserved.

### Deletion
* Deletions from customers cascade to all entities referencing customers using a foreign key, i.e. deleting a customer will also remove all their rental objects.
