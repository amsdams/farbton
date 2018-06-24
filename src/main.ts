import * as huejay from 'huejay';
import * as fs from 'fs';
import * as moment from 'moment';
import * as influx from 'influx';

interface IConfig {
  username?: string;
  bridgeIp?: string;
  influx?: {
    host: string;
    database: string;
  };
}

function timeout(time: number): Promise<void> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve();
    }, time);
  });
}
async function doLights(client: any, config: IConfig, db: influx.InfluxDB | null) {
  const lights = await client.lights.getAll();

  for (const light of lights) {
    console.log('light', light.id);
    console.log('name', light.name);
    console.log('on', light.on);
    console.log('reachable', light.reachable);
    if (db) {
      await db.writePoints([{
        measurement: 'light',
        tags: {
          light: light.name,
        },
        fields: {
          type: light.type,
          name: light.name,
          on: light.on ? 1 : 0,
          reachable: light.reachable ? 1 : 0,
        },
      }]);
    }
  }
}
async function doSensors(client: any, config: IConfig, db: influx.InfluxDB | null) {
  const sensors = await client.sensors.getAll();

  for (const sensor of sensors) {
    console.log('sensor', sensor.id);
    console.log('name', sensor.name);
    console.log('name', sensor.type);
    console.log('presence', sensor.state.attributes.attributes.presence);
    console.log('temperature', sensor.state.attributes.attributes.temperature);
    console.log('lightlevel', sensor.state.attributes.attributes.lightlevel);
    if (db) {
      await db.writePoints([{
        measurement: 'sensor',
        tags: {
          sensor: sensor.name,
        },
        fields: {
          type: sensor.type,
          name: sensor.name,
          presence: sensor.state.attributes.attributes.presence ? 1 : 0,
          temperature: sensor.state.attributes.attributes.temperature || 0,
          lightlevel: sensor.state.attributes.attributes.lightlevel || 0,
        },
      }]);
    }
  }
}

async function loop(client: any, config: IConfig, db: influx.InfluxDB | null) {
  // let's find some sensors

  doSensors(client, config, db);
  console.log('Current hour: ' + moment().hours());

  // let's find the lights
  doLights(client, config, db);
}

async function main() {
  const config: IConfig = JSON.parse(fs.readFileSync('config.json').toString());

  // find the bridge
  if (!config.bridgeIp) {
    const bridges = await huejay.discover();
    if (bridges.length === 0) {
      throw new Error('No bridges found');
    }
    for (const b of bridges) {
      console.log(' + Found ' + b.id + ' at ' + b.ip);
    }

    const bridge = bridges[0];
    console.log('Using bridge ' + bridge.id + ' at ' + bridge.ip);

    config.bridgeIp = bridge.ip;
  }

  // get a new user if needed
  if (!config.username) {
    console.log('No username provided, trying to register a new one');

    const cli = new huejay.Client({
      host: config.bridgeIp,
    });

    const user = new cli.users.User();
    user.deviceType = 'Farbton-ts';

    const u = await cli.users.create(user);
    console.log('New user is: ' + u.username);

    config.username = u.username;
  }

  // create the real client and check auth
  const client = new huejay.Client({
    host: config.bridgeIp,
    username: config.username,
  });

  console.log('Checking bridge auth ...');
  const authOk = await client.bridge.isAuthenticated();
  if (!authOk) {
    console.log('Not authenticated.');
    return;
  }

  let db: influx.InfluxDB | null = null;
  if (config.influx) {
    console.log('InfluxDB is enabled');
    db = new influx.InfluxDB({
      host: config.influx.host,
      database: config.influx.database,
      schema: [{
        measurement: 'light',
        tags: ['light'],
        fields: {
          type: influx.FieldType.STRING,
          name: influx.FieldType.STRING,
          on: influx.FieldType.INTEGER,
          reachable: influx.FieldType.INTEGER,
        },
      }, {
        measurement: 'sensor',
        tags: ['sensor'],
        fields: {
          type: influx.FieldType.STRING,
          name: influx.FieldType.STRING,
          presence: influx.FieldType.INTEGER,
          temperature: influx.FieldType.FLOAT,
          lightlevel: influx.FieldType.INTEGER,
        },
      }],
    });
  }

  while (true) {
    try {
      await loop(client, config, db);

    } catch (E) {
      console.log('E', E);
    } finally {
      await timeout(1000);
    }
  }
}

async function run() {
  try {
    await main();
  } catch (err) {
    console.error(err);
  }
}

run();
