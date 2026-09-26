const cityData = {
  zhoushan: { name: '舟山 · 浙江', lat: 30.0169, lng: 122.1069 },
  ningbo: { name: '宁波 · 浙江', lat: 29.8683, lng: 121.5440 },
  fuzhou: { name: '福州 · 福建', lat: 26.0745, lng: 119.2965 },
  xiamen: { name: '厦门 · 福建', lat: 24.4798, lng: 118.0894 }
};
const levelLabels = { blue: '蓝色', yellow: '黄色', orange: '橙色', red: '红色', none: '未提供' };
const svgNs = 'http://www.w3.org/2000/svg';
let currentPayload = null;
let currentStorm = null;
let selectedCity = 'zhoushan';

const $ = (id) => document.getElementById(id);
const setText = (id, value) => { const node = $(id); if (node) node.textContent = value ?? '—'; };
const finite = (value) => typeof value === 'number' && Number.isFinite(value);

function formatTime(value, withMinutes = true) {
  if (!value) return '—';
  const raw = String(value).replace(' ', 'T');
  const date = new Date(/Z$|[+-]\d\d:\d\d$/.test(raw) ? raw : `${raw}+08:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit', hour: '2-digit',
    minute: withMinutes ? '2-digit' : undefined, hour12: false
  }).format(date).replace('/', '/');
}

function formatCoordinate(lat, lng) {
  if (!finite(lat) || !finite(lng)) return '—';
  return `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? 'N' : 'S'} · ${Math.abs(lng).toFixed(1)}°${lng >= 0 ? 'E' : 'W'}`;
}

function formatRadius(value) {
  return finite(value) ? `${value} km` : '未提供';
}

function haversineKm(a, b) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function mapPoint(point) {
  const x = 40 + ((point.lng - 115) / 35) * 920;
  const y = 40 + ((40 - point.lat) / 30) * 420;
  return { x: Math.max(30, Math.min(970, x)), y: Math.max(30, Math.min(470, y)) };
}

function createSvg(tag, attrs = {}) {
  const node = document.createElementNS(svgNs, tag);
  Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
  return node;
}

function drawPath(group, points, className) {
  if (!points?.length) return;
  const pathPoints = points.map(mapPoint);
  const path = createSvg('path', { class: className, d: `M ${pathPoints.map((point) => `${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' L ')}` });
  group.appendChild(path);
  const pointsGroup = createSvg('g', { class: `track-points ${className === 'track-observed' ? 'observed-points' : 'forecast-points'}` });
  points.forEach((point) => {
    const mapped = mapPoint(point);
    const circle = createSvg('circle', { cx: mapped.x, cy: mapped.y, r: 6 });
    circle.setAttribute('tabindex', '0');
    circle.setAttribute('aria-label', `${formatTime(point.time)}，${formatCoordinate(point.lat, point.lng)}`);
    pointsGroup.appendChild(circle);
  });
  group.appendChild(pointsGroup);
}

function drawMap(storm) {
  const group = $('dynamic-track');
  if (!group) return;
  group.replaceChildren();
  const observed = storm.observed || [];
  const forecast = storm.forecast?.points || [];
  drawPath(group, observed, 'track-observed');
  drawPath(group, forecast, 'track-forecast');
  const current = storm.current;
  if (!finite(current?.lat) || !finite(current?.lng)) return;
  const point = mapPoint(current);
  const currentGroup = createSvg('g', { class: 'current-storm', filter: 'url(#softGlow)' });
  currentGroup.appendChild(createSvg('circle', { cx: point.x, cy: point.y, r: 32, class: 'wind-ring' }));
  currentGroup.appendChild(createSvg('circle', { cx: point.x, cy: point.y, r: 13, class: 'storm-core' }));
  currentGroup.appendChild(createSvg('path', { d: `M ${point.x} ${point.y - 28} L ${point.x + 11} ${point.y - 6} L ${point.x + 2} ${point.y - 8} L ${point.x - 5} ${point.y + 13} L ${point.x - 11} ${point.y + 4} L ${point.x - 2} ${point.y - 4} L ${point.x - 11} ${point.y - 7} Z`, class: 'storm-symbol' }));
  group.appendChild(currentGroup);

  const labelX = point.x > 760 ? point.x - 170 : point.x + 20;
  const labelY = Math.max(55, point.y - 38);
  const callout = createSvg('g', { class: 'map-callout' });
  callout.appendChild(createSvg('rect', { x: labelX, y: labelY, width: 154, height: 66, rx: 12 }));
  const title = createSvg('text', { x: labelX + 18, y: labelY + 24, class: 'callout-title' });
  title.textContent = `${storm.name || '台风'} · 当前中心`;
  callout.appendChild(title);
  const coords = createSvg('text', { x: labelX + 18, y: labelY + 45 });
  coords.textContent = formatCoordinate(current.lat, current.lng);
  callout.appendChild(coords);
  group.appendChild(callout);

  const badge = createSvg('g', { class: 'time-badge' });
  const badgeX = Math.max(40, Math.min(832, point.x - 64));
  const badgeY = Math.min(448, point.y + 36);
  badge.appendChild(createSvg('rect', { x: badgeX, y: badgeY, width: 128, height: 27, rx: 13.5 }));
  const badgeText = createSvg('text', { x: badgeX + 64, y: badgeY + 19, 'text-anchor': 'middle' });
  badgeText.textContent = formatTime(current.time);
  badge.appendChild(badgeText);
  group.appendChild(badge);
}

