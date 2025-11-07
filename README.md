# leihbackend

leih.lokal Karlsruhe management system. Succesor of [LeihLokalVerwaltung](https://github.com/leih-lokal/LeihLokalVerwaltung). Built with [PocketBase](https://pocketbase.io) as a backend.

## Setup
1. Download Pocketbase
```bash
wget https://github.com/pocketbase/pocketbase/releases/download/v0.23.12/pocketbase_0.23.12_linux_amd64.zip
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

## Configuration
### Custom environment variables
* `DRY_MODE`: Run the app in dry mode, i.e. don't send any mail or delete anything. Default: `true`.
* `LL_INACTIVE_MONTHS`: Number of months after which a customer is considered inactive and schduled for deletion. Default: `24`.
* `LL_DELETION_GRACE_PERIOD_DAYS`: Number of days to wait until deletion customer after reminder mail was sent. Default: `7`.
* `LL_NO_WELCOME`: Do not send welcome e-mails upon new customer registration. Default: `false`.
* `LL_NO_DELETE_INACTIVE`: Do not delete inactive customers automatically. Default: `false`.

## API Endpoints
See [Web APIs reference](https://pocketbase.io/docs/api-records/) for documentation on what endpoints are available and how to use them (especially with regard to filtering, searching, etc.).

### Custom routes
* `GET` `/api/autocomplete/street` (public)
* `GET` `/api/reservation/cancel` (public)
* `GET` `/api/customer/csv` (superusers only)
* `GET` `/api/item/csv` (superusers only)
* `GET` `/api/rental/csv` (superusers only)
* `GET` `/api/reservation/csv` (superusers only)
* `POST` `/api/misc/emergency_closing` (superusers only)

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

## Roadmap
For the long-term roadmap and future plans for out software setup, please refer to the [wiki](https://wiki.leihlokal-ka.de/software/roadmap). Currently, we're on the process of implementing stage 1.

### Stage 1: The "Intermediate" variant
For details, see wiki entry.

* [x] Basic data model and API endpoints for items
* [x] Basic data model and API endpoints for reservations
* [x] Reservation validation and item status update
* [x] Reservation e-mail confirmations
* [x] Reservation cancellation
* [ ] New customer-facing product catalog (Ruby)
* [ ] New click & collect (aka. reservations) frontend (Ruby)
* [x] Replace legacy API / database calls for items in _LeihLokalVerwaltung_ ("_LLV_")
* [ ] Simple reservations view in _LLV_ to replace Excel sheet and [`create_click_collect_overview.py`](https://github.com/leih-lokal/scripts/blob/master/create_clickcollect_overview.py)
* [ ] ...
* [ ] Sunset WooCommerce and _item_-part of CouchDB

### Stage 2: The "v2"
* [x] Replace legacy API / database calls for items in _LLV_
* [x] Replace legacy API / database calls for customers in _LLV_
* [x] Replace legacy API / database calls for rentals in _LLV_
* [x] Add new view view reservations in LLV
* [ ] ...
* [ ] Sunset CouchDB entirely