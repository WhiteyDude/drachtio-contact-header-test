# Drachtio contact header override test

Takes a call in, sends back a 180 and makes a call out, bridging them.

Overrides the Contact header during that outbound call.

## Running instructions

Build a machine running [drachtio-server](https://github.com/davehorton/drachtio-server) and node.

Copy files to /opt/app

`npm install`

`./node_modules/pm2/bin/pm2 start app.js`

`./node_modules/pm2/bin/pm2 logs -f`