function renderWarning(storm) {
  const warning = storm.warning || { level: 'none', label: '未提供', message: '接口未返回地方预警级别。' };
  const level = warning.level || 'none';
  const label = levelLabels[level] || '未提供';
  setText('hero-warning', `${label}预警`);
  setText('hero-alert-title', level === 'none' ? '地方预警级别未提供' : `${label} · 请关注官方指引`);
  setText('hero-alert-copy', warning.message || '请以当地气象和应急部门发布的最新通知为准。');
  setText('alert-advice-copy', warning.message || '请以当地气象和应急部门发布的最新通知为准。');
  setText('alert-source', `来源：${currentPayload?.source?.name || '浙江省台风路径实时发布系统'} · 接口原文未提供地方预警级别时不自行推断`);
  document.querySelectorAll('.alert-level').forEach((row) => {
    const isActive = level !== 'none' && row.dataset.level === level;
    row.classList.toggle('active-level', isActive);
    const status = row.querySelector('.level-status');
    if (status) status.textContent = isActive ? '当前' : '未触发';
  });
}

function renderCities(storm) {
  document.querySelectorAll('.city-row[data-city]').forEach((row) => {
    const city = cityData[row.dataset.city];
    const distance = haversineKm({ lat: storm.current.lat, lng: storm.current.lng }, city);
    const nearest = (storm.forecast?.points || []).reduce((best, point) => {
      const next = { point, distance: haversineKm({ lat: point.lat, lng: point.lng }, city) };
      return !best || next.distance < best.distance ? next : best;
    }, null);
    const distanceNode = row.querySelector('[data-distance]');
    const impactNode = row.querySelector('[data-impact]');
    const statusNode = row.querySelector('[data-status]');
    if (distanceNode) distanceNode.textContent = `${Math.round(distance)} km`;
    if (impactNode) impactNode.textContent = nearest ? `${formatTime(nearest.point.time)} 最近` : '暂无预测点';
    if (statusNode) {
      statusNode.textContent = '请查当地预警';
      statusNode.className = 'city-status blue';
    }
  });
  updateSelectedCity(storm, selectedCity);
}

function updateSelectedCity(storm, key) {
  const city = cityData[key] || cityData.zhoushan;
  selectedCity = cityData[key] ? key : 'zhoushan';
  const distance = haversineKm({ lat: storm.current.lat, lng: storm.current.lng }, city);
  const nearest = (storm.forecast?.points || []).reduce((best, point) => {
    const next = { point, distance: haversineKm({ lat: point.lat, lng: point.lng }, city) };
    return !best || next.distance < best.distance ? next : best;
  }, null);
  setText('focus-city', city.name);
  setText('focus-distance', `${Math.round(distance)} km`);
  setText('focus-copy', nearest ? `预测路径中距该城市最近点约 ${Math.round(nearest.distance)} km，时间 ${formatTime(nearest.point.time)}；请查看当地官方预警。` : '暂无预测点，请查看当地官方预警。');
  document.querySelectorAll('.city-row[data-city]').forEach((row) => row.classList.toggle('selected', row.dataset.city === selectedCity));
  const select = $('city-select');
  if (select) select.value = selectedCity;
}

