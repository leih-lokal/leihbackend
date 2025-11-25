#!/bin/bash

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"  # just bash things ...
POCKETBASE_PATH="$SCRIPT_DIR/../pocketbase"
MIGRATIONS_PATH="$SCRIPT_DIR/../pb_migrations"
HOOKS_PATH="$SCRIPT_DIR/../pb_hooks"
DATA_DIR="/tmp/pb_data_$(date +%s)"
USERNAME="dev@leihlokal-ka.de"
PASSWORD="leihenistdasneuekaufen"
PB_PID=0

cleanup() {
    echo
    if [ $PB_PID -ne 0 ]; then
        echo "Stopping Pocketbase (PID: $PB_PID)..."
        kill $PB_PID
        wait $PB_PID 2>/dev/null
    fi

    echo "Cleaning up data dir: $DATA_DIR"
    rm -r "$DATA_DIR"
}

trap cleanup EXIT

mkdir -p $DATA_DIR

$POCKETBASE_PATH --dir $DATA_DIR superuser create $USERNAME $PASSWORD
echo "Created test user."

$POCKETBASE_PATH --dir $DATA_DIR --hooksDir $HOOKS_PATH migrate --migrationsDir $MIGRATIONS_PATH
echo "Applied migrations."

echo "Loading fixtures ..."
sqlite3 $DATA_DIR/data.db < "$SCRIPT_DIR/seed.sql"

echo "Starting Pocketbase ..."
export DRY_MODE=false  # to test emailing functionality
nohup $POCKETBASE_PATH --dir $DATA_DIR --hooksDir $HOOKS_PATH serve > /dev/null 2>&1 &
PB_PID=$!
echo "Pocketbase started (PID: $PB_PID)"

sleep 5

echo "Starting tests ..."
cd $SCRIPT_DIR
npm test
