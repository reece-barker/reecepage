#!/bin/bash
# Sets up a local MySQL for testing reece.page against the real database engine.
# Run it with: bash ~/Developer/reece-page/setup-mysql.command
# It uses Homebrew, makes a database and a user only for this project, writes .env.mysql and runs the tests on MySQL.
set -e
cd "$(dirname "$0")/../.."
BREW=$(command -v brew || echo /opt/homebrew/bin/brew)
if [ ! -x "$BREW" ]; then
  echo "Homebrew is not installed. Install it from https://brew.sh first, then run this again."; exit 1
fi
eval "$($BREW shellenv)"
brew list mysql >/dev/null 2>&1 || brew install mysql
brew services start mysql
# Wait for the server to answer
for i in $(seq 1 30); do mysqladmin ping --silent 2>/dev/null && break; sleep 1; done
PASS=$(openssl rand -hex 16)
mysql -u root <<SQL
CREATE DATABASE IF NOT EXISTS reece_page_dev CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS reece_page_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'reece_page'@'localhost' IDENTIFIED BY '$PASS';
ALTER USER 'reece_page'@'localhost' IDENTIFIED BY '$PASS';
GRANT ALL PRIVILEGES ON reece_page_dev.* TO 'reece_page'@'localhost';
GRANT ALL PRIVILEGES ON reece_page_test.* TO 'reece_page'@'localhost';
FLUSH PRIVILEGES;
SQL
cat > .env.mysql <<ENV
# Local MySQL made by setup-mysql.command. Copy these lines into .env to use MySQL for npm run dev too
DB_DIALECT=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=reece_page_dev
DB_USER=reece_page
DB_PASSWORD=$PASS
ENV
echo "MySQL is running. Running the migrations on the dev database..."
set -a; . ./.env.mysql; set +a
npm run db:migrate
npm run db:status
echo "Running the test suite against MySQL (database reece_page_test)..."
mkdir -p var && TEST_DB_DIALECT=mysql DB_NAME=reece_page_test npm test 2>&1 | tee var/mysql-test.log | tail -15
echo; echo "Done. Results are also in var/mysql-test.log"
