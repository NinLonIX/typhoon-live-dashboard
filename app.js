const cityData = {
  zhoushan: { name: '舟山 · 浙江', distance: '468 km', copy: '预计 09/27 凌晨开始出现明显风雨，海上作业请提前回港。' },
  ningbo: { name: '宁波 · 浙江', distance: '516 km', copy: '预计 09/27 清晨起风力增强，港区和沿海景区请关注临时管控。' },
  fuzhou: { name: '福州 · 福建', distance: '702 km', copy: '预计 09/27 中午起出现间歇性强降雨，检查低洼路段排水。' },
  xiamen: { name: '厦门 · 福建', distance: '824 km', copy: '预计 09/28 凌晨起受外围云系影响，海边活动请留意风浪变化。' }
};

const citySelect = document.querySelector('#city-select');
const focusCity = document.querySelector('#focus-city');
const focusDistance = document.querySelector('#focus-distance');
const focusCopy = document.querySelector('#focus-copy');
const cityRows = [...document.querySelectorAll('.city-row[data-city]')];

function updateCity(key) {
  const city = cityData[key];
  if (!city) return;
  focusCity.textContent = city.name;
  focusDistance.textContent = city.distance;
  focusCopy.textContent = city.copy;
  cityRows.forEach((row) => row.classList.toggle('selected', row.dataset.city === key));
}

citySelect.addEventListener('change', (event) => updateCity(event.target.value));
cityRows.forEach((row) => row.addEventListener('click', () => {
  citySelect.value = row.dataset.city;
  updateCity(row.dataset.city);
}));

document.querySelector('#refresh-demo').addEventListener('click', (event) => {
  const button = event.currentTarget;
  const original = button.textContent;
  button.textContent = '演示数据已刷新';
  button.setAttribute('aria-label', '演示数据已刷新，数据仍为虚构示例');
  window.setTimeout(() => {
    button.textContent = original;
    button.removeAttribute('aria-label');
  }, 1800);
});

updateCity('zhoushan');
