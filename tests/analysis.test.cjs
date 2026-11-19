const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const XLSX = require('../dist/vendor/xlsx.js');
const app = fs.readFileSync(path.join(__dirname, '../dist/app.js'), 'utf8');
const gps = fs.readFileSync(path.join(__dirname, '../dist/gps-track.js'), 'utf8');

function fixture() {
  const lines = ['DATAH\tDATE\tTIME\tCO2\tCH4\tREMARK\tDIAG', 'DATAU\tdate\ttime\tppm\tppb\t\tdiag'];
  const base = Date.parse('2026-01-01T10:00:00Z');
  for (let i = 0; i <= 130; i++) {
    const time = new Date(base + i * 1000).toISOString().slice(11, 19);
    const marked = i <= 60 || i >= 70;
    const elapsed = i >= 70 ? i - 70 : i;
    lines.push(`DATA\t2026-01-01\t${time}\t${400 + elapsed * 2}\t${1900 - elapsed}\t${marked ? '"1"' : '""'}\t0`);
  }
  return lines.join('\n');
}

function context() {
  const elements = { dateOrder: { value: 'iso' }, status: {} };
  const c = vm.createContext({ Date, Number, Math, window: { XLSX }, XLSX,
    $: id => elements[id], save: async () => true, populate() {},
    hasGPS: r => Number.isFinite(r.latitude) && Number.isFinite(r.longitude) });
  vm.runInContext(`let data=[],readings=[],selected=-1,activeProject='A',projects=[{name:'A'}],geometry={chamber:1.685,collar:0,loop:.041,area:.03142};const defs=[];function filtered(){return readings}` +
    app.slice(app.indexOf('function sourceRecords'), app.indexOf('const num=')) +
    app.slice(app.indexOf('function fluxSeries'), app.indexOf('function renderFluxReadiness')) +
    app.slice(app.indexOf('function ensureOccurrences'), app.indexOf('for(const[id,gps]')) + gps, c);
  c.raw = fixture();
  vm.runInContext(`data=parseGas(raw).map(p=>({...p,sourceId:'source-a'}));readings=detectClosures(data).map(r=>({...r,sourceId:'source-a',sourceFile:'synthetic.data',project:'A'}));`, c);
  return { c, elements };
}

async function upload(c, csv) {
  c.csv = Buffer.from(csv);
  await vm.runInContext(`importRows({name:'conditions.csv',arrayBuffer:async()=>csv},false)`, c);
}

test('repeated IDs match automatically by field order and keep separate analyser windows', async () => {
  const { c, elements } = context();
  assert.equal(vm.runInContext('readings.length', c), 2);
  await upload(c, 'id,date,start_time,end_time,temperature,pressure\n1,2026-01-01,17:00,17:03,30,100\n1,2026-01-01,14:00,14:03,25,100\n');
  assert.equal(vm.runInContext('readings[0].fieldStart', c), '2026-01-01 14:00:00');
  assert.equal(vm.runInContext('readings[1].fieldStart', c), '2026-01-01 17:00:00');
  assert.equal(vm.runInContext('readings[1].start', c), '2026-01-01 10:01:10');
  const result = vm.runInContext('evaluate(readings[0])', c);
  const expected = 2 * 100000 * .001726 / (8.314462618 * 298.15 * .03142);
  assert.equal(result.c.n, 61);
  assert.equal(result.c.slope, 2);
  assert.equal(result.h.slope, -1);
  assert.equal(result.c.r2, 1);
  assert.ok(Math.abs(result.co2 - expected) < 1e-10);
  assert.ok(result.ch4 < 0);
  assert.equal(vm.runInContext('clockStamp(measurementClock(readings[0]).end)', c), '2026-01-01 14:01:00');
  assert.equal(vm.runInContext("fluxSeries('co2','flux').samples.length", c), 2);
  assert.ok(elements.status.textContent.includes('matched automatically'));
});

test('clock offsets, malformed field times and missing field times do not select wrong samples', async () => {
  const { c } = context();
  await upload(c, 'id,date,start_time,end_time,temperature,pressure\n1,2030-05-02,03:00,03:03,25,100\n1,2030-05-02,06:00,06:03,25,100\n');
  const baseline = vm.runInContext('evaluate(readings[0]).co2', c);
  assert.equal(vm.runInContext('measurementClock(readings[0]).duration', c), 60);
  await upload(c, 'id,occurrence,date,start_time,end_time,temperature,pressure\n1,1,bad date,roughly afternoon,?,25,100\n');
  assert.equal(vm.runInContext('evaluate(readings[0]).co2', c), baseline);
  assert.equal(vm.runInContext('measurementClock(readings[0]).source', c), 'missing-field-time');
  assert.equal(vm.runInContext('readings[0].start', c), '2026-01-01 10:00:00');
});

test('duplicates are skipped, project matching is isolated and conflicting assignments are atomic', async () => {
  const { c, elements } = context();
  vm.runInContext(`readings.push({...readings[0],project:'B',temperature:19});`, c);
  await upload(c, 'id,occurrence,temperature,pressure\n1,1,25,100\n1,1,25,100\n');
  assert.ok(elements.status.textContent.includes('1 identical duplicate'));
  assert.equal(vm.runInContext('readings[2].temperature', c), 19);
  await assert.rejects(() => upload(c, 'id,occurrence,temperature,pressure\n1,1,26,100\n1,1,27,100\n'));
  assert.equal(vm.runInContext('readings[0].temperature', c), 25);
});

test('timestamped GPS needs no IDs and matches field-clock stationary periods', () => {
  const { c } = context();
  c.rows = Array.from({ length: 181 }, (_, i) => ({
    time: (BigInt(Date.parse('2026-01-01T12:00:00Z')) * 1000000n + BigInt(i) * 1000000000n).toString(),
    seconds_elapsed: i, latitude: -20 + Math.sin(i) * .000001,
    longitude: 16.5 + Math.cos(i) * .000001, horizontalAccuracy: 5, speed: .01
  }));
  vm.runInContext(`const track={name:'synthetic-gps.csv',...parseGPSTrack(rows)};projects[0].gpsTracks=[track];projects[0].gpsSettings={offset:2,radius:15,minDwell:60,maxAccuracy:25,maxSpeed:.5};readings[0].fieldStart='2026-01-01 14:00:00';readings[1].fieldStart='2026-01-02 14:00:00';recomputeProjectGPS('A');`, c);
  assert.equal(vm.runInContext('isGPSTrack(rows)', c), true);
  assert.equal(vm.runInContext('readings[0].gpsMatchMethod', c), 'track');
  assert.equal(vm.runInContext('readings[0].gpsAccuracyM', c), 5);
  assert.ok(Number.isFinite(vm.runInContext('readings[0].latitude', c)));
  assert.equal(vm.runInContext('readings[1].latitude', c), '');
  assert.ok(vm.runInContext('readings[1].gpsMatchNote', c).includes('No stationary'));
});