function renderStorm(storm) {
  currentStorm = storm;
  const current = storm.current || {};
  const warning = storm.warning || { level: 'none' };
  const direction = current.moveDirection || '未提供';
  const movement = finite(current.moveSpeedKmh) ? `${current.moveSpeedKmh} km/h` : '未提供';
  const strength = current.strong || '未提供';
  const windLevel = finite(current.power) ? `${current.power} 级` : '未提供';
  const windSpeed = finite(current.windSpeedMs) ? `最大风速 ${current.windSpeedMs} m/s` : '最大风速未提供';
  const status = currentPayload.status === 'live' ? '实时同步' : '最近一次缓存';
  setText('storm-name', storm.name || '未命名台风');
  setText('hero-lede', `${strength}，当前位于 ${formatCoordinate(current.lat, current.lng)}，向${direction}移动。`);
  setText('hero-id', `编号 ${storm.id || '—'}`);
  setText('hero-status', storm.active ? status : '已结束');
  setText('metric-location-value', formatCoordinate(current.lat, current.lng));
  setText('metric-location-desc', storm.positionText || '浙江台风系统当前中心位置');
  setText('metric-location-extra', `观测时间 ${formatTime(current.time)}`);
  setText('metric-direction-value', direction);
  setText('metric-direction-desc', `移动速度 ${movement}`);
  setText('metric-direction-extra', storm.movementText || '方向描述来自当前实况点');
  setText('metric-wind-value', windLevel);
  setText('metric-wind-desc', windSpeed);
  setText('metric-wind-extra', `七级风圈 ${formatRadius(storm.windRadiusKm?.level7)}`);
  setText('metric-pressure-value', finite(current.pressureHpa) ? `${current.pressureHpa} hPa` : '未提供');
  setText('metric-pressure-desc', `强度：${strength}`);
  setText('metric-pressure-extra', `观测时间 ${formatTime(current.time)}`);
  setText('track-updated', formatTime(current.time));
  setText('track-agency', storm.forecast?.agency || '未提供');
  setText('track-state', status);
  setText('alert-updated', currentPayload.fetchedAt ? `同步 ${formatTime(currentPayload.fetchedAt)}` : '已同步');
  setText('detail-name', storm.name || '—');
  setText('detail-en-name', storm.enName || '—');
  setText('detail-start', formatTime(storm.startTime, false));
  setText('detail-radius7', formatRadius(storm.windRadiusKm?.level7));
  renderWarning(storm);
  drawMap(storm);
  renderCities(storm);
  setText('source-copy', `数据已从${currentPayload.source?.name || '浙江省台风路径实时发布系统'}同步。最近抓取 ${formatTime(currentPayload.fetchedAt)}；本站为非官方转发页面，不能替代正式预警。`);
}

function renderEmptyState(message) {
  setText('storm-name', '暂无活跃台风');
  setText('hero-lede', message);
  setText('hero-warning', '预警信息未提供');
  setText('hero-id', '编号 —');
  setText('hero-status', '无活跃台风');
  ['metric-location-value', 'metric-direction-value', 'metric-wind-value', 'metric-pressure-value'].forEach((id) => setText(id, '—'));
  ['metric-location-desc', 'metric-location-extra', 'metric-direction-desc', 'metric-direction-extra', 'metric-wind-desc', 'metric-wind-extra', 'metric-pressure-desc', 'metric-pressure-extra'].forEach((id) => setText(id, '暂无数据'));
  setText('track-state', '等待下一次同步');
  setText('alert-advice-copy', message);
}

async function loadData() {
  try {
    const response = await fetch(`data/typhoon.json?ts=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    currentPayload = await response.json();
    const storms = Array.isArray(currentPayload.storms) ? currentPayload.storms : [];
    $('stream-label').textContent = currentPayload.status === 'live' ? '实时数据流' : '缓存数据流';
    if (currentPayload.status !== 'live') {
      $('data-ribbon').classList.add('stale');
      $('data-ribbon').lastChild.textContent = ' 数据源同步异常，当前显示最近一次缓存；请以权威部门公告为准。';
    }
    if (!storms.length) renderEmptyState('当前接口没有返回活跃台风，请以浙江省台风路径系统的最新列表为准。');
    else renderStorm(storms.find((storm) => storm.id === currentPayload.activeStormId) || storms[0]);
  } catch (error) {
    currentPayload = { status: 'unavailable', source: { name: '浙江省台风路径实时发布系统' }, storms: [] };
    $('stream-label').textContent = '数据暂不可用';
    $('data-ribbon').classList.add('stale');
    $('data-ribbon').lastChild.textContent = ' 实时数据暂时无法读取，请以权威部门公告为准。';
    renderEmptyState(`实时数据加载失败：${error.message}`);
  }
}

document.querySelector('#refresh-data').addEventListener('click', () => window.location.reload());
$('city-select').addEventListener('change', (event) => { if (currentStorm) updateSelectedCity(currentStorm, event.target.value); });
document.querySelectorAll('.city-row[data-city]').forEach((row) => row.addEventListener('click', () => { if (currentStorm) updateSelectedCity(currentStorm, row.dataset.city); }));
loadData();
