// Set config dir
process.env.NODE_CONFIG_DIR = '/opt/app/config'
// Initialise SRF (Signalling Resource Framework - node functions to interact with drachtio SIP server)
const Srf             = require('drachtio-srf');
// Initialise MRF (Media Resource Framework). Freeswitch specific, node functions to interact with freeswitch for media purposes
const Mrf             = require('drachtio-fsmrf');
const os              = require('os')
const config          = require('config');
const slack           = require('./slack-notify')()

// Load up
const srf = new Srf() ;
const mrf = new Mrf(srf) ;

const local_ip    = os.networkInterfaces()['eth0'][0]['address']

// Connect to drachtio server using SRF - sync
srf.connect(config.get('drachtio'), (err, srf) => {
  if (err) return console.log(`error connecting to drachtio: ${err}`);
});

// Connect to freeswitch using MRF - sync
mrf.connect(config.get('freeswitch'), (err, mediaserver) => {
  if (err) return console.log(`error connecting to mediaserver: ${err}`);
  // This is important, this adds the mediaserver object to the SRF object so we can access it directly outside of this function
  srf.locals.ms = mediaserver
  console.log(`connected to mediaserver listening on ${JSON.stringify(mediaserver.sip)}`);
});

// Log connection and information - async, this is a listener
srf.on('connect', (err, hostport) => {
  if (err) return console.log(`error on drachtio connect: ${err}`);
  console.log(`successfully connected to drachtio listening on ${hostport}`);
  slack.notify(`[${os.hostname()}] Online on ${local_ip}`)
});

srf.on('destroy', () => {
  console.log("SRF destroyed");
});

srf.on('error', (err) => {
  console.warn(err);
  slack.notify(`[${os.hostname()}] SRF error: ${err}`);
});

srf.options((req, res) => {
  // Shuts up the noise!
  res.send(200);
});

srf.register((req, res) => {
  console.log(`Accepted registration from ${req.source_address}`);
  res.send(200);
});

srf.invite(async(req, res) => {
  const ms = req.app.locals.ms;
  console.log("Incoming call")

  res.send(180)
  let outbound_headers = []
  outbound_headers['From'] = '<sip:contact-header-test@localhost>';
  outbound_headers['Contact'] = `<sip:contact-test@fake-host.name>`;

  ms.createEndpoint()
  .then( (endpoint) => {
    srf.createUAC(`sip:${config.app.number_to_call}@${config.app.outbound_sbc}`,
    {
      localSdp: endpoint.local.sdp,
      headers: outbound_headers
    },
    {
      cbRequest: (err, req) => invite = req,
    })
    .then( async (dialog) => {
      endpoint.modify(dialog.remote.sdp);

      ms.connectCaller(req, res)
      .then( (call) => {
        let caller_endpoint = call['endpoint']
        let caller_dialog = call['dialog']

        dialog.on('destroy', () => {
          //slack.notify(`[${os.hostname()}] B endpoint hung up`)
          console.log('B endpoint hung up')
          caller_endpoint.destroy()
        });
        caller_dialog.on('destroy', () => {
          //slack.notify(`[${os.hostname()}] A endpoint hung up`)
          console.log('A endpoint hung up')
          endpoint.destroy()
        });

        caller_endpoint.bridge(endpoint)
        .then(() => {
          slack.notify(`[${os.hostname()}] Calls bridged`)
        })
        .catch( (err) => {
          slack.notify(`[${os.hostname()}] Bridging calls error: ${err}`)
        })
      }) // End connect caller


    })
    .catch( (err) => {
      console.warn(err);
      slack.notify(`[${os.hostname()}] Making call error: ${err}`)        
    })
  })
  .catch( (err) => {
    console.warn(err);
    slack.notify(`[${os.hostname()}] Making call error: ${err}`)
  }); // End create endpoint
}); // End srf.invite