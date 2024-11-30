# leihla

leih.lokal Karlsruhe management system. Succesor of [LeihLokalVerwaltung](https://github.com/leih-lokal/LeihLokalVerwaltung). Built with [PocketBase](https://pocketbase.io) as a backend.

## Setup
1. Download Pocketbase
```bash
wget https://github.com/pocketbase/pocketbase/releases/download/v0.23.3/pocketbase_0.23.3_linux_amd64.zip
unzip pocketbase*
rm CHANGELOG* LICENSE* *.zip
```

2. Run Pocketbase
```bash
./pocketbase serve
```

3. Create admin account and log in by browsing to http://localhost:8090/_/.