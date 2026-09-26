#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const API_BASE = 'https://typhoon.slt.zj.gov.cn/Api';
const SOURCE_PAGE = 'https://typhoon.slt.zj.gov.cn/wap.htm';
const OUTPUT = resolve(process.cwd(), 'data/typhoon.json');
const TIMEOUT_MS = 20_000;

const requestHeaders = {
  Accept: 'application/json',
  Referer: 'https://typhoon.slt.zj.gov.cn/',
  'User-Agent': 'typhoon-live-dashboard/1.0 (+https://github.com/NinLonIX/typhoon-live-dashboard)',
};

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function textOrNull(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text || null;
}

function activeValue(value) {
  return value === true || value === 1 || String(value) === '1';
}

function warningLevel(value) {
  const level = String(value || '').toLowerCase();
  return ['blue', 'yellow', 'orange', 'red'].includes(level) ? level : 'none';
}

function compactPoints(points = []) {
  return points
    .map((point) => ({
      time: textOrNull(point.time),
      lng: numberOrNull(point.lng),
      lat: numberOrNull(point.lat),
      strong: textOrNull(point.strong),
      power: numberOrNull(point.power),
      windSpeedMs: numberOrNull(point.speed),
      pressureHpa: numberOrNull(point.pressure),
      moveSpeedKmh: numberOrNull(point.movespeed),
      moveDirection: textOrNull(point.movedirection),
      radius7: textOrNull(point.radius7),
      radius10: textOrNull(point.radius10),
      radius12: textOrNull(point.radius12),
    }))
    .filter((point) => point.time && point.lng !== null && point.lat !== null);
}

function forecastPoints(points = []) {
  return points
    .map((point) => ({
      time: textOrNull(point.time),
      lng: numberOrNull(point.lng),
      lat: numberOrNull(point.lat),
      strong: textOrNull(point.strong),
      power: numberOrNull(point.power),
      windSpeedMs: numberOrNull(point.speed),
      pressureHpa: numberOrNull(point.pressure),
    }))
    .filter((point) => point.time && point.lng !== null && point.lat !== null);
}

function maxRadius(value) {
  if (!value) return null;
  const values = String(value).split('|').map(Number).filter((item) => Number.isFinite(item) && item > 0);
  return values.length ? Math.max(...values) : null;
}

async function getJson(path) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      headers: requestHeaders,
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`${path} returned HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function pickForecast(lastPoint) {
  const agencies = Array.isArray(lastPoint?.forecast) ? lastPoint.forecast : [];
  return agencies.find((agency) => agency.tm === '中国') || agencies[0] || null;
}

function normalizeStorm(summary, info, events) {
  const points = compactPoints(info.points);
  const current = points.at(-1) || {
    time: info.endtime,
    lng: numberOrNull(info.centerlng),
    lat: numberOrNull(info.centerlat),
    strong: null,
    power: null,
    windSpeedMs: null,
    pressureHpa: null,
    moveSpeedKmh: null,
    moveDirection: null,
  };
  const forecastAgency = pickForecast(info.points?.at(-1));
  const forecast = forecastPoints(forecastAgency?.forecastpoints || []).filter((point, index) => {
    if (index === 0 && point.time === current.time) return false;
    return true;
  });
  const warning = warningLevel(info.warnlevel || summary.warnlevel);

  return {
    id: String(info.tfid || summary.tfid),
    name: textOrNull(info.name || summary.name),
    enName: textOrNull(info.enname || summary.enname),
    active: activeValue(info.isactive ?? summary.isactive),
    startTime: textOrNull(info.starttime || summary.starttime),
    endTime: textOrNull(info.endtime || summary.endtime),
    current,
    observed: points,
    forecast: {
      agency: textOrNull(forecastAgency?.tm) || '未提供',
      points: forecast,
    },
    warning: {
      level: warning,
      label: warning === 'none' ? '未提供' : warning,
      issuer: warning === 'none' ? null : '浙江省台风路径实时发布系统',
      message: warning === 'none'
        ? '当前接口未返回浙江省地方预警级别，请以当地气象和应急部门公告为准。'
        : '请按照发布机构的最新预警和行动指引执行。',
    },
    windRadiusKm: {
      level7: maxRadius(current.radius7),
      level10: maxRadius(current.radius10),
      level12: maxRadius(current.radius12),
    },
    events: Array.isArray(events) ? events.map((event) => ({
      time: textOrNull(event.time),
      type: textOrNull(event.etype),
      name: textOrNull(event.ename),
      description: textOrNull(event.description),
    })) : [],
    positionText: textOrNull(info.ckposition),
    movementText: textOrNull(info.jl),
  };
}

async function fetchLiveData() {
  const year = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric' }).format(new Date());
  const list = await getJson(`/TyphoonList/${year}`);
  if (!Array.isArray(list)) throw new Error('TyphoonList response is not an array');
  const active = list.filter((summary) => activeValue(summary.isactive));
  const storms = [];

  for (const summary of active) {
    const info = await getJson(`/TyphoonInfo/${summary.tfid}`);
    let events = [];
    try {
      events = await getJson(`/TyphoonEvent/${summary.tfid}/False`);
    } catch (error) {
      console.warn(`Could not fetch events for ${summary.tfid}: ${error.message}`);
    }
    storms.push(normalizeStorm(summary, info, events));
  }

  return {
    schemaVersion: 1,
    status: 'live',
    fetchedAt: new Date().toISOString(),
    source: {
      name: '浙江省台风路径实时发布系统',
      page: SOURCE_PAGE,
      apiBase: API_BASE,
      apiYear: `${API_BASE}/TyphoonList/${year}`,
    },
    warningNote: '浙江省台风路径接口未必提供地方预警级别；本页面不自行推断预警等级。',
    storms,
    activeStormId: storms[0]?.id || null,
  };
}

async function readExisting() {
  try {
    return JSON.parse(await readFile(OUTPUT, 'utf8'));
  } catch {
    return null;
  }
}

async function main() {
  await mkdir(dirname(OUTPUT), { recursive: true });
  try {
    const payload = await fetchLiveData();
    await writeFile(OUTPUT, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    console.log(`Fetched ${payload.storms.length} active storm(s) from Zhejiang Typhoon API.`);
  } catch (error) {
    const existing = await readExisting();
    const stale = {
      ...(existing || {
        schemaVersion: 1,
        source: { name: '浙江省台风路径实时发布系统', page: SOURCE_PAGE, apiBase: API_BASE },
        storms: [],
        activeStormId: null,
      }),
      status: 'stale',
      fetchedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
    };
    await writeFile(OUTPUT, `${JSON.stringify(stale, null, 2)}\n`, 'utf8');
    console.error(`Live data fetch failed; keeping the last payload and marking it stale: ${stale.error}`);
  }
}

main();
