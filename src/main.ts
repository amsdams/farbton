import * as fs from 'fs';
import * as huejay from 'huejay';
import * as influx from 'influx';
import * as moment from 'moment';

interface IConfig {
  username?: string;
  bridgeIp?: string;
  influx?: {
    host: string;
    database: string;
  };
}

function timeout(time: number): Promise<void> {
  return new Promise((resolve, /*reject*/_) => {
    setTimeout(() => {
      resolve();
    }, time);
  });
}
async function saveLight(light: any, db: influx.InfluxDB) {

  await db.writePoints([
    {
      fields: {
        name: light.name,
        on: light.on ? 1 : 0,
        reachable: light.reachable ? 1 : 0,
        type: light.type,
      },
      measurement: 'light',
      tags: {
        light: light.name,
      },
    },
  ]);
}
async function printLight(light: any) {
  try {
    console.log('light.attributes');
    console.table(light.attributes);
    console.log('light.state.attributes:');
    console.table(light.state.attributes);
  } catch (e) {
    console.error(e);
  }
}
async function doLight(light: any, db: influx.InfluxDB | null) {
  await printLight(light);

  if (db) {
    await saveLight(light, db);
  }
}
async function doLights(client: any, db: influx.InfluxDB | null) {
  const lights = await client.lights.getAll();

  for (const light of lights) {
    await doLight(light, db);
  }
}
async function saveSensor(sensor: any, db: influx.InfluxDB) {
  await db.writePoints([
    {
      fields: {
        lightlevel: sensor.state.attributes.attributes.lightlevel || 0,
        name: sensor.name,
        presence: sensor.state.attributes.attributes.presence ? 1 : 0,
        temperature: sensor.state.attributes.attributes.temperature || 0,
        type: sensor.type,
      },
      measurement: 'sensor',
      tags: {
        sensor: sensor.name,
      },

    },
  ]);
}
async function printSensor(sensor: any) {
  try {
    console.log('sensor.attributes:');
    console.table(sensor.attributes);
    console.log('sensor.state.attributes:');
    console.table(sensor.state.attributes);
    console.log('sensor.config.attributes:');
    console.table(sensor.config.attributes);
  } catch (e) {
    console.error(e);
  }
}

async function doSensor(sensor: any, db: influx.InfluxDB | null) {
  await printSensor(sensor);
  if (db) {
    await saveSensor(sensor, db);
  }
}
async function doSensors(client: any, db: influx.InfluxDB | null) {
  const sensors = await client.sensors.getAll();

  for (const sensor of sensors) {
    await doSensor(sensor, db);
  }
}

async function loop(client: any, db: influx.InfluxDB | null) {
  // let's find some sensors

  doSensors(client, db);
  console.log('Current hour: ' + moment());

  // let's find the lights
  doLights(client, db);
}
/* tslint:disable:no-big-function */
function setupInflux(config: any): influx.InfluxDB {
  return new influx.InfluxDB({
    database: config.influx.database,
    host: config.influx.host,
    schema: [
      {
        fields: {
          name: influx.FieldType.STRING,
          on: influx.FieldType.INTEGER,
          reachable: influx.FieldType.INTEGER,
          type: influx.FieldType.STRING,
        },
        measurement: 'light',
        tags: ['light'],
      },
      {

        fields: {
          lightlevel: influx.FieldType.INTEGER,
          name: influx.FieldType.STRING,
          presence: influx.FieldType.INTEGER,
          temperature: influx.FieldType.FLOAT,
          type: influx.FieldType.STRING,
        },
        measurement: 'sensor',
        tags: ['sensor'],
      },
    ],
  });
}
/* tslint:enable:no-big-function */
async function getRealClient(config: any) {
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
  return client;
}
async function getDefaultBridge() {
  const bridges = await huejay.discover();
  if (bridges.length === 0) {
    throw new Error('No bridges found');
  }
  for (const b of bridges) {
    console.log(' + Found ' + b.id + ' at ' + b.ip);
  }

  const bridge = bridges[0];
  console.log('Using bridge ' + bridge.id + ' at ' + bridge.ip);
  return bridge;
}
async function getDefaultUser(config: any) {
  console.log('No username provided, trying to register a new one');

  const cli = new huejay.Client({
    host: config.bridgeIp,
  });

  const user = new cli.users.User();
  user.deviceType = 'Farbton-ts';

  const u = await cli.users.create(user);
  console.log('New user is: ' + u.username);
  return u;
}
async function setClient(config: any) {
  // find the bridge
  if (!config.bridgeIp) {
    const bridge = await getDefaultBridge();
    config.bridgeIp = bridge.ip;
  }
  // get a new user if needed
  if (!config.username) {
    const user = await getDefaultUser(config);
    config.username = user.username;
  }
  return config;
}
async function main() {
  let config: IConfig = JSON.parse(fs.readFileSync('config.json').toString());
  config = await setClient(config);
  const client = await getRealClient(config);

  let db: influx.InfluxDB | null = null;
  if (config.influx) {
    console.log('InfluxDB is enabled');
    db = setupInflux(config);
  }

  while (true) {
    try {
      await loop(client, db);
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
