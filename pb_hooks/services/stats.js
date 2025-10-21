// TODO: make time offset (currently -5 years) configurable

function getMonthlyNewCustomers(app = $app) {
    /*
    select strftime('%Y-%m-01', registered_on) as month, count(*) as cnt from customer where registered_on >= date(date(), '-5 years') group by month;
    */

    const sql = app.db()
        .select("strftime('%Y-%m-01', registered_on) as month")
        .andSelect("count(*) as cnt")
        .from("customer")
        .where($dbx.exp("registered_on >= date(date(), '-5 years')"))
        .groupBy("month")
        .orderBy("month")

    const results = arrayOf(new DynamicModel({
        month: '',
        cnt: 0
    }))
    sql.all(results)

    return Object.fromEntries(results.map(r => [r.month, r.cnt]))
}

function getMonthlyRentals(app = $app) {
    /*
    select strftime('%Y-%m-01', rented_on) as month, count(*) as cnt from rental where rented_on >= date(date(), '-5 years') group by month;
    */

    const sql = app.db()
        .select("strftime('%Y-%m-01', rented_on) as month")
        .andSelect("count(*) as cnt")
        .from("rental")
        .where($dbx.exp("rented_on >= date(date(), '-5 years')"))
        .groupBy("month")
        .orderBy("month")

    const results = arrayOf(new DynamicModel({
        month: '',
        cnt: 0
    }))
    sql.all(results)

    return Object.fromEntries(results.map(r => [r.month, r.cnt]))
}

function getMonthlyTotalItems(app = $app) {
    const sql = ""
        + "with base as (select date(added_on) as month, count(*) as cnt from item where status != 'deleted' group by month) "
        + "select month, total from ( "
        + "select strftime('%Y-%m-01', month) as month, sum(cnt) over (order by month) as total from base "
        + ") where date(month) >= date(date(), '-5 years')"

    const results = arrayOf(new DynamicModel({
            month: '',
            total: 0
        }))
    app.db().newQuery(sql).all(results)

    return Object.fromEntries(results.map(r => [r.month, r.total]))
}

function getMonthlyActiveCustomers(app = $app) {
    const sql = ""
        + "with all_months as (select distinct strftime('%Y-%m-01', rented_on) as month from rental where rented_on >= date(date(), '-5 years')) "
        + "select month, count(distinct r.customer) as cnt "
        + "from all_months "
        + "left join rental as r on date(r.rented_on) >= date(month, '-2 months') and date(r.rented_on) < date(month, '+1 month') "
        + "group by month "
        + "order by month"

    const results = arrayOf(new DynamicModel({
        month: '',
        cnt: 0
    }))
    app.db().newQuery(sql).all(results)

    return Object.fromEntries(results.map(r => [r.month, r.cnt]))
}

function getStats(app = $app) {
    const newCustomersCount = getMonthlyNewCustomers(app)
    const activeCustomersCount = getMonthlyActiveCustomers(app)
    const rentalsCount = getMonthlyRentals(app)
    const totalItems = getMonthlyTotalItems(app)

    // fill dates to ensure consistent time grid across all stats
    const months = [...new Set([
        ...Object.keys(newCustomersCount),
        ...Object.keys(activeCustomersCount),
        ...Object.keys(rentalsCount),
        ...Object.keys(totalItems),
    ])].toSorted()

    const minMonth = months.length > 0 ? months[0] : '1970-01-01'
    const maxMonth = months.length > 0 ? months[months.length - 1] : '1970-01-01'

    const minDate = new DateTime(`${minMonth} 00:00:00.000Z`)
    const maxDate = new DateTime(`${maxMonth} 00:00:00.000Z`)

    let currentDate = minDate
    while (currentDate < maxDate) {
        const currentDateStr = currentDate.string().substring(0, 10)
        if (!(currentDateStr in newCustomersCount)) newCustomersCount[currentDateStr] = 0
        if (!(currentDateStr in activeCustomersCount)) activeCustomersCount[currentDateStr] = 0
        if (!(currentDateStr in rentalsCount)) rentalsCount[currentDateStr] = 0
        if (!(currentDateStr in totalItems)) totalItems[currentDateStr] = 0  // TODO: use previous month value, because cumulative count
        currentDate = currentDate.addDate(0, 1, 0)
    }

    return {
        "new_customers_count": newCustomersCount,
        "active_customers_count": activeCustomersCount,
        "rentals_count": rentalsCount,
        "total_items": totalItems,
    }
}

module.exports = {
    getMonthlyNewCustomers,
    getMonthlyRentals,
    getStats,
    getMonthlyTotalItems,
    getMonthlyActiveCustomers,
}